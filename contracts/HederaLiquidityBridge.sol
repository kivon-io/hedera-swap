// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
  HederaBridgeSourceV2.sol
  - Hedera-side bridge (Chain A) using LayerZero v2 OApp patterns
  - Handles native HBAR and token deposits
  - Swaps token -> WHBAR -> unwrap -> HBAR (if token deposit)
  - Uses Supra DORA (S-value) for price conversions (owner sets feed IDs)
  - Pays LayerZero v2 message fee from contract balance via _lzSend + MessagingFee
  - Multi-destination support: pass dstEid + dstBridgePacked per call
  - Implements _lzReceive to accept incoming cross-chain messages (v2 signature)
*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// LayerZero v2 OApp imports (v2)
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

import "./PriceConversionHelpers.sol";

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

/// Minimal router interface (UniswapV2-like / SaucerSwap compatible)
interface IRouter {
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
}

/// Wrapped-native minimal interface (WETH/WHBAR-like)
interface IWrappedNative is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}

/// Supra Pull Oracle (struct-based S-value feed)
interface ISupraSValueFeed {
    struct priceFeed {
        uint256 round;
        uint256 decimals;
        uint256 time;
        uint256 price;
    }

    function getSvalue(uint256 _pairIndex) external view returns (priceFeed memory);
}

contract MultiTokenBridge is Ownable, OApp,  ReentrancyGuard, PriceConversionHelpers {
    using SafeERC20 for IERC20;

    // ---------- State ----------
    IRouter public router;                 // DEX router on Hedera
    address public wrappedNative;          // WHBAR address
    ISupraSValueFeed public supraOracle;   // Supra DORA (S-value) adapter contract

    // protocol fee (bps), e.g., 25 = 0.25% 
    uint16 public protocolFeeBps = 25;
    uint16 public constant MAX_PROTOCOL_FEE_BPS = 500; // 5%
    uint8 public nativeDecimal;

    // fee reserve stored in source-native (HBAR) for bookkeeping and to pay LZ fees
    uint256 public feeReserveHBAR;

    // mapping of “symbolic keys” to Supra feed IDs (owner sets these)
    // e.g., token address => feedId uint64
    mapping(address => Feed) public feedIds;
    mapping(uint32  => Feed) public desFeedIds; //destination feeds using layer zero chain id 

    // helper struct for send params
    struct BridgeParams {
        address tokenIn;            // address(0) if HBAR
        uint256 amountIn;
        uint8 tokenDecimals; //incoming token. 
        uint8 desTokenDecimals; //outgoing token. 
        uint32 dstEid;              // LayerZero v2 endpoint id (destination)
        bytes dstBridgePacked;      // abi.encodePacked(destination bridge address on dest)
        bytes toAddressPacked;      // abi.encodePacked(recipient address on dest)
        address dstDesiredToken;    // address(0) if native desired on dest
        address[] pathToWHBAR;      // optional path override
        address[] pathToDesToken;
        bytes adapterParams;        // options / adapterParams passed to _lzSend/_quote
    }

    struct Feed {
        uint64 id; 
        bool approved; 
        uint8 tokenDecimals;
    }

    // events
    event BridgePrepared(
        address indexed sender,
        address tokenIn,
        uint256 amountIn,
        uint32 dstEid,
        bytes dstBridgePacked,
        bytes toAddressPacked,
        uint256 nativeToReleaseOnDest,
        uint256 protocolFeeSourceNative,
        uint256 lzFeeSourceNative
    );
    event FeedSet(address token, uint64 feedId);
    event DesfeedSet(uint32 token, uint64 feedId);
    event TokenPathSet(address token, address[] path);
    event RouterSet(address router);
    event WrappedNativeSet(address w);
    event FeeReserveWithdrawn(address to, uint256 amount);
    event supraOracleSet(address supraOracle);
    // ---------- Constructor ----------
    // _delegate is the owner / delegate to OApp and Ownable
    constructor(
        address _endpoint,
        address _delegate,
        address _router,
        address _wrappedNative,
        address _supraOracle, 
        uint8 _nativeDecimal
    ) OApp(_endpoint, _delegate) Ownable(_delegate) {
        require(_endpoint != address(0), "endpoint required");
        require(_delegate != address(0), "delegate required");
        router = IRouter(_router);
        wrappedNative = _wrappedNative;
        supraOracle = ISupraSValueFeed(_supraOracle);
        nativeDecimal = _nativeDecimal; 
    }

    // ---------- Admin ----------
    function setRouter(address _router) external onlyOwner {
        router = IRouter(_router);
        emit RouterSet(_router);
    }

    function setWrappedNative(address _w) external onlyOwner {
        wrappedNative = _w;
        emit WrappedNativeSet(_w);
    }

    function setSupraOracle(address _supraOracle) external onlyOwner {
        supraOracle = ISupraSValueFeed(_supraOracle);
        emit supraOracleSet(_supraOracle);
    }

    function setProtocolFeeBps(uint16 _bps) external onlyOwner {
        require(_bps <= MAX_PROTOCOL_FEE_BPS, "fee too high");
        protocolFeeBps = _bps;
    }

    function setFeedId(address token, uint64 feedId, bool status) external onlyOwner {
        Feed storage feed = feedIds[token];
        feed.id = feedId; 
        feed.approved = status;
        emit FeedSet(token, feedId);
    }

    function setDesfeedIds(uint32 dstEid, uint64 feedId, bool status) external onlyOwner {
        Feed storage feed = desFeedIds[dstEid];
        feed.id = feedId; 
        feed.approved = status;
        emit DesfeedSet(dstEid, feedId);
    }

    function withdrawFeeReserve(address payable to, uint256 amount) external onlyOwner {
        require(amount <= feeReserveHBAR, "insufficient fee reserve");
        feeReserveHBAR -= amount;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit FeeReserveWithdrawn(to, amount);
    }

    // implement abstract _getPrice from PriceConversionHelpers
    function _getPrice(address key) internal view override returns (uint256 price, uint8 decimals) {
        require(feedIds[key].approved, "Invalid feed");
        uint64 pairIndex = feedIds[key].id;
        ISupraSValueFeed.priceFeed memory feed = supraOracle.getSvalue(pairIndex);
        require(feed.price > 0, "invalid price");
        price = feed.price;
        decimals = uint8(feed.decimals);
    }

    function getDestPrice(uint32 dstEid) public view override  returns (uint256 price, uint8 decimals) {
        require(desFeedIds[dstEid].approved, "Invalid feed");
        uint64 pairIndex = desFeedIds[dstEid].id;
        ISupraSValueFeed.priceFeed memory feed = supraOracle.getSvalue(pairIndex);
        require(feed.price > 0, "invalid price");
        price = feed.price;
        decimals = uint8(feed.decimals);
    }

    function getDesfeedIds(uint64 pairIndex) external view onlyOwner returns (uint256 price, uint8 decimals){
        ISupraSValueFeed.priceFeed memory feed = supraOracle.getSvalue(pairIndex);
          require(feed.price > 0, "invalid price");
        price = feed.price;
        decimals = uint8(feed.decimals);
    }

    // allow external peek
    function peekPrice(address key) external view returns (uint256 price, uint8 decimals) {
        return _getPrice(key);
    }

    /// Returns (totalFeeInSourceNative, minAmountOutInDestNative)
    /// NOTE: uses LayerZero v2 _quote (internal) to estimate MessagingFee
    function estimateBridgeOutcome(
        address tokenIn,
        uint256 amountIn,
        uint32 dstEid,
        uint8 tokenDecimals, //incoming token
        uint8 desTokenDecimals, 
        address dstDesiredToken,
        bytes calldata toAddressPacked,
        bytes calldata adapterParams,
        address[] calldata pathToDesToken
    ) external view returns (uint256 totalFeeSourceNative, uint256 minAmountOutDestNative) {
        require(amountIn > 0, "zero amount");

        // 1) USD value (scaled18)
        uint256 usdScaled18;
        if (tokenIn == address(0)) {
            usdScaled18 = _tokenAmountToUsdScaled18(amountIn, wrappedNative, nativeDecimal);
        } else {
            usdScaled18 = _tokenAmountToUsdScaled18(amountIn, tokenIn, tokenDecimals);
        }

        // 2) USD -> destination native gross
        uint256 dstNativeGross = _usdScaled18ToNative(usdScaled18, address(0), dstEid, desTokenDecimals);
        require(dstNativeGross > 0, "zero dst native gross");

        // 3) protocol fee (dest native)
        uint256 protocolFeeDestNative = (dstNativeGross * uint256(protocolFeeBps)) / 10000;
        uint256 dstNativeAfterProtocol = dstNativeGross - protocolFeeDestNative;

        // 4) estimate LayerZero v2 fee using internal _quote
        bytes memory payloadForEstimate = abi.encode(toAddressPacked, dstNativeGross, dstDesiredToken, pathToDesToken);
        MessagingFee memory fee = _quote(dstEid, payloadForEstimate, adapterParams, false);

        uint256 lzFeeSourceNative = fee.nativeFee;

        // // 5) convert LZ fee -> USD18 -> dest native equivalent
        uint256 lzFeeUsd18 = _tokenAmountToUsdScaled18(lzFeeSourceNative, wrappedNative, nativeDecimal);
        uint256 lzFeeOnDestNative = _usdScaled18ToNative(lzFeeUsd18, address(0), dstEid, desTokenDecimals);

        // 6) final dest native after fees
        require(dstNativeAfterProtocol > lzFeeOnDestNative, "fees exceed value");
        uint256 dstNativeToRelease = dstNativeAfterProtocol - lzFeeOnDestNative;
        dstNativeToRelease = (dstNativeToRelease * 995) / 1000; // safety buffer

        (uint256 srcNativePrice, uint8 srcNativePriceDecimals) = _getPrice(wrappedNative);
        (uint256 dstNativePrice, uint8 dstNativePriceDecimals) = getDestPrice(dstEid);
        // 7) protocol fee converted to source-native (approx)
        uint256 protocolFeeUsd18 = (protocolFeeDestNative * dstNativePrice) / (10 ** dstNativePriceDecimals);
        uint256 protocolFeeSourceNative = (protocolFeeUsd18 * (10 ** srcNativePriceDecimals)) / srcNativePrice;

        totalFeeSourceNative = lzFeeSourceNative + protocolFeeSourceNative;
        minAmountOutDestNative = dstNativeToRelease;
        return (totalFeeSourceNative, minAmountOutDestNative);
    }

    // ---------- Acquire funds & compute payload ----------
    // sendFromHedera now uses BridgeParams struct; uses v2 _lzSend
    function sendFromSource(BridgeParams calldata p) external payable nonReentrant {
        // 1) Acquire USD value (scaled18)
        uint256 usdScaled18;

        if (p.tokenIn == address(0)) {
            require(msg.value > 0, "must send source token as msg.value");
            usdScaled18 = _tokenAmountToUsdScaled18(msg.value, wrappedNative, nativeDecimal);
        } else {
            // compute USD using token feed
            usdScaled18 = _tokenAmountToUsdScaled18(p.amountIn, p.tokenIn, p.tokenDecimals);

            // pull token from user
            IERC20(p.tokenIn).safeTransferFrom(msg.sender, address(this), p.amountIn);

            address[] memory usedPath;
            usedPath = p.pathToWHBAR;
            require( 
                usedPath[0] == p.tokenIn && 
                usedPath[usedPath.length - 1] == wrappedNative,
                "Invalid swap path provided"
            );           
            // approve & swap tokenIn -> wrappedNative
            IERC20(p.tokenIn).safeIncreaseAllowance(address(router), p.amountIn);
            router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                p.amountIn,
                0,
                usedPath,
                address(this),
                block.timestamp + 300
            );

            // unwrap wrappedNative -> native
            uint256 whbal = IERC20(wrappedNative).balanceOf(address(this));
            require(whbal > 0, "zero WHBAR after swap");
            IWrappedNative(wrappedNative).withdraw(whbal);
        }

        // 2) USD -> destination-native raw
        uint256 nativeOnBDestRaw = _usdScaled18ToNative(usdScaled18, address(0), p.dstEid, p.desTokenDecimals);

        // 3) protocol fee in dest native
        uint256 protocolFeeDestNative = (nativeOnBDestRaw * uint256(protocolFeeBps)) / 10000;
        uint256 nativeAfterProtocol = nativeOnBDestRaw - protocolFeeDestNative;

        // 4) estimate LayerZero v2 fee (MessagingFee)
        bytes memory payloadForEstimate = abi.encode(p.toAddressPacked, nativeOnBDestRaw, p.dstDesiredToken, p.pathToDesToken);
        MessagingFee memory fee = _quote(p.dstEid, payloadForEstimate, p.adapterParams, false);
        uint256 lzFeeSourceNative = fee.nativeFee;

        // 5) convert lzFeeSourceNative -> dest-native via USD
        (uint256 srcNativePrice, uint8 srcNativePriceDecimals) = _getPrice(wrappedNative);
        (uint256 dstNativePrice, uint8 dstNativePriceDecimals) = getDestPrice(p.dstEid);

        uint256 lzFeeUsd18 = (lzFeeSourceNative * srcNativePrice) / (10 ** srcNativePriceDecimals);
        uint256 lzFeeOnDestNative = (lzFeeUsd18 * (10 ** dstNativePriceDecimals)) / dstNativePrice;

        // 6) final native to release on dest after fees
        require(nativeAfterProtocol > lzFeeOnDestNative, "fees exceed value");
        uint256 nativeToRelease = nativeAfterProtocol - lzFeeOnDestNative;
        nativeToRelease = (nativeToRelease * 995) / 1000; // buffer

        // 7) Ensure contract has enough source-native to pay LZ fee
        require(address(this).balance >= lzFeeSourceNative, "insufficient contract native for LZ fee");

        // 8) Bookkeeping: protocolFeeDestNative -> source-native approx and store to feeReserveHBAR
        uint256 protocolFeeUsd18 = (protocolFeeDestNative * dstNativePrice) / (10 ** dstNativePriceDecimals);
        uint256 protocolFeeSourceNative = (protocolFeeUsd18 * (10 ** srcNativePriceDecimals)) / srcNativePrice;
        if (protocolFeeSourceNative > 0) feeReserveHBAR += protocolFeeSourceNative;

        // 9) Build final payload & send via v2 _lzSend
        bytes memory finalPayload = abi.encode(p.toAddressPacked, nativeToRelease, p.dstDesiredToken, p.pathToDesToken);

        // prepare MessagingFee struct to pay native fee from contract balance (zroFee=0)
        MessagingFee memory sendFee = MessagingFee(lzFeeSourceNative, uint256(0));

        // _lzSend returns a MessagingReceipt; we don't need it in current flow, but capture if desired:
        _lzSend(p.dstEid, finalPayload, p.adapterParams, sendFee, payable(address(this)));

        emit BridgePrepared(
            msg.sender,
            p.tokenIn,
            p.amountIn,
            p.dstEid,
            p.dstBridgePacked,
            p.toAddressPacked,
            nativeToRelease,
            protocolFeeSourceNative,
            lzFeeSourceNative
        );
    }

    // ---------- Receive Handler for inbound LayerZero v2 messages ----------
    // v2 signature: Origin calldata, bytes32 guid, bytes calldata payload, address executor, bytes calldata extraData
    function _lzReceive(
        Origin calldata /* _origin */,
        bytes32 /* _guid */,
        bytes calldata _payload,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) internal override {
        // decode payload: (toPacked, nativeAmount, dstDesiredToken)
        (bytes memory toPacked, uint256 nativeAmount, address dstDesiredToken, address[] memory pathToDesToken) =
            abi.decode(_payload, (bytes, uint256, address, address[]));

        // decode recipient address (supports abi.encodePacked(address))
        address recipient;
        if (toPacked.length == 20) {
            assembly { recipient := mload(add(toPacked, 20)) }
        } else {
            recipient = abi.decode(toPacked, (address));
        }

        // deliver: if native requested, transfer native; else swap native->desired token and send token to recipient
        if (dstDesiredToken == address(0)) {
            // deliver native
            require(address(this).balance >= nativeAmount, "insufficient contract native");
            (bool ok,) = payable(recipient).call{value: nativeAmount}("");
            require(ok, "native send failed");
            return;
        }

        
        address[] memory path = pathToDesToken;
        require(path.length >= 2, "dest swap path not configured");
        // path[0] must be wrappedNative

        // wrap native into wrappedNative
        IWrappedNative(wrappedNative).deposit{value: nativeAmount}();

        // approve router to spend wrappedNative
        IERC20(wrappedNative).safeIncreaseAllowance(address(router), nativeAmount);

        // compute expected out and fallback minOut
        uint[] memory amountsOut = router.getAmountsOut(nativeAmount, path);
        uint256 expectedOut = amountsOut[amountsOut.length - 1];
        //uint256 minOut = minAmountOut > 0 ? minAmountOut : (expectedOut * 995) / 1000;
        uint256 minOut = (expectedOut * 995) / 1000;
        // perform swap to recipient
        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(nativeAmount, minOut, path, recipient, block.timestamp + 300);
    }

    // ---------- Admin Withdraw Functions ----------
    function withdrawNative(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "invalid recipient");
        require(address(this).balance >= amount, "insufficient balance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    function withdrawERC20(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(0), "invalid token");
        require(to != address(0), "invalid recipient");
        IERC20(token).safeTransfer(to, amount);
    }

    // allow contract to receive native HBAR
    receive() external payable {}
}
