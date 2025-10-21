// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "https://github.com/hashgraph/hedera-smart-contracts/blob/main/contracts/system-contracts/hedera-token-service-v2/HederaTokenService.sol";
import "https://github.com/hashgraph/hedera-smart-contracts/blob/main/contracts/system-contracts/hedera-token-service-v2/IHederaTokenService.sol";
import "https://github.com/hashgraph/hedera-smart-contracts/blob/main/contracts/system-contracts/hedera-token-service-v2/HederaResponseCodes.sol";

contract USDCTokenHTS is HederaTokenService {
    address public owner;
    address public tokenAddress;
    string public name;
    string public symbol;
    int32 public decimals;
    int64 public totalSupply;

    mapping(address => mapping(address => int64)) private _allowances;

    // ERC20 events
    event Transfer(address indexed from, address indexed to, int64 value);
    event Approval(address indexed owner, address indexed spender, int64 value);

    constructor(
        string memory _name,
        string memory _symbol
    ) {
        owner = msg.sender;
        name = _name;
        symbol = _symbol;
        decimals = 6; // like USDC

        IHederaTokenService.HederaToken memory token;
        token.name = _name;
        token.symbol = _symbol;
        token.treasury = msg.sender;

        int64 _initialSupply = 75_000_000_000_000_000;

        (int responseCode, address createdToken) = HederaTokenService.createFungibleToken(
            token,
            _initialSupply,
            decimals
        );
        require(responseCode == HederaResponseCodes.SUCCESS, "Token creation failed");

        tokenAddress = createdToken;
        totalSupply = _initialSupply;
    }

    function mint(int64 amount) external {
        require(msg.sender == owner, "Only owner can mint");

        // HTS v2 expects bytes[] for metadata
        bytes[] memory metadata;

        // Mint tokens to the treasury (owner)
        (int response,,) = mintToken(tokenAddress, amount, metadata);
        require(response == HederaResponseCodes.SUCCESS, "Mint failed");

        // Emit Transfer event from 0x0 to treasury
        emit Transfer(address(0), msg.sender, amount);
    }

    // Fetch balance via ERC20 ABI call
    function balanceOf(address account) public view returns (uint256) {
        (bool success, bytes memory result) = tokenAddress.staticcall(
            abi.encodeWithSignature("balanceOf(address)", account)
        );
        require(success, "Failed to fetch balance");
        return abi.decode(result, (uint256));
    }

    function transfer(address to, int64 amount) external returns (bool) {
        int response = transferToken(tokenAddress, msg.sender, to, amount);
        require(response == HederaResponseCodes.SUCCESS, "Transfer failed");

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, int64 amount) external returns (bool) {
        require(_allowances[from][msg.sender] >= amount, "Allowance exceeded");
        _allowances[from][msg.sender] -= amount;

        int response = transferToken(tokenAddress, from, to, amount);
        require(response == HederaResponseCodes.SUCCESS, "Transfer failed");

        emit Transfer(from, to, amount);
        return true;
    }

    function approve(address spender, int64 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function allowance(address ownerAddr, address spender) external view returns (int64) {
        return _allowances[ownerAddr][spender];
    }
}
