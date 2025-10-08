"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAccount } from "wagmi"; // for EVM wallet
import { useHederaWallet } from "@/context/HederaWalletContext";

type NetworkOption = "ethereum" | "polygon" | "bsc" | "hedera";

const NETWORKS: NetworkOption[] = ["ethereum", "polygon", "bsc", "hedera"];

const TOKENS: Record<NetworkOption, string[]> = {
  ethereum: ["ETH", "USDC", "DAI"], 
  polygon: ["MATIC", "USDC", "WETH"],
  bsc: ["BNB", "USDT"],
  hedera: ["HBAR", "hUSDC", "hDAI"],
};

export default function BridgeForm() {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { connected: hederaConnected, accountId: hederaAccount } = useHederaWallet();

  const [fromNetwork, setFromNetwork] = useState<NetworkOption>("ethereum");
  const [toNetwork, setToNetwork] = useState<NetworkOption>("hedera");
  const [fromToken, setFromToken] = useState<string>("ETH");
  const [toToken, setToToken] = useState<string>("HBAR");
  const [amount, setAmount] = useState<string>("");

  // Update token defaults when network changes
  useEffect(() => {
    setFromToken(TOKENS[fromNetwork][0]);
  }, [fromNetwork]);

  useEffect(() => {
    setToToken(TOKENS[toNetwork][0]);
  }, [toNetwork]);

  const handleSwapNetworks = () => {
    const prevFrom = fromNetwork;
    const prevTo = toNetwork;
    setFromNetwork(prevTo);
    setToNetwork(prevFrom);
  };

  const handleBridge = () => {
    if (!amount || Number(amount) <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    if (fromNetwork === "hedera" && !hederaConnected) {
      alert("Connect your Hedera wallet first.");
      return;
    }

    if (fromNetwork !== "hedera" && !evmConnected) {
      alert("Connect your EVM wallet first.");
      return;
    }

    console.log("🚀 Bridging request:");
    console.log({
      fromNetwork,
      toNetwork,
      fromToken,
      toToken,
      amount,
      evmAddress,
      hederaAccount,
    });

    alert(`Bridge initiated: ${amount} ${fromToken} → ${toToken}`);
  };

  return (
    <Card className="max-w-md mx-auto mt-10 bg-zinc-900 border-zinc-800 text-white">
      <CardHeader>
        <CardTitle className="text-center text-xl font-semibold">🌉 MultiChain Bridge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Network Selectors */}
        <div className="flex justify-between items-center gap-2">
          <div className="w-1/2">
            <label className="block text-sm text-gray-400 mb-1">From Network</label>
            <select
              value={fromNetwork}
              onChange={(e) => setFromNetwork(e.target.value as NetworkOption)}
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
            >
              {NETWORKS.map((net) => (
                <option key={net} value={net}>
                  {net.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSwapNetworks}
            className="mt-6 bg-zinc-800 hover:bg-zinc-700 p-2 rounded-full"
            title="Swap networks"
          >
            🔁
          </button>

          <div className="w-1/2">
            <label className="block text-sm text-gray-400 mb-1">To Network</label>
            <select
              value={toNetwork}
              onChange={(e) => setToNetwork(e.target.value as NetworkOption)}
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
            >
              {NETWORKS.map((net) => (
                <option key={net} value={net}>
                  {net.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Token Selectors */}
        <div className="flex justify-between items-center gap-2">
          <div className="w-1/2">
            <label className="block text-sm text-gray-400 mb-1">From Token</label>
            <select
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
            >
              {TOKENS[fromNetwork].map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
          </div>

          <div className="w-1/2">
            <label className="block text-sm text-gray-400 mb-1">To Token</label>
            <select
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
            >
              {TOKENS[toNetwork].map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Amount</label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
            placeholder="0.00"
          />
        </div>

        {/* Action Button */}
        <Button
          onClick={handleBridge}
          className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          disabled={!evmConnected && !hederaConnected}
        >
          {fromNetwork === "hedera" && !hederaConnected
            ? "Connect Hedera Wallet"
            : fromNetwork !== "hedera" && !evmConnected
            ? "Connect EVM Wallet"
            : "Bridge Tokens"}
        </Button>

        {/* Status Summary */}
        <div className="text-sm text-gray-400 mt-4 text-center">
          EVM Wallet:{" "}
          <span className={evmConnected ? "text-green-400" : "text-red-400"}>
            {evmConnected ? "Connected" : "Not Connected"}
          </span>{" "}
          | Hedera Wallet:{" "}
          <span className={hederaConnected ? "text-green-400" : "text-red-400"}>
            {hederaConnected ? "Connected" : "Not Connected"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
