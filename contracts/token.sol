// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract USDCToken is ERC20, Ownable {

    // The token uses 6 decimals, like USDC or other stablecoins
    uint8 private constant _DECIMALS = 6;

    /**
     * @dev Sets the token name, symbol, and assigns all administrative roles
     * (Admin, Minter, Pauser) to the contract deployer (msg.sender).
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    )
        // Initialize ERC20 with Name and Symbol
        ERC20(name, symbol)
        Ownable(msg.sender)
    {
        // Mint the initial supply to the deployer's address
        _mint(msg.sender, initialSupply * (10 ** decimals()));
    }

    // Override the ERC20 decimals function to set it to 6 instead of the default 18
    function decimals() public view virtual override returns (uint8) {
        return _DECIMALS;
    }

    // The mint function, callable only by addresses with the MINTER_ROLE
    function mint(address to, uint256 amount) public onlyOwner { 
        _mint(to, amount);
    }
}