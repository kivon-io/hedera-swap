// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
  HederaLiquidityBridge.sol

  - Liquidity-based bridge endpoint for Hedera (EVM-compatible)
  - Uses LayerZero for cross-chain messaging (NonblockingLzApp pattern)
  - Supports multi-token bridging via only swapping to/ from base token on this chain
  - Configurable per-token oracle (expects Chainlink-style AggregatorV3Interface)
  - Integrates with an AMM router (e.g., SaucerSwap) for swaps on Hedera
  - Admin must pre-fund baseToken liquidity (adminAddLiquidity)
  - Owner sets trusted remotes (chainId -> remoteBridgeAddress bytes)
  - Events emitted for monitoring / off-chain reconciliation
*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Chainlink Aggregator interface (common)
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

// Minimal AMM router interface (Uniswap-like / SaucerSwap router)
interface IRouter {
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline
    ) external;

    function swapExactTokensForTokens(
        uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline
    ) external returns (uint[] memory amounts);
}

// LayerZero NonblockingLzApp base (from layerzero solidity-examples)
// Adjust import path if you installed differently.
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

contract HederaLiquidityBridge is NonblockingLzApp, Ownable, ReentrancyGuard {
    /* ========== STATE ========== */

    // Base token of this chain (ERC20 - e.g., wrapped HBAR). Owner sets this at deployment.
    IERC20 public immutable baseToken;

    // Router used for swaps (SaucerSwap router). Set by owner.
    IRouter public router;

    // Mapping of allowed tokens (tokens front-end may expose)
    mapping(address => bool) public supportedToken; // token -> allowed

    // Token -> oracle address (owner sets)
    mapping(address => address) public tokenOracle;

    // Trusted remotes mapping (LayerZero security): srcChainId -> remoteBridgeAddress (abi-encoded bytes)
    mapping(uint16 => bytes) public trustedRemoteLookup;

    // Protocol fee (bps) when performing bridging (e.g., 25 = 0.25%). Deducted from amount on send.
    uint16 public protocolFeeBps = 25; // 0.25% default

    // Max protocol fee cap (for safety)
    uint16 public constant MAX_PROTOCOL_FEE_BPS = 500; // 5%

    // Events
    event SupportedTokenUpdated(address indexed token, bool enabled);
    event OracleSet(address indexed token, address indexed oracle);
    event RouterSet(address indexed router);
    event TrustedRemoteSet(uint16 indexed srcChain, bytes srcAddress);
    event BridgeSent(address indexed from, uint16 dstChain, bytes dstBridge, bytes toAddress, uint256 baseAmount, uint256 feePaid, uint256 protocolFee);
    event BridgeReceived(uint16 indexed srcChain, bytes srcAddress, address to, uint256 baseAmount, address targetToken, uint256 swappedAmount);
    event LiquidityAdded(address indexed provider, uint256 amount);
    event LiquidityRemoved(address indexed to, uint256 amount);
    event ProtocolFeeSet(uint16 feeBps);

    /* ========== CONSTRUCTOR ========== */

    /**
     * @param _endpoint LayerZero endpoint address on this chain
     * @param _baseToken address of the base token (ERC20) used on this chain (e.g., WHBAR)
     * @param _router AMM router address (e.g., SaucerSwap router)
     */
    constructor(address _endpoint, address _baseToken, address _router) NonblockingLzApp(_endpoint) {
        require(_endpoint != address(0), "endpoint zero");
        require(_baseToken != address(0), "base token zero");
        require(_router != address(0), "router zero");

        baseToken = IERC20(_baseToken);
        router = IRouter(_router);

        // Approve router to pull baseToken from this contract (large allowance)
        IERC20(_baseToken).approve(_router, type(uint256).max);
    }

    /* ========== ADMIN: CONFIG ========== */

    function setRouter(address _router) external onlyOwner {
        require(_router != address(0), "router zero");
        router = IRouter(_router);
        // ensure allowance
        IERC20(address(baseToken)).approve(_router, type(uint256).max);
        emit RouterSet(_router);
    }

    function setSupportedToken(address token, bool enabled) external onlyOwner {
        supportedToken[token] = enabled;
        emit SupportedTokenUpdated(token, enabled);
    }

    function setOracleForToken(address token, address oracle) external onlyOwner {
        tokenOracle[token] = oracle;
        emit OracleSet(token, oracle);
    }

    function setTrustedRemote(uint16 _srcChainId, bytes calldata _remoteBridgeAddress) external onlyOwner {
        trustedRemoteLookup[_srcChainId] = _remoteBridgeAddress;
        emit TrustedRemoteSet(_srcChainId, _remoteBridgeAddress);
    }

    function setProtocolFeeBps(uint16 feeBps) external onlyOwner {
        require(feeBps <= MAX_PROTOCOL_FEE_BPS, "fee too high");
        protocolFeeBps = feeBps;
        emit ProtocolFeeSet(feeBps);
    }

    /* ========== LIQUIDITY MANAGEMENT ========== */

    // Owner adds baseToken liquidity to the vault (contract must have allowance)
    function adminAddLiquidity(uint256 amount) external nonReentrant onlyOwner {
        require(amount > 0, "zero amount");
        require(IERC20(address(baseToken)).transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        emit LiquidityAdded(msg.sender, amount);
    }

    function adminRemoveLiquidity(address to, uint256 amount) external nonReentrant onlyOwner {
        require(to != address(0), "zero to");
        require(IERC20(address(baseToken)).balanceOf(address(this)) >= amount, "insufficient");
        require(IERC20(address(baseToken)).transfer(to, amount), "transfer failed");
        emit LiquidityRemoved(to, amount);
    }

    /* ========== USER-FACING: send/bridge ========== */

    /**
     * User calls this to bridge tokens from this chain to a destination chain.
     *
     * Steps:
     *  - if _token != baseToken, swap token -> baseToken using router (path supplied by caller)
     *  - take protocol fee (bps) from baseAmount
     *  - lock baseToken in this contract (it already does since tokens are transferred into contract)
     *  - send LayerZero message to destination bridge with payload:
     *      (recipientBytes, baseAmountAfterFee, dstToken) where dstToken = requested token on destination or zero-address for base
     *
     * Notes:
     *  - the caller must approve this contract to spend _token (if swapping)
     *  - caller must send msg.value equal to LayerZero message fee (estimate on frontend using endpoint.estimateFees)
     *
     * @param _token token user is depositing (address). Must be supported.
     * @param _amount amount of _token
     * @param _dstChainId LayerZero destination chain id (uint16)
     * @param _dstBridgeAddress abi.encodePacked(destinationBridgeAddress) (bytes)
     * @param _toAddressBytes recipient address on destination chain encoded as bytes (e.g., abi.encodePacked(recipientEvmAddress))
     * @param _minBaseOut minimum base token amount expected from swap (slippage protection)
     * @param _path swap path from _token -> baseToken (if _token != baseToken)
     * @param _dstDesiredToken address of target token on destination chain (or address(0) for base token)
     * @param _adapterParams LayerZero adapter params (e.g., version + dstGas) - supplied by frontend
     */
    function sendAndBridge(
        address _token,
        uint256 _amount,
        uint16 _dstChainId,
        bytes calldata _dstBridgeAddress,
        bytes calldata _toAddressBytes,
        uint256 _minBaseOut,
        address[] calldata _path,
        address _dstDesiredToken,
        bytes calldata _adapterParams
    ) external payable nonReentrant {
        require(_amount > 0, "zero amount");
        require(supportedToken[_token], "token not supported");

        uint256 baseReceived;

        if (_token == address(baseToken)) {
            // direct deposit of base token
            // transfer base token from user to this contract
            require(IERC20(_token).transferFrom(msg.sender, address(this), _amount), "transferFrom failed");
            baseReceived = _amount;
        } else {
            // token -> base swap flow
            // transfer token in, approve router if needed, swap token->base
            IERC20(_token).transferFrom(msg.sender, address(this), _amount);
            // ensure router approval for token
            IERC20(_token).approve(address(router), _amount);

            // path must start at _token and end at baseToken
            require(_path.length >= 2, "invalid path");
            require(_path[0] == _token, "path start mismatch");
            require(_path[_path.length - 1] == address(baseToken), "path must end with base");

            // perform swap (using swapExactTokensForTokens to get amountOut)
            uint[] memory amounts = router.getAmountsOut(_amount, _path);
            uint expectedOut = amounts[amounts.length - 1];
            require(expectedOut >= _minBaseOut, "insufficient output expected");
            // execute swap (supporting fee-on-transfer if needed)
            try router.swapExactTokensForTokens(_amount, _minBaseOut, _path, address(this), block.timestamp + 300) returns (uint[] memory out) {
                baseReceived = out[out.length - 1];
            } catch {
                // fallback to fee-on-transfer-compatible call
                router.swapExactTokensForTokensSupportingFeeOnTransferTokens(_amount, _minBaseOut, _path, address(this), block.timestamp + 300);
                // we cannot read output from this call reliably; read balance diffs
                baseReceived = IERC20(address(baseToken)).balanceOf(address(this));
            }
        }

        // compute protocol fee
        uint256 protocolFee = (baseReceived * protocolFeeBps) / 10000;
        uint256 baseAfterFee = baseReceived - protocolFee;

        // Base tokens remain in contract (liquidity). We encode payload for dest release.
        // payload: (toAddressBytes, baseAfterFee, dstDesiredToken)
        bytes memory payload = abi.encode(_toAddressBytes, baseAfterFee, _dstDesiredToken);

        // send via LayerZero. Caller must provide native fee via msg.value
        _lzSend(_dstChainId, payload, payable(msg.sender), address(0x0), _adapterParams, msg.value);

        emit BridgeSent(msg.sender, _dstChainId, _dstBridgeAddress, _toAddressBytes, baseAfterFee, msg.value, protocolFee);
    }

    /* ========== LayerZero receive handler ========== */

    // _nonblockingLzReceive guaranteed only called by LayerZero endpoint (NonblockingLzApp)
    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal override {
        // validate trusted source if configured
        bytes memory trusted = trustedRemoteLookup[_srcChainId];
        if (trusted.length != 0) {
            require(keccak256(trusted) == keccak256(_srcAddress), "HederaBridge: remote not trusted");
        }

        // decode payload
        (bytes memory toAddressBytes, uint256 baseAmount, address dstDesiredToken) = abi.decode(_payload, (bytes, uint256, address));
        // decode recipient address from bytes (assume EVM address packed)
        address recipient;
        // Accept both raw address bytes and abi-encoded address
        if (toAddressBytes.length == 20) {
            // raw packed address
            assembly {
                recipient := mload(add(toAddressBytes, 20))
            }
        } else {
            // assume abi-encoded address (32 bytes)
            recipient = abi.decode(toAddressBytes, (address));
        }

        // now process release. If dstDesiredToken == address(0) -> deliver baseToken.
        if (dstDesiredToken == address(0) || dstDesiredToken == address(baseToken)) {
            // Release base token directly
            require(IERC20(address(baseToken)).balanceOf(address(this)) >= baseAmount, "insufficient liquidity");
            require(IERC20(address(baseToken)).transfer(recipient, baseAmount), "transfer failed");
            emit BridgeReceived(_srcChainId, _srcAddress, recipient, baseAmount, dstDesiredToken, baseAmount);
            return;
        }

        // else we need to swap baseToken -> dstDesiredToken using router
        // require router path is configured on-chain off-chain (we will attempt to build [baseToken, dstDesiredToken])
        address;
        path[0] = address(baseToken);
        path[1] = dstDesiredToken;

        // ensure we have enough baseToken to perform swap
        require(IERC20(address(baseToken)).balanceOf(address(this)) >= baseAmount, "insufficient liquidity for swap");
        // approve router (already approved in ctor)
        // For safety: ensure router has approval for base token (owner ensures)
        // execute swap
        IERC20(address(baseToken)).approve(address(router), baseAmount);

        // attempt swap, reading amounts out
        try router.getAmountsOut(baseAmount, path) returns (uint[] memory amountsOut) {
            uint expectedOut = amountsOut[amountsOut.length - 1];
            // do the swap
            try router.swapExactTokensForTokens(baseAmount, expectedOut * 995 / 1000, path, recipient, block.timestamp + 300) returns (uint[] memory out) {
                uint swapped = out[out.length - 1];
                emit BridgeReceived(_srcChainId, _srcAddress, recipient, baseAmount, dstDesiredToken, swapped);
                return;
            } catch {
                // fallback to supporting fee-on-transfer
                router.swapExactTokensForTokensSupportingFeeOnTransferTokens(baseAmount, 0, path, recipient, block.timestamp + 300);
                // we cannot read output; emit with baseAmount as proxied
                emit BridgeReceived(_srcChainId, _srcAddress, recipient, baseAmount, dstDesiredToken, 0);
                return;
            }
        } catch {
            // if router.getAmountsOut failed, do best-effort swap with minOut 0
            router.swapExactTokensForTokensSupportingFeeOnTransferTokens(baseAmount, 0, path, recipient, block.timestamp + 300);
            emit BridgeReceived(_srcChainId, _srcAddress, recipient, baseAmount, dstDesiredToken, 0);
            return;
        }
    }

    /* ========== HELPERS: price, safety ========== */

    // Get token USD price using configured oracle (Chainlink-style). Returns price with oracle decimals (caller must interpret).
    function getPriceFromOracle(address token) public view returns (int256 price, uint8 decimals) {
        address oracle = tokenOracle[token];
        require(oracle != address(0), "oracle not set");
        AggregatorV3Interface feed = AggregatorV3Interface(oracle);
        (, int256 answer, , , ) = feed.latestRoundData();
        uint8 d = feed.decimals();
        return (answer, d);
    }

    // Utility for owner to rescue ERC20 accidentally sent
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero to");
        require(IERC20(token).transfer(to, amount), "transfer failed");
    }

    // receive fallback for native (not used often on Hedera EVM)
    receive() external payable {}
}
