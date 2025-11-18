"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useWallet, useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import { TransferTransaction, Hbar } from "@hashgraph/sdk";

//Hedera Contract
const POOL_ADDRESS = "0.0.6987678";
const ADMIN = "0.0.7096962"; 

export default function AdminPage() {
  const [hederaAmount, setHederaAmount] = useState("");
  const [balances, setBalances] = useState({ hedera: 0 });
  const [fees, setFees] = useState({ fee_pct: 0, lp_fee_pct: 0 });
  const [profit, setProfit] = useState(0);

  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const { signer, isConnected: isHederaConnected } = useWallet();
  const { data: accountId } = useAccountId();

  const isHederaWalletReady = isHederaConnected && signer && accountId;

  // ✅ Fetch balance
  async function fetchBalances() {
    setLoading(true);
    try {
      const res = await fetch("/api/getBalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: "hedera",
          address: POOL_ADDRESS,
        }),
      });

      const data = await res.json();
      setBalances({
        hedera: data.nativeBalance ?? 0,
      });
    } catch (err) {
      console.error("Error fetching balances:", err);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Fetch fees
  async function fetchFees() {
    try {
      const res = await fetch("/api/fee");
      const data = await res.json();
      setFees({
        fee_pct: data.data.fee_pct ?? 0,
        lp_fee_pct: data.data.lp_fee_pct ?? 0,
      });
      setProfit(data.data.total_fee ?? 0);
    } catch (err) {
      console.error("Error fetching fees:", err);
    }
  }

 

  // ✅ Set fees
  async function updateFees() {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fees),
      });

      if (!res.ok) throw new Error("Failed to update fees");
      setTxStatus("✅ Fees updated successfully!");
    }catch (err: unknown) {
      let errorMessage = "An unexpected error occurred";

      if (err instanceof Error) {
        errorMessage = err.message;
      }
      console.error("Fee update error:", errorMessage);
      setTxStatus(`❌ ${errorMessage}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setTxStatus(null), 6000);
    }
  }

  useEffect(() => {
    fetchBalances();
    fetchFees();
  }, []);



  // ✅ Add liquidity (HBAR transfer)
  const handleAddLiquidity = async () => {
    setIsProcessing(true);
    setTxStatus("Initiating Hedera transaction...");
    const hederaSigner = signer;
    try {

      if (!isHederaWalletReady || !hederaSigner) {
        throw new Error("Hedera wallet not connected or signer unavailable.");
      }

      const amount = parseFloat(hederaAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid HBAR amount.");
      }
      const hbarAmount = new Hbar(amount);
      const transaction = new TransferTransaction()
      // @ts-expect-error HWBridgeSigner is compatible at runtime
        .addHbarTransfer(hederaSigner.getAccountId(), hbarAmount.negated())
        .addHbarTransfer(POOL_ADDRESS, hbarAmount);

      setTxStatus("Awaiting Hedera wallet confirmation...");
      // @ts-expect-error HWBridgeSigner is compatible at runtime
      const signTx = await transaction.freezeWithSigner(hederaSigner);
      // @ts-expect-error HWBridgeSigner is compatible at runtime
      await signTx.executeWithSigner(hederaSigner);

      setTxStatus(`✅ Hedera Transaction Successful`);
      await fetchBalances();
    } catch (error: unknown) {
        let message = "An unknown error occurred during the transaction.";

        if (error instanceof Error) {
          message = error.message;
        }

        setTxStatus(`❌ Error: ${message}`);
        console.error("Add Liquidity Error:", error);
    }finally {
      setIsProcessing(false);
      setTimeout(() => setTxStatus(null), 8000);
    }
  };


  const withdrawProfit = async () => {
    if (!accountId) {
      setTxStatus("⚠️ Please connect your wallet first.");
      return;
    }
    setIsProcessing(true);
    setTxStatus("⏳ Withdrawing pool profit...");

    try {
      const payload = {
        recipient: accountId, // user's wallet/accountId
        amount: profit,       // or whatever amount you’re withdrawing
        type: "admin"
      };

      // Call your Next.js API route
      const res = await fetch("/api/liquidity/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Withdrawal failed: ${text}`);
      }
      const data = await res.json();
      setTxStatus(`✅ ${data.message || "Withdrawal successful!"}`);
      // Optionally refresh user data
      await fetchFees();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Withdraw error:", message);
      setTxStatus(`❌ Withdrawal failed: ${message}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setTxStatus(null), 8000);
    }
  };
  
  // if( !isHederaWalletReady || accountId != ADMIN ){
  //   return <div>Unauthorized</div>
  // }
  return (
    <main className="min-h-screen bg-gray-50 p-8">

      
      <h1 className="text-2xl font-bold mb-6 text-center">
        Hedera Admin Liquidity Panel
      </h1>
      <hr className="my-4" />

      {/* ===================== HEDERA LIQUIDITY ===================== */}
      <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
        <Card className="p-6 bg-white shadow-md rounded-2xl">
          <h2 className="text-lg font-semibold mb-4 text-purple-700">
            Add Hedera Liquidity
          </h2>

          <Label className="block text-sm mb-2">Amount (HBAR)</Label>
          <Input
            type="number"
            placeholder="0.0"
            value={hederaAmount}
            onChange={(e) => setHederaAmount(e.target.value)}
            className="mb-4"
          />

          <Button
            onClick={handleAddLiquidity}
            className="w-full bg-purple-600 hover:bg-purple-700"
            disabled={!isHederaWalletReady || loading || isProcessing}
          >
            {loading || isProcessing ? "Processing..." : "Add Liquidity (HBAR)"}
          </Button>

          {!isHederaConnected && (
            <p className="mt-2 text-sm text-red-500">
              ⚠️ Please connect your Hedera wallet.
            </p>
          )}

          <div className="mt-4 text-sm text-gray-600">
            {/* <p>
              <strong>Account:</strong> {accountId || "N/A"}
            </p> */}
            <p>
              <strong>POOL Balance:</strong>{" "}
              {loading ? "Loading..." : `${balances.hedera.toFixed(4)} HBAR`}
            </p>
          </div>
        </Card>

        {/* ===================== FEE SETTINGS ===================== */}
        <Card className="p-6 bg-white shadow-md rounded-2xl">
          <h2 className="text-lg font-semibold mb-4 text-blue-700">
            Pool Fee Configuration
          </h2>

          <div className="mb-4">
            <Label className="block text-sm mb-1">Protocol Fee (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={fees.fee_pct}
              onChange={(e) =>
                setFees((f) => ({ ...f, fee_pct: parseFloat(e.target.value) }))
              }
            />
          </div>

          <div className="mb-4">
            <Label className="block text-sm mb-1">
              Liquidity Provider Fee (%)
            </Label>
            <Input
              type="number"
              step="0.01"
              value={fees.lp_fee_pct}
              onChange={(e) =>
                setFees((f) => ({ ...f, lp_fee_pct: parseFloat(e.target.value) }))
              }
            />
          </div>

          <Button
            onClick={updateFees}
            disabled={isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? "Updating..." : "Update Fees"}
          </Button>

          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>Current Protocol Fee:</strong> {fees.fee_pct}%
            </p>
            <p>
              <strong>Current LP Fee:</strong> {fees.lp_fee_pct}%
            </p>
          </div>
        </Card>
      </div>

      {/* ===================== PROFIT OVERVIEW ===================== */}
      <div className="max-w-4xl mx-auto mt-10">
        <Card className="p-6 bg-white shadow-md rounded-2xl">
          <h2 className="text-lg font-semibold mb-4 text-green-700">
            Pool Profit
          </h2>
{/* 
          <p className="text-gray-700 text-sm mb-2">
            This section displays the total accumulated profit or pool fees collected over time.
          </p> */}

          <div className="mt-3 text-lg font-semibold text-green-700">
            💵 Total Pool Profit: {profit.toFixed(4)} HBAR
          </div>

          <Button
            onClick={withdrawProfit}
            variant="outline"
            className="mt-4"
            disabled={isProcessing || profit <= 0}
          >
            Withdraw Profit
          </Button>
        </Card>
      </div>

      {/* ===================== STATUS + REFRESH ===================== */}
      <div className="text-center mt-10">
        {txStatus && (
          <p
            className={`text-sm mb-4 p-2 rounded ${
              txStatus.includes("Error") || txStatus.includes("❌")
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {txStatus}
          </p>
        )}
        <Button
          variant="outline"
          onClick={() => {
            fetchBalances();
            fetchFees();
          }}
          disabled={loading || isProcessing}
        >
          {loading ? "Refreshing..." : "Refresh All Data"}
        </Button>
      </div>
    </main>
  );
}
