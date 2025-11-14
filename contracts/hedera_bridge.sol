// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 1. Define the necessary HTS interface (only includes the function we need)
interface IHederaTokenService {
    // transferFrom on Hedera takes int64 amount and returns an int response code.
    function transferFrom(
        address token,   
        address sender, 
        address receiver, 
        int64 amount
    ) external returns (int responseCode);
}

// 2. Define the success code locally, since we can't import HederaResponseCodes.sol
int constant HEDERA_SUCCESS = 22; 

// 3. Main Bridge contract (no inheritance)
contract Bridge { 
    /* ========== STATE VARIABLES & INTERFACE INSTANCE ========== */
    
    // Fixed address for the Hedera Token Service Precompile (0x167)
    IHederaTokenService constant HTS = IHederaTokenService(address(0x167)); 
    
    // Structs, Events, and Function Signatures use the HTS-standard int64 for amount
    event BridgeDeposit(
        string indexed nonce,
        address indexed from,
        address indexed tokenFrom,
        int64 amount, 
        address to,
        address tokenTo,
        address poolAddress,
        uint64 desChain
    );

    event PoolAddressUpdated(address indexed oldPool, address indexed newPool);

    struct Deposit {
        bool status;
        address tokenFrom;
        address tokenTo;
        int64 amount; 
        address to;
        address depositor;
        address pool;
        uint256 timestamp;
        uint64 desChain;
    }

    mapping(string => Deposit) public deposits;
    address public owner;
    address public poolAddress;
    uint256 private _locked = 1;

    /* ========== MODIFIERS ========== */

    modifier nonReentrant() {
        require(_locked == 1, "Reentrant call");
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor(address _poolAddress) {
        require(_poolAddress != address(0), "invalid pool");
        owner = msg.sender;
        poolAddress = _poolAddress;
    }

    /* ========== CORE FUNCTIONALITY ========== */

    /// @notice Deposit HBAR or HTS tokens and forward to pool address.
    function bridgeDeposit(
        address tokenFrom,
        address tokenTo,
        address to,
        int64 amount, 
        string calldata nonce,
        uint64 desChain
    ) external payable nonReentrant {
        require(bytes(nonce).length > 0, "nonce required");
        require(to != address(0), "invalid to address");
        require(poolAddress != address(0), "pool not set");
        require(!deposits[nonce].status, "nonce already used");
        require(amount > 0, "amount must be positive");

        if (tokenFrom == address(0)) {
            // Native HBAR deposit
            // Use msg.value and safely compare it to the int64 amount
            uint256 nativeAmount = uint256(uint64(amount));
            require(msg.value == nativeAmount, "msg.value must equal amount for HBAR");

            (bool sent, ) = payable(poolAddress).call{value: nativeAmount}("");
            require(sent, "HBAR transfer to pool failed");
        } else {
            // HTS token deposit (Hedera version of ERC20)
            require(msg.value == 0, "Do not send HBAR when depositing HTS");
            
            // Direct call using the HTS interface instance
            int response = HTS.transferFrom( 
                tokenFrom,
                msg.sender,
                poolAddress,
                amount // int64 amount
            );

            require(
                response == HEDERA_SUCCESS, // Check against HEDERA_SUCCESS (0)
                "HTS transfer failed"
            );
        }

        // Store deposit
        deposits[nonce] = Deposit({
            status: true,
            tokenFrom: tokenFrom,
            tokenTo: tokenTo,
            amount: amount,
            to: to,
            depositor: msg.sender,
            pool: poolAddress,
            timestamp: block.timestamp,
            desChain: desChain
        });

        emit BridgeDeposit(
            nonce,
            msg.sender,
            tokenFrom,
            amount,
            to,
            tokenTo,
            poolAddress,
            desChain
        );
    }

    /* ========== ADMIN UTILITIES ========== */

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        owner = newOwner;
    }

    function setPoolAddress(address newPool) external onlyOwner {
        require(newPool != address(0), "invalid pool");
        address oldPool = poolAddress;
        poolAddress = newPool;
        emit PoolAddressUpdated(oldPool, newPool);
    }

    function isActive(string calldata nonce) external view returns (bool) {
        return deposits[nonce].status;
    }

    receive() external payable { 
        revert("Use bridgeDeposit for HBAR deposits");
    }
}