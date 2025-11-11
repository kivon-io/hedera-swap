"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { useBridge } from "@/providers/BridgeProvider";
import { useAccount } from "wagmi";
import { useWallet, useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import { HashpackConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors";
import { getExplorerLink } from "@/helpers/token";

const POLL_INTERVAL = 1000; // 1 second

const BridgeAction = () => {
  const { selected } = useBridge();
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { isConnected: hederaConnected } = useWallet(HashpackConnector);
  const { data: hederaAccount } = useAccountId({ autoFetch: hederaConnected });

  const fromAmount = Number(selected.from.amount);
  const [depositTx, setDepositTx] = useState<string | null>(null);
  const [withdrawTx, setWithdrawTx] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBridging, setIsBridging] = useState(false);

  const fromNetwork = selected.from.network;
  const toNetwork = selected.to.network;

  // Wallet checks
  const isFromNetworkConnected =
    fromNetwork === "hedera" ? hederaConnected : evmConnected;

  const isToNetworkConnected =
    toNetwork === "hedera"
      ? hederaConnected
      : fromNetwork === "hedera"
      ? evmConnected
      : true;

  const isDisabled = !fromAmount || !isFromNetworkConnected || !isToNetworkConnected || isBridging;

  // Dynamic button text
  const getButtonText = () => {
    if (!fromAmount) return "Enter amount";
    if (!isFromNetworkConnected) return `Connect ${fromNetwork} wallet`;
    if (!isToNetworkConnected)
      return fromNetwork === "hedera" && toNetwork !== "hedera"
        ? `Connect EVM wallet for ${toNetwork}`
        : `Connect ${toNetwork} wallet`;
    if (isBridging) return "Bridging...";
    return `Bridge ${fromAmount} ${selected.from.token} → ${selected.to.token}`;
  };

  // Pseudo bridge function
  const handleBridge = async () => {
    if (isDisabled) return;

    setIsBridging(true);
    setDepositTx(null);
    setWithdrawTx(null);
    setStatusMessage("Checking balances...");

    const bridgeData = {
      fromNetwork,
      toNetwork,
      fromToken: selected.from.token,
      toToken: selected.to.token,
      amount: fromAmount,
      fromAddress: evmAddress || hederaAccount,
    };

    console.log("Starting bridge with data:", bridgeData);
    return; 

    try {
      // 1️⃣ Pre-checks
      const preCheckRes = await fetch("/api/bridge/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bridgeData),
      });
      const preCheck = await preCheckRes.json();
      if (!preCheck.canBridge) {
        setStatusMessage(preCheck.message || "Cannot perform bridge");
        setIsBridging(false);
        return;
      }

      // 2️⃣ Wallet interaction (pseudo)
      setStatusMessage("Waiting for deposit confirmation...");
      let txHash;
      if (fromNetwork === "hedera") {
        //txHash = await hederaDeposit(bridgeData); // replace with actual Hedera SDK call
      } else {
        //txHash = await evmDeposit(bridgeData); // replace with actual ethers.js call
      }
      //setDepositTx(txHash);

      // 3️⃣ Notify backend
      await fetch("/api/bridge/notify-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bridgeData, txHash }),
      });

      // 4️⃣ Poll for completion
      setStatusMessage("Processing bridge...");
      const polling = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/bridge/status?fromTx=${txHash}`);
          const status = await statusRes.json();

          if (status.destinationTx) {
            setWithdrawTx(status.destinationTx);
          }
          if (status.completed) {
            setStatusMessage("Bridge completed!");
            clearInterval(polling);
            setIsBridging(false);
          }
        } catch (err) {
          console.error("Error polling bridge status:", err);
        }
      }, POLL_INTERVAL);
    } catch (error: any) {
      console.error("Bridge error:", error);
      setStatusMessage("Bridge failed: " + (error.message || "Unknown error"));
      setIsBridging(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Status message */}
      {statusMessage && (
        <div className="text-sm text-yellow-400 font-medium text-center">
          {statusMessage}
        </div>
      )}

      {/* Deposit and Withdrawal transaction hashes */}
      {depositTx && (
        <div className="text-xs text-blue-400 text-center">
          Deposit TX:{" "}
          <a
            href={getExplorerLink(depositTx, fromNetwork)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {depositTx}
          </a>
        </div>
      )}
      {withdrawTx && (
        <div className="text-xs text-green-400 text-center">
          Withdrawal TX:{" "}
          <a
            href={getExplorerLink(withdrawTx, toNetwork)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {withdrawTx}
          </a>{" "}
          ✅
        </div>
      )}

      {/* Bridge button */}
      <Button
        className="w-full rounded-xl h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all duration-300"
        size="lg"
        onClick={handleBridge}
        disabled={isDisabled}
      >
        {getButtonText()}
      </Button>
    </div>
  );
};

export default BridgeAction;
