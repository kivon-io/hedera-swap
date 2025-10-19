import { NextRequest, NextResponse } from "next/server";
import { Wallet, JsonRpcProvider, Contract } from "ethers"; 

// Minimal ABI for the 'withdraw' function only
const VAULT_ABI = [
  "function withdraw(address to, uint256 nativeAmount, address token, uint256 tokenAmount) external",
  // Add the event for better confirmation logging
  "event WithdrawExecuted(address indexed to, uint256 nativeAmount, address indexed token, uint256 tokenAmount)"
];

export async function POST(req: NextRequest) {
  console.log("API hit with method: POST");

  try {
    const { 
      chainId, 
      contractAddress, 
      recipient, 
      nativeAmount, 
      tokenAddress, 
      tokenAmount 
    } = await req.json(); // Parse JSON body

    // --- Basic Input Validation ---
    if (!contractAddress || !recipient || !chainId) {
      return NextResponse.json(
        { error: "Missing required parameters (contractAddress, recipient, or chainId)." },
        { status: 400 }
      );
    }

    // --- 1. Select the correct RPC URL based on the chainId ---
    let rpcUrl = "";
    if (chainId === "ethereum") { // Using your frontend string keys
      rpcUrl = "https://sepolia.infura.io";
    } else if (chainId === "hedera") {
      rpcUrl = "https://testnet.hashio.io/api";
    } else if (chainId === "bsc") {
      rpcUrl = "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
    } else {
      return NextResponse.json(
        { error: "Unsupported chainId" },
        { status: 400 }
      );
    }

    if (!rpcUrl) {
      return NextResponse.json(
        { error: `RPC URL not configured for chain: ${chainId}` },
        { status: 500 }
      );
    }

    // --- 2. Setup Signer using the Admin's Private Key ---
    const privateKey = process.env.POC_WITHDRAW_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: "Admin private key not configured." },
        { status: 500 }
      );
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const signer = new Wallet(privateKey, provider);

    // --- 3. Interact with the Contract ---
    const vaultContract = new Contract(contractAddress, VAULT_ABI, signer);

    console.log(
      `Executing withdrawal on ${chainId} for ${nativeAmount} native and ${tokenAmount} token to ${recipient}...`
    );

    // Call the withdraw function
    const tx = await vaultContract.withdraw(
      recipient,
      nativeAmount,
      tokenAddress || "0x0000000000000000000000000000000000000000", // fallback address
      tokenAmount
    );

    // --- 4. Success Response: Return the Transaction Hash Immediately ---
    return NextResponse.json(
      {
        status: "Transaction Submitted",
        message: `Withdrawal transaction successfully sent to the network.`,
        hash: tx.hash,
      },
      { status: 202 } // Use 202 Accepted
    );

  } catch (error: any) {
    console.error(`Withdrawal Error:`, error.message || error);
    return NextResponse.json(
      {
        error: "Transaction failed or timed out during submission.",
        details: error.reason || error.message,
      },
      { status: 500 }
    );
  }
}
