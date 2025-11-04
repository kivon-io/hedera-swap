"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet, useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import { TransferTransaction, Hbar } from "@hashgraph/sdk";

interface LiquidityHistoryItem {
  amount: number;
  status: string;
  txId: string;
}

interface UserLiquidityData {
  total_liquidity: number;
  profit: number;
  history: LiquidityHistoryItem[];
}

const POOL_ADDRESS = "0.0.6987678";

export default function LiquidityDashboard() {
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [profit, setProfit] = useState(0);
  // const [history, setHistory] = useState<LiquidityHistoryItem[]>([]);

  const { signer, isConnected } = useWallet();
  const { data: accountId } = useAccountId();

  const isWalletReady = isConnected && signer && accountId;

  // ✅ Safely fetch user liquidity data
  async function fetchUserData(): Promise<void> {
    if (!accountId) return;
    try {
      const res = await fetch(`/api/liquidity/history?wallet_address=${accountId}`);
      if (!res.ok) throw new Error(`Failed to fetch data: ${res.status}`);
      const data: UserLiquidityData = await res.json();
      setBalance(data.total_liquidity ?? 0);
      setProfit(data.profit ?? 0);
      // setHistory(data.history ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error occurred";
      console.error("Error fetching user data:", message);
      setTxStatus(`❌ ${message}`);
    }
  }

  useEffect(() => {
    if (accountId) fetchUserData();
  }, [accountId, fetchUserData]);

  // ✅ Add liquidity safely
  async function handleAddLiquidity(): Promise<void> {
    if (!isWalletReady) {
      setTxStatus("⚠️ Please connect your Hedera wallet first.");
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setTxStatus("⚠️ Enter a valid HBAR amount.");
      return;
    }

    setIsProcessing(true);
    setTxStatus("Preparing Hedera transaction...");

    try {
      const hederaSigner = signer; 
      const hbarAmount = new Hbar(amt);

      const tx = new TransferTransaction()
      // @ts-expect-error HWBridgeSigner is compatible at runtime
        .addHbarTransfer(hederaSigner.getAccountId(), hbarAmount.negated())
        .addHbarTransfer(POOL_ADDRESS, hbarAmount);
      // @ts-expect-error HWBridgeSigner is compatible at runtime
      const signedTx = await tx.freezeWithSigner(hederaSigner);
      // @ts-expect-error HWBridgeSigner is compatible at runtime
      const result = await signedTx.executeWithSigner(hederaSigner);

      setTxStatus("Transaction sent! Recording data");

      // ✅ Notify backend
      const backendRes = await fetch("/api/liquidity/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: accountId,
          amount: amt,
          txId: result.transactionId.toString(),
        }),
      });

      if (!backendRes.ok)
        throw new Error(`Backend returned ${backendRes.status}`);

      setTxStatus("✅ Liquidity added successfully!");
      setAmount("");
      await fetchUserData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error occurred";
      console.error("Error adding liquidity:", message);
      setTxStatus(`❌ Failed to add liquidity: ${message}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setTxStatus(null), 8000);
    }
}



  // ✅ Withdraw profit safely
  async function handleWithdrawProfit(): Promise<void> {
    if (!accountId) {
      setTxStatus("⚠️ Wallet not connected.");
      return;
    }

    setIsProcessing(true);
    setTxStatus("Processing withdrawal...");

    try {
      const res = await fetch("/api/liquidity/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: accountId }),
      });

      if (!res.ok) throw new Error(`Withdraw failed with ${res.status}`);

      const data: { success?: boolean } = await res.json();
      if (data.success) {
        setTxStatus("✅ Profit withdrawn successfully!");
        await fetchUserData();
      } else {
        setTxStatus("❌ Withdrawal failed.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error occurred";
      console.error("Withdraw error:", message);
      setTxStatus(`❌ ${message}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setTxStatus(null), 8000);
    }
  }


  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-6 text-center text-purple-700">
        Liquidity Dashboard
      </h1>

      <div className="max-w-3xl mx-auto grid gap-6">
        {/* Add Liquidity Section */}
        <Card className="p-6 shadow-md rounded-2xl bg-white">
          <h2 className="text-lg font-semibold mb-4 text-purple-700">
            Add Liquidity
          </h2>

          <Label htmlFor="amount">Amount (HBAR)</Label>
          <Input
            id="amount"
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-2"
          />

          <Button
            className="mt-4 w-full bg-purple-600 hover:bg-purple-700"
            onClick={handleAddLiquidity}
            disabled={!isWalletReady || isProcessing}
          >
            {isProcessing ? "Processing..." : "Add Liquidity"}
          </Button>

          {!isConnected && (
            <p className="text-red-500 text-sm mt-3">
              ⚠️ Wallet not connected. Please connect HashPack.
            </p>
          )}
        </Card>

        {/* Balances & Profit Section */}
        <Card className="p-6 shadow-md rounded-2xl bg-white">
          <h2 className="text-lg font-semibold mb-4 text-purple-700">
            Your Summary
          </h2>

          <p className="text-gray-700 mb-2">
            <strong>Wallet ID:</strong> {accountId || "Not connected"}
          </p>
          <p className="text-gray-700 mb-2">
            <strong>Total Liquidity:</strong> {balance.toFixed(3)} HBAR
          </p>
          <p className="text-gray-700 mb-4">
            <strong>Profit:</strong> {profit.toFixed(3)} HBAR
          </p>

          {/* <Button
            variant="outline"
            onClick={handleWithdrawProfit}
            disabled={isProcessing || profit <= 0}
          >
            Withdraw Profit
          </Button> */}
        </Card>

        {/* History Section */}
        {/* <Card className="p-6 shadow-md rounded-2xl bg-white">
          <h2 className="text-lg font-semibold mb-4 text-purple-700">
            Liquidity History
          </h2>

          {history.length === 0 ? (
            <p className="text-gray-500 text-sm">No liquidity history yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Amount</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-left">TxID</th>
                </tr>
              </thead>
              <tbody>
                {history.map((tx) => (
                  <tr key={tx.txId} className="border-b">
                    <td className="py-2">{tx.amount} HBAR</td>
                    <td className="py-2">{tx.status}</td>
                    <td className="py-2 text-gray-500">{tx.txId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card> */}
      </div>

      {/* Transaction status banner */}
      {txStatus && (
        <p
          className={`fixed bottom-5 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded text-sm ${
            txStatus.startsWith("✅")
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {txStatus}
        </p>
      )}
    </main>
  );
}
