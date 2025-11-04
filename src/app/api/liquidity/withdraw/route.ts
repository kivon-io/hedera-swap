import { NextRequest, NextResponse } from "next/server";
import {
  Client,
  AccountId,
  PrivateKey,
  TransferTransaction,
} from "@hashgraph/sdk";
import { safeHbar } from "@/helpers/token";
import { sendWithdrawalAdmin } from "@/helpers/bridge";

const REMOTE = "http://104.248.47.146/api";

// ⚙️ Environment configuration

const OPERATOR_ID = "0.0.6987678"; // Your treasury account (same as operator)
const PRIVATE_KEY = process.env.POC_WITHDRAW_KEY;

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
  try {
    const { recipient, amount, type } = await req.json();

    // --- Basic validation ---
    if (!recipient || !amount) {
      return NextResponse.json(
        { error: "Recipient and amount are required." },
        { status: 400 }
      );
    }

    if (!PRIVATE_KEY || !PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Missing liquidity wallet configuration on server." },
        { status: 500 }
      );
    }

    const hbarValue = parseFloat(amount);
    if (isNaN(hbarValue) || hbarValue <= 0) {
      return NextResponse.json(
        { error: "Invalid withdrawal amount." },
        { status: 400 }
      );
    }
  
    // --- Hedera client setup ---
    const client = Client.forTestnet().setOperator(
        AccountId.fromString(OPERATOR_ID),
        PrivateKey.fromStringECDSA(PRIVATE_KEY || '') // Assuming another key for SDK
    );

    // --- Build transfer transaction ---
    const amountInHbar = safeHbar(amount);
    const senderId = AccountId.fromString(OPERATOR_ID);
    const recipientId = AccountId.fromString(recipient);

    console.log(`💸 Withdrawing ${amountInHbar.toString()} HBAR to ${recipientId.toString()}...`);

    const txResponse = await new TransferTransaction()
      .addHbarTransfer(senderId, amountInHbar.negated())
      .addHbarTransfer(recipientId, amountInHbar)
      .execute(client);

    // --- Wait for receipt ---
    const receipt = await txResponse.getReceipt(client);
    const status = receipt.status.toString();
    const txId = txResponse.transactionId.toString();

    console.log(`✅ Withdrawal complete — Status: ${status} | TxId: ${txId}`);

    // Optionally notify your bridge server
    sendWithdrawalAdmin(REMOTE, { amount: hbarValue, type: type, recipient: recipient });

    return NextResponse.json(
      {
        status: "Withdrawal Confirmed",
        message: `Liquidity withdrawal confirmed.`,
        hash: txId,
        hederaStatus: status,
        success:true
      },
      { status: 200 }
    );
  } catch (error: unknown) {
        console.error("❌ Withdrawal error:", error);

        let details = "Unknown error";

        if (error instanceof Error) {
            // Standard JS errors
            details = error.message;
        } else if (
            typeof error === "object" &&
            error !== null &&
            "reason" in error &&
            typeof (error as Record<string, unknown>).reason === "string"
        ) {
            // Handle custom "reason" property (e.g., from smart contracts)
            details = (error as Record<string, string>).reason;
        }

        return NextResponse.json(
            {
            error: "Hedera withdrawal failed.",
            details,
            },
            { status: 500 }
        );
    }
}
