// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

interface IRouter {
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline
    ) external;
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}


contract HederaBridgeSource is NonblockingLzApp, Ownable, ReentrancyGuard {
    IRouter public router;
    address public wrappedNative; // WHBAR address
    uint16 public protocolFeeBps = 25; // e.g. 0.25%

    // Track collected HBAR fees
    uint256 public feeReserveHBAR;

    constructor(address _lzEndpoint, address _router, address _wrappedNative)
        NonblockingLzApp(_lzEndpoint)
    {
        router = IRouter(_router);
        wrappedNative = _wrappedNative;
    }

    event BridgeSentHedera(address indexed user, uint256 baseAmountAfterFee, uint256 protocolFee);

    /**
     * @notice User calls this on Hedera to bridge either native HBAR or an HTS/ERC-20 token.
     * @param tokenIn address of token if sending a token; or address(0) to indicate HBAR via msg.value
     * @param amountIn amount of tokenIn (if tokenIn != 0). If tokenIn == 0, user should send HBAR via msg.value.
     * @param dstChainId destination chain ID (EVM chain)
     * @param dstBridge packed address of dest bridge contract on that chain
     * @param toAddressBytes recipient address on destination chain (packed)
     * @param dstDesiredToken token user wants on dest (native or ERC20)
     * @param pathToWHBAR swap path (if tokenIn != 0) ending in wrappedNative
     * @param adapterParams LayerZero adapter params
     */
    function sendFromHedera(
        address tokenIn,
        uint256 amountIn,
        uint16 dstChainId,
        bytes calldata dstBridge,
        bytes calldata toAddressBytes,
        address dstDesiredToken,
        address[] calldata pathToWHBAR,
        bytes calldata adapterParams
    ) external payable nonReentrant {
        uint256 baseHBAR = 0;

        if (tokenIn == address(0)) {
            // Native HBAR case
            require(msg.value >= amountIn, "must send HBAR via msg.value");
            baseHBAR = amountIn;
        } else {
            // Token case: user transferring token, then swap → WHBAR, then unwrap → HBAR
            require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "transferFrom failed");
            IERC20(tokenIn).approve(address(router), amountIn);

            // Use router to swap tokenIn → WHBAR
            router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amountIn,
                0,             // minOut can be passed as 0 for now or use slippage param
                pathToWHBAR,
                address(this),
                block.timestamp + 300
            );

            // Now contract holds WHBAR, unwrap to HBAR
            uint256 whbarBal = IERC20(wrappedNative).balanceOf(address(this));
            require(whbarBal > 0, "swap to WHBAR failed");

            // call withdraw on WHBAR to unwrap to native HBAR
            (bool ok,) = wrappedNative.call(abi.encodeWithSignature("withdraw(uint256)", whbarBal));
            require(ok, "unwrap WHBAR failed");

            baseHBAR = whbarBal;
        }

        // Deduct protocol fee
        uint256 protocolFee = (baseHBAR * protocolFeeBps) / 10000;
        uint256 baseAfterFee = baseHBAR - protocolFee;

        // Accumulate protocol fee to reserve
        feeReserveHBAR += protocolFee;

        emit BridgeSentHedera(msg.sender, baseAfterFee, protocolFee);

        // Prepare payload for LayerZero
        bool isNativeFlag = true;  // since we always convert to HBAR (native)
        bytes memory payload = abi.encode(
            toAddressBytes,
            baseAfterFee,
            isNativeFlag,
            dstDesiredToken
        );

        // Estimate LayerZero fees
        (uint256 lzNativeFee, ) = lzEndpoint.estimateFees(
            dstChainId,
            address(this),
            payload,
            false,
            adapterParams
        );

        // Send via LayerZero — built-in logic in NonblockingLzApp
        // We'll pay the LZ fee via contract’s native balance (if available)
        require(address(this).balance >= lzNativeFee, "insufficient HBAR to pay messaging fee");

        _lzSend{value: lzNativeFee}(
            dstChainId,
            payload,
            payable(address(this)),
            address(0),
            adapterParams
        );

        // Any extra msg.value beyond amountIn (if native case) can be refunded
        if (tokenIn == address(0)) {
            uint256 extra = msg.value - amountIn;
            if (extra > 0) {
                (bool rf,) = payable(msg.sender).call{value: extra}("");
                require(rf, "refund failed");
            }
        }
    }

    // So contract can receive native HBAR for paying LZ fees or refunds
    receive() external payable {}
}
