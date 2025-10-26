import { NextRequest, NextResponse } from "next/server";
import { JsonRpcProvider, Contract, formatUnits } from "ethers";
import {
  Client,
  AccountBalanceQuery,
  TokenId,
} from "@hashgraph/sdk";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

export async function POST(req: NextRequest) {
  try {
    const { chainId, address, tokenAddress } = await req.json();

    if (!chainId || !address)
      return NextResponse.json({ error: "Missing required parameters (chainId, address)" }, { status: 400 });

    // ===============================================================
    // 🔹 CASE 1: EVM NETWORKS (Ethereum / BSC)
    // ===============================================================
    if (chainId !== "hedera") {
        let rpcUrl = "";
        if (chainId === "ethereum") rpcUrl = "https://sepolia.drpc.org";
        else if (chainId === "bsc") rpcUrl = "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
        else return NextResponse.json({ error: "Unsupported chainId" }, { status: 400 });

        const provider = new JsonRpcProvider(rpcUrl);

        // ✅ Native balance
        const nativeBalanceWei = await provider.getBalance(address);
        const nativeBalance = Number(nativeBalanceWei) / 1e18;

        // ✅ ERC20 token balance (if provided)
        let tokenBalance = null;
        if (tokenAddress) {
            const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
            const [rawBal, decimals] = await Promise.all([
                tokenContract.balanceOf(address),
                tokenContract.decimals(),
            ]);
            tokenBalance = parseFloat(formatUnits(rawBal, decimals));
        }
        return NextResponse.json({
            network: chainId,
            nativeBalance,
            tokenBalance,
        });
    }

    // ===============================================================
    // 🔹 CASE 2: HEDERA
    // ===============================================================
    const privateKey = process.env.POC_WITHDRAW_KEY;
    const operatorId = "0.0.6987678";

    if (!privateKey)
      return NextResponse.json({ error: "Missing Hedera private key" }, { status: 500 });

    const client = Client.forTestnet().setOperator(operatorId, privateKey);

    // ✅ Query native & HTS balances
    const query = new AccountBalanceQuery().setAccountId(address);
    const balance = await query.execute(client);

    const nativeBalance = Number(balance.hbars.toTinybars()) / 1e8;

    let tokenBalance = null;
    if (tokenAddress) {
      const tokenId = TokenId.fromString(tokenAddress);
      // tokens may be null, use optional chaining on tokens before calling get
      tokenBalance = balance.tokens?.get(tokenId)?.toNumber() ?? 0;
    }
    if(tokenBalance > 0){
        tokenBalance /= 1e6
    }

    return NextResponse.json({
      network: "hedera",
      nativeBalance,
      tokenBalance,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("❌ Balance check error:", err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    console.error("❌ Unknown error:", err);
    return NextResponse.json({ error: "Balance query failed" }, { status: 500 });
  }
}
