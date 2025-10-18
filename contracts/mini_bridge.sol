// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal imports — expects OpenZeppelin contracts to be available in your environment
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Native & ERC20 deposit/withdraw contract with admin-only withdrawals
contract Vault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice an admin address allowed to call withdraws (owner can set)
    address public admin;

    /// @notice events
    event NativeDeposited(address indexed from, uint256 amount, uint256 contractBalance);
    event ERC20Deposited(address indexed token, address indexed from, uint256 amount, uint256 contractBalance);
    event WithdrawExecuted(address indexed to, uint256 nativeAmount, address indexed token, uint256 tokenAmount);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);

    constructor() Ownable(msg.sender){
        admin = msg.sender; 
        emit AdminUpdated(address(0), msg.sender);
    }

    /// @notice Only callable by admin
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    /* ========== DEPOSITS ========== */

    /// @notice Receive native tokens (ETH/HBL/BNB...). Emits NativeDeposited.
    receive() external payable {
        emit NativeDeposited(msg.sender, msg.value, address(this).balance);
    }

    /// @notice Alternate payable deposit function that returns contract balance after deposit.
    /// @return contractBalance the contract native token balance after deposit
    function depositNative() external payable returns (uint256 contractBalance) {
        require(msg.value > 0, "Must send >0");
        contractBalance = address(this).balance;
        emit NativeDeposited(msg.sender, msg.value, contractBalance);
    }

    /// @notice Deposit ERC20 tokens into contract. Caller must `approve` this contract first.
    /// @param token ERC20 token address
    /// @param amount amount of token to deposit (in token's smallest unit)
    /// @return contractTokenBalance balance of token in contract after deposit
    function depositERC20(address token, uint256 amount) external returns (uint256 contractTokenBalance) {
        require(token != address(0), "token address zero");
        require(amount > 0, "amount must be >0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        contractTokenBalance = IERC20(token).balanceOf(address(this));
        emit ERC20Deposited(token, msg.sender, amount, contractTokenBalance);
    }

    /* ========== WITHDRAWALS (ADMIN ONLY) ========== */

    /// @notice Withdraw native and/or an ERC20 token from contract to a recipient.
    /// @dev Either nativeAmount or tokenAmount can be zero. For no ERC20 transfer pass token = address(0) or tokenAmount = 0.
    /// @param to recipient address (for native transfers this should be payable)
    /// @param nativeAmount amount of native token to send (in wei)
    /// @param token ERC20 token address to send; pass address(0) or set tokenAmount=0 to skip token transfer
    /// @param tokenAmount amount of ERC20 token to send (in token smallest unit)
    /// @return sentNative whether native transfer succeeded (true if nativeAmount == 0 or transfer succeeded)
    /// @return sentToken whether ERC20 transfer succeeded (true if tokenAmount == 0 or transfer succeeded)
    function withdraw(
        address payable to,
        uint256 nativeAmount,
        address token,
        uint256 tokenAmount
    )
        external
        nonReentrant
        onlyAdmin
        returns (bool sentNative, bool sentToken)
    {
        require(to != address(0), "recipient zero");

        // Native transfer (if requested)
        if (nativeAmount > 0) {
            require(address(this).balance >= nativeAmount, "insufficient native balance");
            // using call to forward gas and avoid gas limit issues
            (sentNative, ) = to.call{value: nativeAmount}("");
            require(sentNative, "native transfer failed");
        } else {
            sentNative = true; // nothing to send, treat as success
        }

        // ERC20 transfer (if requested)
        if (tokenAmount > 0) {
            require(token != address(0), "token zero address");
            IERC20 erc = IERC20(token);
            uint256 curBal = erc.balanceOf(address(this));
            require(curBal >= tokenAmount, "insufficient token balance");
            erc.safeTransfer(to, tokenAmount);
            sentToken = true;
        } else {
            sentToken = true; // nothing to send, treat as success
        }

        // FIX: The 'to' parameter is 'address payable', but the event 'WithdrawExecuted' expects a plain 'address' as its first argument.
        // We need to explicitly cast 'to' back to 'address' for the event, though in this case it might be safer to cast only when calling the event
        // because the 'to' parameter is used for a payable call above. Let's cast it for the event argument.
        emit WithdrawExecuted(address(to), nativeAmount, token, tokenAmount);
    }

    /* ========== ADMIN MANAGEMENT ========== */

    /// @notice Owner can set the admin address
    /// @param newAdmin new admin address
    function setAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "admin zero");
        address old = admin;
        admin = newAdmin;
        emit AdminUpdated(old, newAdmin);
    }

    /* ========== VIEW HELPERS ========== */

    /// @notice Get contract native balance
    function nativeBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Get balance of an ERC20 token held by this contract
    /// @param token ERC20 token address
    function erc20Balance(address token) external view returns (uint256) {
        if (token == address(0)) return 0;
        return IERC20(token).balanceOf(address(this));
    }

    /* ========== RECOVERY (OWNER) ========== */

    /// @notice Emergency rescue for ERC20 stuck in contract — only owner
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "to zero");
        require(token != address(0), "token zero");
        IERC20(token).safeTransfer(to, amount);
    }

    /// @notice Emergency rescue for native tokens — only owner
    function rescueNative(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "to zero");
        (bool s, ) = to.call{value: amount}("");
        require(s, "rescue native failed");
    }
}