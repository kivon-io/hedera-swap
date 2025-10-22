import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { NextRequest, NextResponse } from "next/server";
import {
  Client,
  ContractExecuteTransaction,
  PrivateKey,
  AccountId,
} from "@hashgraph/sdk";

/* eslint-disable @typescript-eslint/no-explicit-any */

const VAULT_ABI = [
  "function withdraw(address to, uint256 nativeAmount, address token, uint256 tokenAmount) external",
  "event WithdrawExecuted(address indexed to, uint256 nativeAmount, address indexed token, uint256 tokenAmount)",
];

const VAULT_ABI2 = [
  "function withdraw(address to, uint256 nativeAmount, address token, int64 tokenAmount) external",
  "event WithdrawExecuted(address indexed to, uint256 nativeAmount, address indexed token, int64 tokenAmount)",
];

export async function POST(req: NextRequest) {
  console.log("🚀 API hit with method: POST");

  try {
    const {
      chainId,
      contractAddress,
      recipient,
      nativeAmount,
      tokenAddress,
      tokenAmount,
    } = await req.json();

    if (!contractAddress || !recipient || !chainId) {
      return NextResponse.json(
        { error: "Missing required parameters (contractAddress, recipient, or chainId)." },
        { status: 400 }
      );
    }

    const privateKey = process.env.POC_WITHDRAW_KEY;
    const operatorId = "0.0.6987678";

    if (!privateKey) {
      return NextResponse.json(
        { error: "Admin private key not configured." },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------------
    // 🔹 Case 1: Ethereum / BSC → use ethers.js
    // ----------------------------------------------------------------
    if (chainId !== "hedera") {
      let rpcUrl = "";
      if (chainId === "ethereum") rpcUrl = "https://sepolia.drpc.org";
      else if (chainId === "bsc")
        rpcUrl = "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
      else
        return NextResponse.json({ error: "Unsupported chainId" }, { status: 400 });

      const provider = new JsonRpcProvider(rpcUrl);
      const signer = new Wallet(privateKey, provider);

      const vaultContract = new Contract(contractAddress, VAULT_ABI, signer);
      console.log(`📤 Executing withdrawal on ${chainId}...`);

      const tx = await vaultContract.withdraw(
        recipient,
        nativeAmount,
        tokenAddress || "0x0000000000000000000000000000000000000000",
        tokenAmount
      );

      return NextResponse.json(
        {
          status: "Transaction Submitted",
          message: "Withdrawal transaction successfully sent to EVM network.",
          hash: tx.hash,
        },
        { status: 202 }
      );
    }

    // ----------------------------------------------------------------
    // 🔹 Case 2: Hedera → use Hashgraph SDK
    // ----------------------------------------------------------------
    if (!operatorId) {
      return NextResponse.json(
        { error: "Missing Hedera operator ID." },
        { status: 500 }
      );
    }

    const client = Client.forTestnet().setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(privateKey)
    );

    console.log("📤 Executing Hedera withdraw...");

    const tx = await new ContractExecuteTransaction()
      .setContractId(contractAddress) // must be a valid CONTRACT ID like 0.0.xxxxx
      .setGas(2_000_000)
      .setFunction(
        "withdraw",
        Buffer.from(
          // Manual ABI encoding since we are using evm-style params
          JSON.stringify({
            to: recipient,
            nativeAmount: nativeAmount,
            token: tokenAddress,
            tokenAmount: tokenAmount,
          })
        )
      )
      .freezeWith(client)
      .sign(PrivateKey.fromString(privateKey));

    const submit = await tx.execute(client);
    const txHash = submit.transactionId.toString();

    return NextResponse.json(
      {
        status: "Transaction Submitted",
        message: "Withdrawal transaction sent to Hedera network.",
        hash: txHash,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error(`❌ Withdrawal Error:`, error);
    return NextResponse.json(
      {
        error: "Transaction failed or timed out during submission.",
        details: error.reason || error.message,
      },
      { status: 500 }
    );
  }
}
