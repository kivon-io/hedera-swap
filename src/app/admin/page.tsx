"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Address, parseEther } from "viem";
import {
  useAccount,
  useChainId,
  useSendTransaction,
  useSwitchChain,
} from "wagmi";
import { sepolia, bscTestnet } from "wagmi/chains";

import { useWallet, useAccountId } from "@buidlerlabs/hashgraph-react-wallets"; 
import { TransferTransaction, Hbar } from "@hashgraph/sdk";

// Helper type for network selection
type EVMNetworkOption = "ethereum" | "bsc";
type NetworkOption = EVMNetworkOption | "hedera";

const ETHEREUM_CHAIN_ID = sepolia.id; // Sepolia Testnet
const BSC_CHAIN_ID = bscTestnet.id; // BSC Testnet

const CONTRACT_ADDRESSES: Record<NetworkOption, Address | string> = {
  ethereum: "0x8A8Dbbe919f80Ca7E96A824D61763503dF15166f",
  bsc: "0xA1C6545861c572fc44320f9A52CF1DE32Da84Ab8",
  hedera: "0.0.7103690",
};

export default function AdminPage() {
  const [hederaAmount, setHederaAmount] = useState("");
  const [evmAmount, setEvmAmount] = useState("");
  const [balances, setBalances] = useState({ hedera: 0, ethereum: 0, bsc: 0 });
  const [loading, setLoading] = useState(false); // For balance fetching
  // 🟢 NEW STATE: Controls button disabling during network switch or transaction
  const [isProcessing, setIsProcessing] = useState(false); 
  const [evmNetwork, setEvmNetwork] = useState<EVMNetworkOption>("ethereum");
  const [txStatus, setTxStatus] = useState<string | null>(null); // For messages

  // Wagmi/Viem Hooks for EVM
  const { isConnected: isEvmConnected, chain } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  // Hedera Hooks
  const { signer, isConnected: isHederaConnected } = useWallet();
  const { data: accountId } = useAccountId();

  // Determine required chain ID based on selection
  const requiredChainId =
    evmNetwork === "ethereum" ? ETHEREUM_CHAIN_ID : BSC_CHAIN_ID;
  const isCorrectEVMNetwork = chainId === requiredChainId;
  const evmContractAddress = CONTRACT_ADDRESSES[evmNetwork] as Address;

  // Convenience boolean to check if Hedera wallet is ready
  const isHederaWalletReady = isHederaConnected && signer && accountId;

  // Function to fetch balances from your API route (omitted for brevity)
  async function fetchBalances() { 
    setLoading(true);
    try {
      // ... (balance fetching logic) ...
       const [hederaRes, ethRes, bscRes] = await Promise.all([
        fetch("/api/getBalance", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chainId: "hedera", address: CONTRACT_ADDRESSES.hedera, }),
        }),
        fetch("/api/getBalance", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chainId: "ethereum", address: CONTRACT_ADDRESSES.ethereum, }),
        }),
        fetch("/api/getBalance", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chainId: "bsc", address: CONTRACT_ADDRESSES.bsc, }),
        }),
      ]);

      const hederaData = await hederaRes.json();
      const ethData = await ethRes.json();
      const bscData = await bscRes.json();

      setBalances({
        hedera: hederaData.nativeBalance ?? 0,
        ethereum: ethData.nativeBalance ?? 0,
        bsc: bscData.nativeBalance ?? 0,
      });
    } catch (err) {
      console.error("Error fetching balances:", err);
    } finally {
      setLoading(false);
    }
  }

  // Effect to fetch balances on initial load
  useEffect(() => {
    fetchBalances();
  }, []);

  // Handler for adding liquidity
  const handleAddLiquidity = async (chainType: NetworkOption) => {
    setIsProcessing(true); // 🟢 Start processing
    setTxStatus("Initiating transaction...");
    
    // Cast signer once for Hedera-specific methods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hederaSigner = signer as any; 
    
    try {
      if (chainType === "hedera") {
        if (!isHederaWalletReady || !hederaSigner) {
          throw new Error("Hedera wallet not connected or signer/accountId unavailable.");
        }
        
        const amount = parseFloat(hederaAmount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error("Invalid HBAR amount.");
        }
        
        const hbarAmount = new Hbar(amount);
        
        // 1️⃣ Construct the transaction
        const transaction = new TransferTransaction()
          .addHbarTransfer(hederaSigner.getAccountId(), hbarAmount.negated()) 
          .addHbarTransfer(CONTRACT_ADDRESSES.hedera, hbarAmount);

        setTxStatus("Awaiting Hedera wallet confirmation...");
        
        // 2️⃣ Freeze, sign, and execute
        const signTx = await transaction.freezeWithSigner(hederaSigner);
        await signTx.executeWithSigner(hederaSigner); 
        
        // 3️⃣ Get receipt
        // The Signer acts as the client here
        // await txResponse.getReceipt(hederaSigner); 

        setTxStatus(`Hedera Tx Successful`);
      } else {
        // EVM Logic (ethereum/bsc)
        if (!isEvmConnected) {
          throw new Error("EVM wallet not connected.");
        }
        if (!isCorrectEVMNetwork) {
          // This case should be handled by the user clicking 'Switch'
          throw new Error(
            `EVM wallet on wrong network. Please click 'Switch' or connect to ${evmNetwork.toUpperCase()}.`
          );
        }

        const amount = parseFloat(evmAmount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error("Invalid EVM amount.");
        }

        const value = parseEther(evmAmount);
        setTxStatus(`Awaiting EVM wallet confirmation for ${evmNetwork.toUpperCase()}...`);

        // Use useSendTransaction for native token transfer
        const hash = await sendTransactionAsync({
          to: evmContractAddress,
          value,
        });

        setTxStatus(`Transaction submitted. Hash: ${hash}. Waiting for confirmation...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); 
        setTxStatus(`EVM Tx Confirmed! Hash: ${hash.substring(0, 10)}...`);
      }

      await fetchBalances();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const errorMessage =
        error.shortMessage || error.message || "An unknown error occurred during the transaction.";
      setTxStatus(`Error: ${errorMessage}`);
      console.error("Add Liquidity Error:", error);
    } finally {
      setIsProcessing(false); // 🟢 Stop processing immediately
      // Keep status message visible for a short time
      setTimeout(() => setTxStatus(null), 8000); 
    }
  };

  // Function to handle network switch
  const handleSwitchNetwork = () => {
    if (requiredChainId) {
      setIsProcessing(true); // 🟢 Start processing
      setTxStatus(`Switching to ${evmNetwork.toUpperCase()}...`);
      switchChain(
        { chainId: requiredChainId },
        {
          onError: (error) => {
            setTxStatus(`Error switching chain: ${error.message}`);
            setIsProcessing(false); // 🟢 Stop processing on error
            setTimeout(() => setTxStatus(null), 8000);
          },
          onSuccess: () => {
            setTxStatus(`Switched to ${evmNetwork.toUpperCase()}`);
            setIsProcessing(false); // 🟢 Stop processing on success
            setTimeout(() => setTxStatus(null), 8000);
          },
        }
      );
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Admin Liquidity Panel
      </h1>
      <hr className="my-4"/>

      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* ===================== HEDERA FORM ===================== */}
        <Card className="p-6 bg-white shadow-md rounded-2xl">
          <h2 className="text-lg font-semibold mb-4 text-purple-700">
            Hedera Liquidity
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Native Token: <strong>HBAR</strong>
          </p>

          <div className="mb-4">
            <label className="text-sm font-medium block mb-2">
              Enter Amount
            </label>
            <Input
              type="number"
              placeholder="0.0"
              value={hederaAmount}
              onChange={(e) => setHederaAmount(e.target.value)}
            />
          </div>

          <Button
            onClick={() => handleAddLiquidity("hedera")}
            className="w-full bg-purple-600 hover:bg-purple-700"
            // 🟢 Use isProcessing here
            disabled={!isHederaWalletReady || loading || isProcessing}
          >
            {loading || isProcessing ? "Processing..." : "Add Liquidity (HBAR)"}
          </Button>

          {!isHederaConnected && (
            <p className="mt-2 text-sm text-red-500">
              ⚠️ Hedera Wallet not connected. Please connect your HashPack or other supported wallet.
            </p>
          )}
          {isHederaConnected && !accountId && (
             <p className="mt-2 text-sm text-red-500">
               ⚠️ Wallet connected, but **Account ID is not available**.
             </p>
          )}

          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>HBAR Account:</strong>{" "}
              {accountId ? accountId : "N/A"}
            </p>
            <p>
              <strong>HBAR Balance:</strong>{" "}
              {loading ? "Loading..." : `${balances.hedera.toFixed(4)} HBAR`}
            </p>
          </div>
        </Card>
        {/* --------------------------------------------------------- */}

        {/* ===================== EVM FORM ===================== */}
        <Card className="p-6 bg-white shadow-md rounded-2xl">
          <h2 className="text-lg font-semibold mb-4 text-blue-700">
            EVM Liquidity
          </h2>
          
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2">
              Select Network
            </label>
            <Select
              value={evmNetwork}
              onValueChange={(value) =>
                setEvmNetwork(value as EVMNetworkOption)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a network" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ethereum">Ethereum (Sepolia)</SelectItem>
                <SelectItem value="bsc">BSC (Testnet)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Selected: **{evmNetwork.toUpperCase()}**
            </p>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium block mb-2">
              Enter Amount
            </label>
            <Input
              type="number"
              placeholder="0.0"
              value={evmAmount}
              onChange={(e) => setEvmAmount(e.target.value)}
              // 🟢 Use isProcessing here
              disabled={!isEvmConnected || !isCorrectEVMNetwork || isProcessing}
            />
          </div>

          {!isEvmConnected && (
            <p className="mt-2 text-sm text-red-500">
              ⚠️ EVM Wallet not connected.
            </p>
          )}

          {isEvmConnected && !isCorrectEVMNetwork && (
            <>
              <p className="mt-2 text-sm text-orange-500 mb-2">
                ⚠️ Connected to **{chain?.name || 'an unknown chain'}**. Please
                switch to **{evmNetwork === 'ethereum' ? 'Sepolia' : 'BSC Testnet'}** to continue.
              </p>
              <Button
                onClick={handleSwitchNetwork}
                className="w-full mb-4 bg-orange-600 hover:bg-orange-700"
                // 🟢 Use isProcessing here
                disabled={isProcessing}
              >
                {isProcessing ? "Switching..." : `Switch to ${evmNetwork === 'ethereum' ? 'Sepolia' : 'BSC Testnet'}`}
              </Button>
            </>
          )}

          <Button
            onClick={() => handleAddLiquidity(evmNetwork)}
            className="w-full bg-blue-600 hover:bg-blue-700"
            // 🟢 Use isProcessing here
            disabled={!isEvmConnected || !isCorrectEVMNetwork || loading || isProcessing}
          >
            {loading || isProcessing ? "Processing..." : `Add Liquidity (${evmNetwork === "ethereum" ? "ETH" : "BNB"})`}
          </Button>

          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>ETH Balance:</strong>{" "}
              {loading ? "Loading..." : `${balances.ethereum.toFixed(4)} ETH`}
            </p>
            <p>
              <strong>BNB Balance:</strong>{" "}
              {loading ? "Loading..." : `${balances.bsc.toFixed(4)} BNB`}
            </p>
          </div>
        </Card>
      </div>
      <hr className="my-4"/>

      <div className="text-center mt-8">
        {txStatus && (
          <p
            className={`text-sm mb-4 p-2 rounded ${
              txStatus.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
            }`}
          >
            {txStatus}
          </p>
        )}
        <Button variant="outline" onClick={fetchBalances} disabled={loading || isProcessing}>
          {loading ? "Refreshing..." : "Refresh Balances"}
        </Button>
      </div>
    </main>
  );
}