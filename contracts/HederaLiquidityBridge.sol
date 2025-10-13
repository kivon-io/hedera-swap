// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
  HederaBridgeSource.sol
  - Hedera-side bridge (Chain A)
  - Handles native HBAR and token deposits
  - Swaps token -> WHBAR -> unwrap -> HBAR (if token deposit)
  - Uses Supra DORA for price conversions (owner sets feed IDs)
  - Pays LayerZero message fee from contract balance via lzEndpoint.send{value: ...}()
  - Multi-destination support: pass dstChainId + dstBridgePacked per call
  - Implements _nonblockingLzReceive to accept incoming cross-chain messages
*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";
import "./PriceConversionHelpers.sol";


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
interface ISupraSValueFeed {
    function getSvalue(uint64 _pairIndex) external view returns (bytes32, bool);
}

contract HederaBridgeSource is Ownable, NonblockingLzApp, ReentrancyGuard, PriceConversionHelpers {
    
    using SafeERC20 for IERC20;
    // ---------- State ----------
    IRouter public router;                 // DEX router on Hedera
    address public wrappedNative;          // WHBAR address
    ISupraSValueFeed public supraOracle;         // Supra DORA adapter contract

    // protocol fee (bps), e.g., 25 = 0.25%
    uint16 public protocolFeeBps = 25;
    uint16 public constant MAX_PROTOCOL_FEE_BPS = 500; // 5%

    // fee reserve stored in source-native (HBAR) for bookkeeping and to pay LZ fees
    uint256 public feeReserveHBAR;

    // mapping of “symbolic keys” to Supra feed IDs (owner sets these)
    // e.g., keccak256("USDT/USD") => feedId bytes32
    mapping(bytes32 => uint64) public feedIds;

    // mapping token => swap path (token => ... -> wrappedNative) used when swapping token -> wrappedNative
    mapping(address => address[]) public tokenToPath;

    // mapping destination native swap paths (wrappedNative -> desiredToken) used on receive side
    mapping(address => address[]) public destPathFromWrapped; // key: desired token -> path (wrappedNative, desired)

    struct BridgeParams {
        address tokenIn;            // address(0) if HBAR
        uint256 amountIn;           
        uint8 tokenDecimals;
        uint16 dstChainId;
        bytes dstBridgePacked;
        bytes toAddressPacked;
        address dstDesiredToken;    // address(0) if native desired on dest
        uint256 minAmountOut;
        address[] pathToWHBAR;      // optional path override
        bytes adapterParams;
        bytes32 tokenUsdKey;
        bytes32 srcNativeUsdKey;
        bytes32 dstNativeUsdKey;
    }

    // events
    event BridgePrepared(
        address indexed sender,
        address tokenIn,
        uint256 amountIn,
        uint16 dstChainId,
        bytes dstBridgePacked,
        bytes toAddressPacked,
        uint256 nativeToReleaseOnDest,
        uint256 protocolFeeSourceNative,
        uint256 lzFeeSourceNative
    );
    event FeedSet(bytes32 key, uint64 feedId);
    event TokenPathSet(address token, address[] path);
    event DestPathSet(address desiredToken, address[] path);
    event RouterSet(address router);
    event WrappedNativeSet(address w);
    event FeeReserveWithdrawn(address to, uint256 amount);

    // ---------- Constructor ----------
    // _owner param used to initialize Ownable constructor
    constructor(
        address _lzEndpoint,
        address _router,
        address _wrappedNative,
        address _supraOracle,
        address _owner
    ) Ownable(_owner) NonblockingLzApp(_lzEndpoint) {
        require(_lzEndpoint != address(0), "lz endpoint required");
        router = IRouter(_router);
        wrappedNative = _wrappedNative;
        supraOracle = ISupraSValueFeed(_supraOracle);
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

    function setProtocolFeeBps(uint16 _bps) external onlyOwner {
        require(_bps <= MAX_PROTOCOL_FEE_BPS, "fee too high");
        protocolFeeBps = _bps;
    }

   function setFeedId(bytes32 key, uint64 feedId) external onlyOwner {
        feedIds[key] = feedId;
        emit FeedSet(key, feedId);
    }

    function setTokenToPath(address token, address[] calldata path) external onlyOwner {
        // path should end with wrappedNative for token->wrappedNative swaps
        tokenToPath[token] = path;
        emit TokenPathSet(token, path);
    }

    function setDestPathFromWrapped(address desiredToken, address[] calldata path) external onlyOwner {
        // path[0] should be wrappedNative
        destPathFromWrapped[desiredToken] = path;
        emit DestPathSet(desiredToken, path);
    }

    function withdrawFeeReserve(address payable to, uint256 amount) external onlyOwner {
        require(amount <= feeReserveHBAR, "insufficient fee reserve");
        feeReserveHBAR -= amount;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit FeeReserveWithdrawn(to, amount);
    }

    // ---------- Internal Supra helpers ----------
    /// Decode Supra oracle packed bytes32 response
    function _unpackPrice(bytes32 data)
        internal
        pure
        returns (uint256 price, uint8 decimals)
    {
        // Decode packed values from Supra's response
        uint256[4] memory info;
        info[0] = uint256(uint64(bytes8(data))); // round (not used)
        info[1] = uint256(uint8(bytes1(data << 64))); // decimals
        info[2] = uint256(uint48(bytes6(data << 72))); // timestamp (not used)
        info[3] = uint256(uint120(bytes15(data << 136))); // price

        price = info[3];
        decimals = uint8(info[1]);
    }

    function _getPrice(bytes32 key) override internal view returns (uint256 price, uint8 decimals)
    {
        uint64 feedId = feedIds[key];
        require(feedId != 0, "feedId not set");

        (bytes32 val, bool success) = supraOracle.getSvalue(feedId);
        require(success, "oracle query failed");

        (price, decimals) = _unpackPrice(val);
        require(price > 0, "invalid price");
    } 

    function peekPrice(bytes32 key) external view returns (uint256 price, uint8 decimals) {
        return _getPrice(key);
    }

        // returns (totalFeeInSourceNative, minAmountOutInDestNative)
    function estimateBridgeOutcome(
        address tokenIn,
        uint256 amountIn,
        uint8 tokenDecimals,
        uint16 dstChainId,
        address dstDesiredToken,
        bytes calldata toAddressPacked,
        bytes calldata adapterParams,
        bytes32 tokenUsdKey,
        bytes32 srcNativeUsdKey,
        bytes32 dstNativeUsdKey
    ) external view returns (uint256 totalFeeSourceNative, uint256 minAmountOutDestNative) {
        require(amountIn > 0, "zero amount");

        // 1) Compute USD value (scaled18) of what user provided
        uint256 usdScaled18;
        if (tokenIn == address(0)) {
            // amountIn is native amount (assume 1e18 decimals for native)
            usdScaled18 = _nativeToUsdScaled18(amountIn, srcNativeUsdKey);
        } else {
            // token amount -> USD (18)
            usdScaled18 = _tokenAmountToUsdScaled18(amountIn, tokenDecimals, tokenUsdKey);
        }

        // 2) USD -> destination native (gross value on dest chain)
        uint256 dstNativeGross = _usdScaled18ToNative(usdScaled18, dstNativeUsdKey);
        require(dstNativeGross > 0, "zero dst native gross");

        // 3) Protocol fee (in destination native)
        uint256 protocolFeeDestNative = (dstNativeGross * uint256(protocolFeeBps)) / 10000;
        uint256 dstNativeAfterProtocol = dstNativeGross - protocolFeeDestNative;

        // 4) Estimate LayerZero fee (in source native) for payload
        // Build a conservative payload similar to on-chain send: use dstNativeGross (gross) so fee estimate is not under.
        bytes memory payloadForEstimate = abi.encode(toAddressPacked, dstNativeGross, dstDesiredToken, uint256(0));
        (uint256 lzFeeSourceNative, ) = lzEndpoint.estimateFees(dstChainId, address(this), payloadForEstimate, false, adapterParams);

        // 5) Convert LZ fee (source native) -> USD18 -> destination native equivalent
        // LZ fee USD: sourceNativeAmount -> USD18
        uint256 lzFeeUsd18 = _nativeToUsdScaled18(lzFeeSourceNative, srcNativeUsdKey);
        uint256 lzFeeOnDestNative = _usdScaled18ToNative(lzFeeUsd18, dstNativeUsdKey);

        // 6) Compute final native available on destination AFTER fees (protocol + LZ)
        // This is the amount that the destination bridge will receive to either send native or swap to desired token.
        require(dstNativeAfterProtocol > lzFeeOnDestNative, "fees exceed value");
        uint256 dstNativeToRelease = dstNativeAfterProtocol - lzFeeOnDestNative;

        // small safety buffer (same approach used on-chain)
        dstNativeToRelease = (dstNativeToRelease * 995) / 1000;

        // 7) Compute protocol fee converted to source-native for reporting total fee in source native:
        // protocolFeeDestNative -> USD18 -> source native
        uint256 protocolFeeUsd18 = _nativeToUsdScaled18(protocolFeeDestNative, dstNativeUsdKey); // dest-native -> USD18
        uint256 protocolFeeSourceNative = _usdScaled18ToNative(protocolFeeUsd18, srcNativeUsdKey); // USD18 -> source-native

        // 8) totalFeeSourceNative = lzFeeSourceNative (what LZ expects) + protocolFeeSourceNative (what bridge keeps)
        totalFeeSourceNative = lzFeeSourceNative + protocolFeeSourceNative;

        // 9) minAmountOutDestNative is the final native amount that the destination receives and can swap/send
        minAmountOutDestNative = dstNativeToRelease;

        // Return: total fee (in source native) and min amount out (in destination native)
        return (totalFeeSourceNative, minAmountOutDestNative);
    }

    // ---------- Acquire funds & compute payload ----------
    function sendFromHedera(BridgeParams calldata p)
        external
        payable
        nonReentrant
    {
        // 1) Acquire USD value (scaled18)
        uint256 usdScaled18;

        if (p.tokenIn == address(0)) {
            // native HBAR provided via msg.value
            require(msg.value > 0, "must send HBAR as msg.value");
            // convert native -> USD scaled18
            usdScaled18 = _nativeToUsdScaled18(msg.value, p.srcNativeUsdKey);
        } else {
            // pull token from user
            IERC20(p.tokenIn).safeTransferFrom(msg.sender, address(this), p.amountIn);

            // choose path
            address[] memory usedPath;
            if (p.pathToWHBAR.length > 0) {
                usedPath = p.pathToWHBAR;
            } else {
                address[] storage storedPath = tokenToPath[p.tokenIn];
                usedPath = new address[](storedPath.length);
                for (uint i = 0; i < storedPath.length; i++) {
                    usedPath[i] = storedPath[i];
                }
            }
            require(usedPath.length >= 2, "swap path not provided");

            // approve and swap tokenIn -> wrappedNative
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

            // compute USD using token feed
            usdScaled18 = _tokenAmountToUsdScaled18(p.amountIn, p.tokenDecimals, p.tokenUsdKey);
        }

        // 2) USD -> destination-native raw
        uint256 nativeOnBDestRaw = _usdScaled18ToNative(usdScaled18, p.dstNativeUsdKey);

        // 3) protocol fee in dest native
        uint256 protocolFeeDestNative = (nativeOnBDestRaw * uint256(protocolFeeBps)) / 10000;
        uint256 nativeAfterProtocol = nativeOnBDestRaw - protocolFeeDestNative;

        // 4) estimate LayerZero fee (in source native)
        bytes memory payloadForEstimate = abi.encode(
            p.toAddressPacked,
            nativeOnBDestRaw,
            p.dstDesiredToken,
            p.minAmountOut
        );
        (uint256 lzFeeSourceNative, ) = lzEndpoint.estimateFees(
            p.dstChainId,
            address(this),
            payloadForEstimate,
            false,
            p.adapterParams
        );

        // 5) convert lzFeeSourceNative -> dest-native equivalent via USD
        (uint256 srcNativePrice, uint8 srcNativePriceDecimals) = _getPrice(p.srcNativeUsdKey);
        (uint256 dstNativePrice, uint8 dstNativePriceDecimals) = _getPrice(p.dstNativeUsdKey);

        uint256 lzFeeUsd18 = (lzFeeSourceNative * srcNativePrice) / (10 ** srcNativePriceDecimals);
        uint256 lzFeeOnDestNative = (lzFeeUsd18 * (10 ** dstNativePriceDecimals)) / dstNativePrice;

        // 6) final native to release on dest after fees
        require(nativeAfterProtocol > lzFeeOnDestNative, "fees exceed value");
        uint256 nativeToRelease = nativeAfterProtocol - lzFeeOnDestNative;
        nativeToRelease = (nativeToRelease * 995) / 1000; // safety buffer

        // 7) Ensure contract has enough source-native to pay LZ fee
        require(address(this).balance >= lzFeeSourceNative, "insufficient contract native for LZ fee");

        // 8) Bookkeeping: protocol fee -> source-native approx
        uint256 protocolFeeUsd18 = (protocolFeeDestNative * dstNativePrice) / (10 ** dstNativePriceDecimals);
        uint256 protocolFeeSourceNative = (protocolFeeUsd18 * (10 ** srcNativePriceDecimals)) / srcNativePrice;
        if (protocolFeeSourceNative > 0) feeReserveHBAR += protocolFeeSourceNative;

        // 9) Build final payload and send
        bytes memory finalPayload = abi.encode(
            p.toAddressPacked,
            nativeToRelease,
            p.dstDesiredToken,
            p.minAmountOut
        );

        lzEndpoint.send{value: lzFeeSourceNative}(
            p.dstChainId,
            p.dstBridgePacked,
            finalPayload,
            payable(address(this)),
            address(0),
            p.adapterParams
        );

        emit BridgePrepared(
            msg.sender,
            p.tokenIn,
            p.amountIn,
            p.dstChainId,
            p.dstBridgePacked,
            p.toAddressPacked,
            nativeToRelease,
            protocolFeeSourceNative,
            lzFeeSourceNative
        );
    }


    // ---------- Receive Handler for inbound LayerZero messages ----------
    // payload: abi.encode(toPacked, nativeAmountOnThisChain, dstDesiredToken, minAmountOut)
    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64, /*_nonce*/
        bytes memory _payload
    ) internal override {
        // 1) Trusted remote check (LzApp provides trustedRemoteLookup)
        bytes memory trusted = trustedRemoteLookup[_srcChainId];
        if (trusted.length != 0) {
            require(keccak256(trusted) == keccak256(_srcAddress), "invalid source");
        }

        // 2) decode
        (bytes memory toPacked, uint256 nativeAmount, address dstDesiredToken, uint256 minAmountOut) = abi.decode(_payload, (bytes, uint256, address, uint256));

        // 3) decode recipient address (supports abi.encodePacked(address))
        address recipient;
        if (toPacked.length == 20) {
            assembly { recipient := mload(add(toPacked, 20)) }
        } else {
            recipient = abi.decode(toPacked, (address));
        }

        // 4) deliver: if native requested, transfer native; else swap native->desired token and send token to recipient
        if (dstDesiredToken == address(0)) {
            // deliver native
            require(address(this).balance >= nativeAmount, "insufficient contract native");
            (bool ok,) = payable(recipient).call{value: nativeAmount}("");
            require(ok, "native send failed");
            return;
        }

        // swap native -> desired token using configured destPathFromWrapped[dstDesiredToken]
        address[] memory path = destPathFromWrapped[dstDesiredToken];
        require(path.length >= 2, "dest swap path not configured");
        // path[0] must be wrappedNative

        // wrap native into wrappedNative
        IWrappedNative(wrappedNative).deposit{value: nativeAmount}();

        // approve router to spend wrappedNative
        IERC20(wrappedNative).safeIncreaseAllowance(address(router), nativeAmount);

        // compute expected out and fallback minOut
        uint[] memory amountsOut = router.getAmountsOut(nativeAmount, path);
        uint256 expectedOut = amountsOut[amountsOut.length - 1];
        uint256 minOut = minAmountOut > 0 ? minAmountOut : (expectedOut * 995) / 1000;

        // perform swap to recipient
        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(nativeAmount, minOut, path, recipient, block.timestamp + 300);
    }

    // ---------- Admin Withdraw Functions ----------
    /**
     * @notice Withdraw native HBAR from contract
     * @param to The recipient address
     * @param amount The amount of HBAR to withdraw
     */
    function withdrawNative(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "invalid recipient");
        require(address(this).balance >= amount, "insufficient balance");

        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    /**
     * @notice Withdraw ERC20 tokens from the contract
     * @param token The token address
     * @param to The recipient address
     * @param amount The amount of tokens to withdraw
     */
    function withdrawERC20(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(0), "invalid token");
        require(to != address(0), "invalid recipient");
        IERC20(token).safeTransfer(to, amount);
    }

    // allow contract to receive native HBAR
    receive() external payable {}
}
