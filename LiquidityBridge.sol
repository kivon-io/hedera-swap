// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
 LiquidityBridge.sol
 - Each chain deploys an instance for a specific ERC20 token (e.g., USDT)
 - Vault holds actual token liquidity. Users deposit on source chain; destination vault releases.
 - Uses LayerZero NonblockingLzApp pattern for safe cross-chain receive.
*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Import LayerZero abstract app from their examples (adjust import path to your installed lib)
import "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

contract LiquidityBridge is NonblockingLzApp, Ownable, ReentrancyGuard {
    IERC20 public token;                // ERC20 token that this vault handles (e.g. USDT)
    uint16 public chainIdLz;            // LayerZero chain id for this chain (optional store)
    mapping(uint16 => bytes) public trustedRemoteLookup; // trusted remote addresses mapping

    event LiquidityAdded(address indexed provider, uint256 amount);
    event LiquidityRemoved(address indexed provider, uint256 amount);
    event BridgeSent(address indexed from, uint16 dstChainId, bytes dstAddress, address to, uint256 amount, uint256 feePaid);
    event BridgeReleased(uint16 srcChain, bytes srcAddress, address to, uint256 amount);

    constructor(address _endpoint, address _token) NonblockingLzApp(_endpoint) {
        token = IERC20(_token);
    }

    /* ========== USER-FACING: deposit & bridge ========== */

    /**
     * @notice deposit tokens into this vault and request release on dst chain
     * @param _dstChainId LayerZero dst chain id (uint16)
     * @param _dstBridgeAddress abi-encoded address of the destination bridge (bytes)
     * @param _toAddress recipient address bytes. Usually abi.encodePacked(recipientAddress)
     * @param _amount amount of tokens to bridge
     * @param _adapterParams adapter params for LayerZero (e.g., receive gas)
     * NOTE: msg.value should include LayerZero message fee (estimation required off-chain)
     */
    function sendViaBridge(
        uint16 _dstChainId,
        bytes calldata _dstBridgeAddress,
        bytes calldata _toAddress,
        uint256 _amount,
        bytes calldata _adapterParams
    ) external payable nonReentrant {
        require(_amount > 0, "Zero amount");

        // 1) transfer tokens from user into this vault (increase chainA vault)
        require(token.transferFrom(msg.sender, address(this), _amount), "transferFrom failed");

        // 2) build payload for destination release
        // payload contains: destination recipient bytes, amount
        bytes memory payload = abi.encode(_toAddress, _amount);

        // 3) send LayerZero message to destination bridge contract
        // user pays msg.value for the LayerZero fee. _lzSend will forward this to endpoint.
        _lzSend(_dstChainId, payload, payable(msg.sender), address(0x0), _adapterParams, msg.value);

        emit BridgeSent(msg.sender, _dstChainId, _dstBridgeAddress, abi.decode(_toAddress, (address)), _amount, msg.value);
    }

    /* ========== LayerZero receive handler ========== */
    // _nonblockingLzReceive called by NonblockingLzApp after verification.
    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 /*_nonce*/,
        bytes memory _payload
    ) internal override {
        // payload = abi.encode(toAddressBytes, amount)
        (bytes memory toAddressBytes, uint256 amount) = abi.decode(_payload, (bytes, uint256));
        address to = abi.decode(toAddressBytes, (address));

        // Security check: optional - ensure the srcAddress matches a trusted remote mapping
        bytes memory trustedRemote = trustedRemoteLookup[_srcChainId];
        if (trustedRemote.length > 0) {
            require(keccak256(trustedRemote) == keccak256(_srcAddress), "Invalid remote");
        }

        // Release tokens from this chain's vault to recipient
        require(token.balanceOf(address(this)) >= amount, "Insufficient liquidity");
        require(token.transfer(to, amount), "release transfer failed");

        emit BridgeReleased(_srcChainId, _srcAddress, to, amount);
    }

    /* ========== Admin: trusted remotes & liquidity management ========== */

    /// Set trusted remote contract for a chain (owner)
    function setTrustedRemote(uint16 _chainId, bytes calldata _remoteAddress) external onlyOwner {
        trustedRemoteLookup[_chainId] = _remoteAddress;
    }

    /// Owner can deposit more tokens as protocol liquidity (LP or treasury)
    function adminAddLiquidity(uint256 _amount) external nonReentrant onlyOwner {
        require(token.transferFrom(msg.sender, address(this), _amount), "transferFrom failed");
        emit LiquidityAdded(msg.sender, _amount);
    }

    /// Owner can remove liquidity for treasury management
    function adminRemoveLiquidity(address _to, uint256 _amount) external nonReentrant onlyOwner {
        require(token.balanceOf(address(this)) >= _amount, "Insufficient");
        require(token.transfer(_to, _amount), "transfer failed");
        emit LiquidityRemoved(_to, _amount);
    }

    // Convenience: supports withdrawing accidentally stuck ETH
    function withdrawETH(address payable to, uint256 amount) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "ETH withdraw failed");
    }

    // Override _blockingLzReceive if using Nonblocking pattern requires it (from example library)
    // (NonblockingLzApp already implements try/catch and _retry logic)
}
