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

import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

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

/// Generic Supra DORA adapter interface (pull model)
/// Adjust if Supra real contract uses different signature.
interface ISupraDora {
    // returns (price, decimals, timestamp)
    function getLatestPrice(bytes32 feedId) external view returns (int256 price, uint8 decimals, uint256 timestamp);
}

contract HederaBridgeSource is Ownable, NonblockingLzApp, ReentrancyGuard {
    // ---------- State ----------
    IRouter public router;                 // DEX router on Hedera
    address public wrappedNative;          // WHBAR address
    ISupraDora public supraOracle;         // Supra DORA adapter contract

    // protocol fee (bps), e.g., 25 = 0.25%
    uint16 public protocolFeeBps = 25;
    uint16 public constant MAX_PROTOCOL_FEE_BPS = 500; // 5%

    // fee reserve stored in source-native (HBAR) for bookkeeping and to pay LZ fees
    uint256 public feeReserveHBAR;

    // mapping of “symbolic keys” to Supra feed IDs (owner sets these)
    // e.g., keccak256("USDT/USD") => feedId bytes32
    mapping(bytes32 => bytes32) public feedIds;

    // mapping token => swap path (token => ... -> wrappedNative) used when swapping token -> wrappedNative
    mapping(address => address[]) public tokenToPath;

    // mapping destination native swap paths (wrappedNative -> desiredToken) used on receive side
    mapping(address => address[]) public destPathFromWrapped; // key: desired token -> path (wrappedNative, desired)

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
    event FeedSet(bytes32 key, bytes32 feedId);
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
        supraOracle = ISupraDora(_supraOracle);
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

    function setFeedId(bytes32 key, bytes32 feedId) external onlyOwner {
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
    function _getPrice(bytes32 key) internal view returns (uint256 price, uint8 decimals) {
        bytes32 feedId = feedIds[key];
        require(feedId != bytes32(0), "feedId not set");
        (int256 p, uint8 d, ) = supraOracle.getLatestPrice(feedId);
        require(p > 0, "invalid price");
        return (uint256(p), d);
    }

    /// Convert token amount to USD scaled to 18 decimals
    function _tokenAmountToUsdScaled18(uint256 amount, uint8 tokenDecimals, bytes32 tokenUsdKey) internal view returns (uint256 usd18) {
        (uint256 price, uint8 priceDecimals) = _getPrice(tokenUsdKey); // price: e.g., 1 USDT => 1 * 10^priceDecimals
        // usd = amount * price / 10^tokenDecimals
        // normalize to 18 decimals: usd18 = (amount * price * 10^(18 - priceDecimals)) / (10^tokenDecimals)
        uint256 numerator = amount * price;
        if (18 + priceDecimals >= tokenDecimals) {
            usd18 = (numerator * (10 ** (18 + priceDecimals - tokenDecimals))) / (10 ** priceDecimals);
        } else {
            // extremely unlikely; fallback
            usd18 = (numerator) / (10 ** (tokenDecimals - priceDecimals - 18));
        }
    }

    /// Convert native amount (source native HBAR) to USD scaled18
    function _nativeToUsdScaled18(uint256 nativeAmount, bytes32 nativeUsdKey) internal view returns (uint256 usd18) {
        (uint256 price, uint8 priceDecimals) = _getPrice(nativeUsdKey);
        // usd18 = (nativeAmount * price * 10^(18 - priceDecimals)) / 1e18  (native assumed 1e18)
        if (priceDecimals <= 18) {
            usd18 = (nativeAmount * price * (10 ** (18 - priceDecimals))) / (10 ** 18);
        } else {
            // fallback
            usd18 = (nativeAmount * price) / (10 ** (priceDecimals - 18) * (10 ** 18) / (10 ** 18));
        }
    }

    /// Convert USD scaled18 to destination native (dest native assumed uses price decimals in feed)
    function _usdScaled18ToNative(uint256 usd18, bytes32 dstNativeUsdKey) internal view returns (uint256 nativeAmount) {
        (uint256 dstPrice, uint8 dstPriceDecimals) = _getPrice(dstNativeUsdKey);
        // native = (usd18 * 10^dstPriceDecimals) / dstPrice
        nativeAmount = (usd18 * (10 ** dstPriceDecimals)) / dstPrice;
    }

    // ---------- Acquire funds & compute payload ----------
    /**
     * @notice Main send function on Hedera: accept native or token, compute dest-native to release, deduct fees, and send LayerZero message.
     *
     * @param tokenIn address(0) if user sends native (HBAR); otherwise ERC20/HTS token address
     * @param amountIn amount of tokenIn (ignored if tokenIn==address(0) — use msg.value)
     * @param tokenDecimals decimals of tokenIn (needed for USD conversion)
     * @param dstChainId destination chain id (LayerZero)
     * @param dstBridgePacked abi.encodePacked(destinationBridgeAddress) - used by lzEndpoint.send
     * @param toAddressPacked recipient address bytes on destination chain (e.g., abi.encodePacked(userAddr))
     * @param dstDesiredToken desired token on destination chain (address(0) == native)
     * @param minAmountOut min amount out for dest swap (slippage guard, optional)
     * @param pathToWHBAR path for tokenIn -> wrappedNative (if tokenIn != 0)
     * @param adapterParams LayerZero adapterParams (destination gas)
     * @param tokenUsdKey supra feed key token/USD (bytes32)
     * @param srcNativeUsdKey supra feed key source-native/USD (HBAR/USD)
     * @param dstNativeUsdKey supra feed key dest-native/USD (e.g., ETH/USD)
     */
    function sendFromHedera(
        address tokenIn,
        uint256 amountIn,
        uint8 tokenDecimals,
        uint16 dstChainId,
        bytes calldata dstBridgePacked,
        bytes calldata toAddressPacked,
        address dstDesiredToken,
        uint256 minAmountOut,
        address[] calldata pathToWHBAR,
        bytes calldata adapterParams,
        bytes32 tokenUsdKey,
        bytes32 srcNativeUsdKey,
        bytes32 dstNativeUsdKey
    ) external payable nonReentrant {
        // 1) Acquire USD value (scaled18)
        uint256 usdScaled18;

        if (tokenIn == address(0)) {
            // native HBAR provided via msg.value
            require(msg.value > 0, "must send HBAR as msg.value");
            // convert native -> USD scaled18
            usdScaled18 = _nativeToUsdScaled18(msg.value, srcNativeUsdKey);
        } else {
            // pull token from user
            require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "transferFrom failed");

            // swap tokenIn -> wrappedNative using configured path (or provided path)
            address[] memory usedPath;

            if (pathToWHBAR.length > 0) {
                usedPath = pathToWHBAR;
            } else {
                address[] storage storedPath = tokenToPath[tokenIn];
                usedPath = new address[](storedPath.length);
                for (uint i = 0; i < storedPath.length; i++) {
                    usedPath[i] = storedPath[i];
                }
            }
            require(usedPath.length >= 2, "swap path not provided");

            // approve router
            IERC20(tokenIn).approve(address(router), amountIn);

            // execute swap: tokenIn -> wrappedNative
            router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amountIn,
                0,
                usedPath,
                address(this),
                block.timestamp + 300
            );

            // unwrap wrappedNative -> native
            uint256 whbal = IERC20(wrappedNative).balanceOf(address(this));
            require(whbal > 0, "zero WHBAR after swap");
            IWrappedNative(wrappedNative).withdraw(whbal); // unwrap -> increases native balance

            // compute USD using token feed
            usdScaled18 = _tokenAmountToUsdScaled18(amountIn, tokenDecimals, tokenUsdKey);
        }

        // 2) USD -> destination-native raw
        uint256 nativeOnBDestRaw = _usdScaled18ToNative(usdScaled18, dstNativeUsdKey);

        // 3) protocol fee in dest native
        uint256 protocolFeeDestNative = (nativeOnBDestRaw * uint256(protocolFeeBps)) / 10000;
        uint256 nativeAfterProtocol = nativeOnBDestRaw - protocolFeeDestNative;

        // 4) estimate LayerZero fee (in source native) using final payload shape (best-effort)
        bytes memory payloadForEstimate = abi.encode(toAddressPacked, nativeOnBDestRaw, dstDesiredToken, minAmountOut);
        (uint256 lzFeeSourceNative, ) = lzEndpoint.estimateFees(dstChainId, address(this), payloadForEstimate, false, adapterParams);

        // 5) convert lzFeeSourceNative -> dest-native equivalent via USD cross-rate
        (uint256 srcNativePrice, uint8 srcNativePriceDecimals) = _getPrice(srcNativeUsdKey);
        (uint256 dstNativePrice, uint8 dstNativePriceDecimals) = _getPrice(dstNativeUsdKey);

        // lzFee USD scaled18:
        uint256 lzFeeUsd18 = (lzFeeSourceNative * srcNativePrice) / (10 ** srcNativePriceDecimals);
        uint256 lzFeeOnDestNative = (lzFeeUsd18 * (10 ** dstNativePriceDecimals)) / dstNativePrice;

        // 6) final native to release on dest after fees
        require(nativeAfterProtocol > lzFeeOnDestNative, "fees exceed value");
        uint256 nativeToRelease = nativeAfterProtocol - lzFeeOnDestNative;
        // small safety buffer
        nativeToRelease = (nativeToRelease * 995) / 1000;

        // 7) Ensure this contract has enough source-native to pay LZ fee (we pay from contract balance)
        require(address(this).balance >= lzFeeSourceNative, "insufficient contract native for LZ fee");

        // 8) Bookkeeping: convert protocolFeeDestNative -> source-native (approx via USD) and add to feeReserveHBAR
        uint256 protocolFeeUsd18 = (protocolFeeDestNative * dstNativePrice) / (10 ** dstNativePriceDecimals);
        uint256 protocolFeeSourceNative = (protocolFeeUsd18 * (10 ** srcNativePriceDecimals)) / srcNativePrice;
        if (protocolFeeSourceNative > 0) feeReserveHBAR += protocolFeeSourceNative;

        // 9) Build final payload (toPacked, nativeToRelease (dest-native units), dstDesiredToken, minAmountOut)
        bytes memory finalPayload = abi.encode(toAddressPacked, nativeToRelease, dstDesiredToken, minAmountOut);

        // 10) Send via LayerZero, paying lz fee from contract balance (external payable)
        lzEndpoint.send{value: lzFeeSourceNative}(
            dstChainId,
            dstBridgePacked,
            finalPayload,
            payable(address(this)), // refund address on failure
            address(0),
            adapterParams
        );

        emit BridgePrepared(msg.sender, tokenIn, amountIn, dstChainId, dstBridgePacked, toAddressPacked, nativeToRelease, protocolFeeSourceNative, lzFeeSourceNative);

        // 11) refund extra native if user sent more than required (for native deposit)
        if (tokenIn == address(0)) {
            uint256 extra = msg.value - amountIn;
            if (extra > 0) {
                (bool refunded,) = payable(msg.sender).call{value: extra}("");
                require(refunded, "refund failed");
            }
        }
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
        IERC20(wrappedNative).approve(address(router), nativeAmount);

        // compute expected out and fallback minOut
        uint[] memory amountsOut = router.getAmountsOut(nativeAmount, path);
        uint256 expectedOut = amountsOut[amountsOut.length - 1];
        uint256 minOut = minAmountOut > 0 ? minAmountOut : (expectedOut * 995) / 1000;

        // perform swap to recipient
        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(nativeAmount, minOut, path, recipient, block.timestamp + 300);
    }

    // allow contract to receive native HBAR
    receive() external payable {}
}
