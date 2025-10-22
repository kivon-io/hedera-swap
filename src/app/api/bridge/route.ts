import { Contract, JsonRpcProvider, Wallet } from "ethers"
import { NextRequest, NextResponse } from "next/server"
import {
  Client,
  ContractExecuteTransaction,
  AccountId,
  PrivateKey,
} from "@hashgraph/sdk"

/* eslint-disable @typescript-eslint/no-explicit-any */

// Minimal ABIs
const VAULT_ABI = [
  "function withdraw(address to, uint256 nativeAmount, address token, uint256 tokenAmount) external",
  "event WithdrawExecuted(address indexed to, uint256 nativeAmount, address indexed token, uint256 tokenAmount)",
]

const VAULT_ABI2 = [
  "function withdraw(address to, uint256 nativeAmount, address token, int64 tokenAmount) external",
  "event WithdrawExecuted(address indexed to, uint256 nativeAmount, address indexed token, int64 tokenAmount)",
]

export async function POST(req: NextRequest) {
  console.log("API hit with method: POST")

  try {
    const { chainId, contractAddress, recipient, nativeAmount, tokenAddress, tokenAmount } =
      await req.json()

    if (!contractAddress || !recipient || !chainId) {
      return NextResponse.json(
        { error: "Missing required parameters (contractAddress, recipient, or chainId)." },
        { status: 400 }
      )
    }

    // === HEDERA BRANCH === //
    if (chainId === "hedera") {
      console.log("Processing Hedera transaction via SDK...")

      const operatorId = '0.0.6987678'
      const operatorKey = process.env.POC_WITHDRAW_KEY

      if (!operatorId || !operatorKey) {
        return NextResponse.json(
          { error: "Missing Hedera operator credentials." },
          { status: 500 }
        )
      }

      // Initialize Hedera client
      const client = Client.forTestnet()
      client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromString(operatorKey))

      // Encode ABI call for withdraw(to, nativeAmount, token, tokenAmount)
      const iface = new Contract(contractAddress, VAULT_ABI2)
      const functionCall = iface.interface.encodeFunctionData("withdraw", [
        recipient,
        nativeAmount,
        tokenAddress || "0x0000000000000000000000000000000000000000",
        tokenAmount,
      ])

      // Execute contract function
      const tx = await new ContractExecuteTransaction()
        .setContractId(contractAddress)
        .setGas(2_000_000)
        .setFunctionParameters(Buffer.from(functionCall.slice(2), "hex"))
        .execute(client)

      const receipt = await tx.getReceipt(client)
      const txHash = Buffer.from(tx.transactionId.toString()).toString("hex")

      console.log("✅ Hedera transaction executed:", receipt.status.toString())

      return NextResponse.json(
        {
          status: "Transaction Submitted",
          message: `Withdrawal transaction sent on Hedera.`,
          hash: tx.transactionId.toString(),
          statusMsg: receipt.status.toString(),
        },
        { status: 202 }
      )
    }

    // === EVM BRANCH (Ethereum, BSC, etc.) === //
    let rpcUrl = ""
    if (chainId === "ethereum") {
      rpcUrl = "https://sepolia.drpc.org"
    } else if (chainId === "bsc") {
      rpcUrl = "https://data-seed-prebsc-1-s1.bnbchain.org:8545"
    } else {
      return NextResponse.json({ error: "Unsupported chainId" }, { status: 400 })
    }

    const privateKey = process.env.POC_WITHDRAW_KEY
    if (!privateKey) {
      return NextResponse.json({ error: "Admin private key not configured." }, { status: 500 })
    }

    const provider = new JsonRpcProvider(rpcUrl)
    const signer = new Wallet(privateKey, provider)

    const vaultContract = new Contract(contractAddress, VAULT_ABI, signer)

    console.log(
      `Executing withdrawal on ${chainId} for ${nativeAmount} native and ${tokenAmount} token to ${recipient}...`
    )

    const tx = await vaultContract.withdraw(
      recipient,
      nativeAmount,
      tokenAddress || "0x0000000000000000000000000000000000000000",
      tokenAmount
    )

    console.log(`✅ EVM transaction hash: ${tx.hash}`)

    return NextResponse.json(
      {
        status: "Transaction Submitted",
        message: `Withdrawal transaction sent on ${chainId}`,
        hash: tx.hash,
      },
      { status: 202 }
    )
  } catch (error: any) {
    console.error(`❌ Withdrawal Error:`, error)
    return NextResponse.json(
      {
        error: "Transaction failed or timed out during submission.",
        details: error.reason || error.message,
      },
      { status: 500 }
    )
  }
}
