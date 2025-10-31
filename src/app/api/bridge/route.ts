import { ethers } from "ethers";
import { NextRequest, NextResponse } from "next/server";
import {
    Client,
    PrivateKey,
    AccountId,
    Hbar,
    TransferTransaction
} from "@hashgraph/sdk";
import { getEvmAddressFromAccountId, convertHederaIdToEVMAddress } from "@/helpers";
import { safeHbar } from "@/helpers/token"

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- CONTRACT ABIS (Minimal for Router and WHBAR) ---
const routerAbi = [
    "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)",
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)"
];
const whbarAbi = [
    "function token() view returns (address)" // IWHBAR.token()
];

// --- Environment Variables (Required for Swap) ---
const RPC = 'https://testnet.hashio.io/api';
const ROUTER = '0x0000000000000000000000000000000000004b40';
const WHBAR_CONTRACT = '0x0000000000000000000000000000000000003ad1';
const PRIVATE_KEY = process.env.POC_WITHDRAW_KEY; // EVM key for swap wallet
const OPERATOR_ID = "0.0.6987678"; // Hedera ID for HBAR transfer



if (!RPC || !ROUTER || !WHBAR_CONTRACT || !PRIVATE_KEY || !OPERATOR_ID) {
    console.error("Missing required environment variables for Hedera operations.");
    // This is a common pattern in production, but we'll let the error handler catch it in the function.
}


export async function POST(req: NextRequest) {
    try {
        const {
            recipient, // Hedera Account ID or EVM Address
            amount,    // Amount of HBAR (in string HBAR units, e.g., "1.0")
            tokenAddress, // Target token EVM Address (TOKEN_OUT in the old script)
            isNative   // boolean: true for HBAR transfer, false for token swap
        } = await req.json();

        // 1. INPUT VALIDATION
        if (!RPC || !PRIVATE_KEY || !OPERATOR_ID) {
            return NextResponse.json({ error: "Server configuration missing: RPC URL or Admin Keys." }, { status: 500 });
        }

        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return NextResponse.json({ error: "Invalid amount provided." }, { status: 400 });
        }

        if (!recipient) {
            return NextResponse.json({ error: "Recipient address is required." }, { status: 400 });
        }
        if (!isNative && !tokenAddress) {
             return NextResponse.json({ error: "Token address is required for non-native swap." }, { status: 400 });
        }
        
        // --- Shared Client Setup for Hedera SDK ---
        const client = Client.forTestnet().setOperator(
            AccountId.fromString(OPERATOR_ID),
            PrivateKey.fromStringECDSA(PRIVATE_KEY || '') // Assuming another key for SDK
        );
        
        // ----------------------------------------------------------------
        // 🔹 CASE 1: NATIVE HBAR TRANSFER (Hashgraph SDK)
        // ----------------------------------------------------------------
        if (isNative) {
            console.log(`💸 Executing native HBAR transfer to ${recipient}...`);
            const amountInHbar =  safeHbar(amount);
            const senderId = AccountId.fromString(OPERATOR_ID);
            const recipientId = AccountId.fromString(recipient);

            const tx = await new TransferTransaction()
                .addHbarTransfer(senderId, amountInHbar.negated())
                .addHbarTransfer(recipientId, amountInHbar)
                .execute(client);

            const receipt = await tx.getReceipt(client);
            const txHash = tx.transactionId.toString();

            console.log(`The hbar amount sent ${amountInHbar}`)

            return NextResponse.json(
                {
                    status: "Transfer Confirmed",
                    message: `Native HBAR transfer confirmed. Status: ${receipt.status.toString()}`,
                    hash: txHash,
                },
                { status: 202 }
            );
        }

        // ----------------------------------------------------------------
        // 🔹 CASE 2: TOKEN SWAP (ethers.js via RPC)
        // ----------------------------------------------------------------
        
        console.log(`🔄 Executing HBAR -> Token Swap on Hedera EVM...`);
        const provider = new ethers.JsonRpcProvider(RPC);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        const router = new ethers.Contract(ROUTER, routerAbi, wallet);
        const whbar = new ethers.Contract(WHBAR_CONTRACT, whbarAbi, provider);
        const TOKEN_OUT = convertHederaIdToEVMAddress(tokenAddress); 

        // 1) Resolve whbar token address (the token pair token, not the wrapper contract)
        const whbarToken = await whbar.token();
        console.log("Resolved whbar token address:", whbarToken);

        // 2) Prepare swap parameters
        const amountInHBAR = amount;

        console.log(`amount to be swapped ${amountInHBAR}`)
        const amountIn = ethers.parseUnits(Number(amountInHBAR).toString(), 18); // HBAR decimals (use 18)
        const path = [whbarToken, TOKEN_OUT];

        // 3) Get amount out to calculate slippage (using 0.5% slippage)
        const amounts = await router.getAmountsOut(amountIn, path);

        console.log(`estimated amount out ${amounts}`)
        if (!amounts || amounts.length === 0) {
            throw new Error("getAmountsOut failed — likely no liquidity or broken path.");
        }
        
        const slippage = 0.005; // 0.5%
        const amountOutMin = amounts[1] - (amounts[1] * BigInt(Math.floor(slippage * 1000)) / BigInt(1000));

        console.log(`estimated amount min out ${amountOutMin}`)

        // NOTE: If recipient is a Hedera Account ID (0.0.x), you must convert it to an EVM address (0x...) here.
        // Assuming 'recipient' is already a valid EVM address (0x...). If it's a 0.0.x ID, use a helper like getEvmAddressFromAccountId.
        const to = await getEvmAddressFromAccountId(recipient, client);
        const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes

        console.log("Token address", TOKEN_OUT);
        console.log("user address", to);

        // 4) Execute swapExactETHForTokens
        const tx = await router.swapExactETHForTokens(
            0,
            path,
            to,
            deadline,
            {
                value: amountIn,
                gasLimit: BigInt(1000000), 
            }
        );

        console.log("Tx submitted:", tx.hash);
        
        // Wait for confirmation (optional, but good for an API response)
        const receipt = await tx.wait();

        return NextResponse.json(
            {
                status: "Swap Confirmed",
                message: `Swap HBAR -> ${TOKEN_OUT} confirmed.`,
                hash: receipt.hash,
                block: receipt.blockNumber,
            },
            { status: 202 }
        );

    } catch (error: any) {
        console.error(`❌ Transaction Error:`, error);
        // Attempt to extract helpful error details
        const details = error?.reason || error?.data || error?.message || "Unknown error";
        
        return NextResponse.json(
            {
                error: `Hedera Transaction Failed.`,
                details: details,
            },
            { status: 500 }
        );
    }
}