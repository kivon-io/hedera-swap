"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAccount } from "wagmi"; // for EVM wallet
import { useHederaWallet } from "@/context/HederaWalletContext";
import { fetchTokenPrices } from "@/helpers"

type NetworkOption = "ethereum" | "bsc" | "hedera";

const NETWORKS: NetworkOption[] = ["ethereum", "bsc", "hedera"];

const TOKENS: Record<NetworkOption, string[]> = {
  ethereum: ["ETH", "USDC"],
  bsc: ["BNB", "bUSDC"],
  hedera: ["HBAR", "hUSDC"],
};

// --- CONSTANTS ---
const PROTOCOL_FEE_PERCENT = 2;
const PROTOCOL_FEE_RATE = PROTOCOL_FEE_PERCENT / 100;
const DEDUCE_FEE_RATE = 1 - PROTOCOL_FEE_RATE;

type TokenPrices = Record<string, number>;


export default function BridgeForm() {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { connected: hederaConnected, accountId: hederaAccount } = useHederaWallet();

  const [fromNetwork, setFromNetwork] = useState<NetworkOption>("ethereum");
  const [toNetwork, setToNetwork] = useState<NetworkOption>("hedera");
  const [fromToken, setFromToken] = useState<string>("ETH");
  const [toToken, setToToken] = useState<string>("HBAR");
  
  // State for amount input
  const [amount, setAmount] = useState<string>("");

  // State for token prices
  const [prices, setPrices] = useState<TokenPrices>({});
  const [isPriceLoading, setIsPriceLoading] = useState(false);

 

  // --- PRICE FETCHING EFFECT ---
  useEffect(() => {
    const loadPrices = async () => {
      setIsPriceLoading(true);
      try {
        const fetchedPrices = await fetchTokenPrices();
        setPrices(fetchedPrices);
      } catch (error) {
        console.error("Failed to fetch token prices:", error);
        // Handle error: perhaps set a default price or show an error message
      } finally {
        setIsPriceLoading(false);
      }
    };

    loadPrices();
  }, []);

  // --- CONVERSION LOGIC ---

  const fromPrice = prices[fromToken] || 0;
  const toPrice = prices[toToken] || 0;
  const inputAmount = Number(amount);

  const { toAmount, feeAmount, finalToAmount } = useMemo(() => {
    let rawToAmount = 0;
    let fee = 0;
    let finalAmount = 0;

    if (inputAmount > 0 && fromPrice > 0 && toPrice > 0) {
      // 1. Calculate the USD value of the 'From' amount
      const usdValue = inputAmount * fromPrice;
      
      // 2. Calculate the raw 'To' amount before fee deduction
      rawToAmount = usdValue / toPrice; 
      
      // 3. Calculate the fee in the 'To' token
      fee = rawToAmount * PROTOCOL_FEE_RATE;
      
      // 4. Calculate the final amount after fee deduction
      finalAmount = rawToAmount * DEDUCE_FEE_RATE;
    }
    
    // Return formatted strings for display
    return {
      toAmount: rawToAmount.toFixed(4),
      feeAmount: fee.toFixed(4),
      finalToAmount: finalAmount.toFixed(4),
    };
  }, [inputAmount, fromPrice, toPrice]);
  
  // Update the visual 'To Amount' input field based on the conversion
  useEffect(() => {
    // Only update the 'toAmount' display if there's a valid conversion
    if (inputAmount > 0 && Number(finalToAmount) > 0) {
        // We will directly use the computed finalToAmount in the display logic below
    }
  }, [finalToAmount, inputAmount]);


  // --- NETWORK AND TOKEN LOGIC (as before) ---

  const toNetworks = useMemo(() => {
    return NETWORKS.filter(net => net !== fromNetwork);
  }, [fromNetwork]);

  const handleFromNetworkChange = useCallback((newFromNetwork: NetworkOption) => {
    setFromNetwork(newFromNetwork);
    if (newFromNetwork === toNetwork) {
      const newToNetwork = toNetworks.find(net => net !== newFromNetwork);
      if (newToNetwork) {
        setToNetwork(newToNetwork);
      }
    }
  }, [toNetwork, toNetworks]);

  useEffect(() => {
    setFromToken(TOKENS[fromNetwork][0]);
    // Reset amount when token or network changes
    setAmount(""); 
  }, [fromNetwork]);

  useEffect(() => {
    setToToken(TOKENS[toNetwork][0]);
    // Reset amount when token or network changes
    setAmount("");
  }, [toNetwork]);

  const handleFromTokenChange = (newToken: string) => {
    setFromToken(newToken);
    setAmount(""); // Reset amount on token change
  }

  const handleToTokenChange = (newToken: string) => {
    setToToken(newToken);
    setAmount(""); // Reset amount on token change
  }

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
    if (fromNetwork === toNetwork) {
        alert("Cannot bridge to the same network.");
        return;
    }
    // ... wallet connection checks ...
    if (fromNetwork === "hedera" && !hederaConnected) {
      alert("Connect your Hedera wallet first.");
      return;
    }
    if (fromNetwork !== "hedera" && !evmConnected) {
      alert("Connect your EVM wallet first.");
      return;
    }

    console.log("🚀 Bridging request:", {
      fromNetwork, toNetwork, fromToken, toToken, amount, 
      finalToAmount, feeAmount, 
      evmAddress, hederaAccount,
    });

    alert(`Bridge initiated: ${amount} ${fromToken} → ${finalToAmount} ${toToken} (Fee: ${feeAmount} ${toToken})`);
  };

  // Display a loading state if prices are not ready
  if (isPriceLoading || Object.keys(prices).length === 0) {
      return (
          <Card className="max-w-md mx-auto mt-10 bg-zinc-900 border-zinc-800 text-white">
              <CardContent className="p-6 text-center">
                  <p>Loading Bridge....</p>
              </CardContent>
          </Card>
      );
  }
  
  // Display price warning if any token price is missing
  const isPriceInvalid = fromPrice <= 0 || toPrice <= 0;


  return (
    <Card className="max-w-md mx-auto mt-10 bg-zinc-900 border-zinc-800 text-white">
      <CardHeader>
        <CardTitle className="text-center text-xl font-semibold">🌉 MultiChain Bridge <span className="text-red-400">(TESTNET)</span></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Network Selectors (unchanged from your previous) */}
        <div className="flex justify-between items-center gap-2">
          {/* From Network... */}
          <div className="w-1/2">
            <label className="block text-sm text-gray-400 mb-1">From Network</label>
            <select
              value={fromNetwork}
              onChange={(e) => handleFromNetworkChange(e.target.value as NetworkOption)}
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
          {/* To Network... */}
          <div className="w-1/2">
            <label className="block text-sm text-gray-400 mb-1">To Network</label>
            <select
              value={toNetwork}
              onChange={(e) => setToNetwork(e.target.value as NetworkOption)}
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
            >
              {toNetworks.map((net) => (
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
              onChange={(e) => handleFromTokenChange(e.target.value)}
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
            >
              {TOKENS[fromNetwork].map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
            {/* Display token price */}
            <p className="text-xs text-gray-500 mt-1">Price: ${fromPrice.toFixed(2)}</p>
          </div>

          <div className="w-1/2">
            <label className="block text-sm text-gray-400 mb-1">To Token</label>
            <select
              value={toToken}
              onChange={(e) => handleToTokenChange(e.target.value)}
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
            >
              {TOKENS[toNetwork].map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
            {/* Display token price */}
            <p className="text-xs text-gray-500 mt-1">Price: ${toPrice.toFixed(2)}</p>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount to send ({fromToken})</label>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
                placeholder="0.00"
              />
            </div>
            
            {/* Estimated Receive Amount Display */}
            <div className="relative">
              <label className="block text-sm text-gray-400 mb-1">Estimated amount to receive ({toToken})</label>
              <input
                type="text"
                readOnly
                value={Number(amount) > 0 ? finalToAmount : "0.00"}
                className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white read-only:bg-zinc-700"
                placeholder="0.00"
              />
              {isPriceInvalid && (
                  <p className="text-sm text-yellow-400 mt-2">
                    ⚠️ Price data unavailable for conversion.
                  </p>
              )}
            </div>
        </div>

        {/* Fee and Conversion Details */}
        <div className="pt-2 border-t border-zinc-700 space-y-1 text-sm">
            <div className="flex justify-between">
                <span className="text-gray-400">Conversion Rate:</span>
                <span className="text-white">
                    1 {fromToken} ≈ {(fromPrice / toPrice).toFixed(4)} {toToken}
                </span>
            </div>
            <div className="flex justify-between">
                <span className="text-gray-400">Protocol Fee:</span>
                <span className="text-white">
                    {PROTOCOL_FEE_PERCENT}% ({Number(feeAmount) > 0 ? feeAmount : "0.00"} {toToken})
                </span>
            </div>
            <div className="flex justify-between font-semibold text-base mt-2">
                <span className="text-gray-300">Total Received:</span>
                <span className="text-green-400">
                    {Number(amount) > 0 ? finalToAmount : "0.00"} {toToken}
                </span>
            </div>
        </div>
        
        {/* Action Button */}
        <Button
          onClick={handleBridge}
          className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          disabled={!evmConnected && !hederaConnected || Number(amount) <= 0 || isPriceInvalid}
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