"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DAppConnector,
  HederaJsonRpcMethod,
  HederaSessionEvent,
  HederaChainId,
} from "@hashgraph/hedera-wallet-connect";
import { LedgerId } from "@hashgraph/sdk";

export function useHederaWalletConnect() {
  const [connector, setConnector] = useState<DAppConnector | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ledgerId] = useState<LedgerId>(LedgerId.TESTNET);
  const [chainId, setChainId] = useState<HederaChainId | null>(null);
  const [sessionTopic, setSessionTopic] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Initialize connector and restore session if exists
  useEffect(() => {
    const init = async () => {
      const metadata = {
        name: "MultiChain Bridge",
        description: "Bridge tokens between Hedera & EVM",
        url: window.location.origin,
        icons: ["https://avatars.githubusercontent.com/u/31002956"],
      };

      const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID!;
      if (!projectId) {
        console.error("⚠️ NEXT_PUBLIC_WC_PROJECT_ID not set!");
        return;
      }

      const dAppConnector = new DAppConnector(
        metadata,
        ledgerId,
        projectId,
        Object.values(HederaJsonRpcMethod),
        [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
        [HederaChainId.Mainnet, HederaChainId.Testnet],
        "info"
      );

      await dAppConnector.init({ logger: "error" });
      setConnector(dAppConnector);

      // Restore previous WalletConnect session (persistent)
      const wc = dAppConnector.walletConnectClient;
      if (wc) {
        const sessions = await wc.session.getAll();
        if (sessions.length > 0) {
          const last = sessions[sessions.length - 1];
          console.log("♻️ Restoring previous Hedera session:", last);
          setSessionTopic(last.topic);

          const accounts = last?.namespaces?.hedera?.accounts ?? [];
          if (accounts.length > 0) {
            const account = accounts[0].split(":").pop();
            setAccountId(account || null);
            setConnected(true);
          }
        }

        // Listen for WalletConnect events
        wc.on("session_event", ({ event }) => {
          console.log("📩 Session event:", event);
          if (event.name === "chainChanged") setChainId(event.data);
          if (event.name === "accountsChanged") {
            const newAccount = event.data[0]?.split(":").pop();
            setAccountId(newAccount || null);
          }
        });

        wc.on("session_update", ({ topic, params }) => {
          console.log("🔁 Session updated:", topic, params);
          const accounts = params.namespaces?.hedera?.accounts ?? [];
          if (accounts.length > 0) {
            const account = accounts[0].split(":").pop();
            setAccountId(account || null);
          }
        });

        wc.on("session_delete", ({ topic }) => {
          console.log("❌ Session deleted:", topic);
          if (topic === sessionTopic) {
            setConnected(false);
            setAccountId(null);
            setSessionTopic(null);
          }
        });
      }
    };

    init();
  }, [ledgerId, sessionTopic]);

  // Connect Hedera Wallet
  const connectWallet = useCallback(async () => {
    if (!connector) return;
    try {
      const session = await connector.openModal();
      console.log("✅ Wallet connected:", session);

      const accounts = session?.namespaces?.hedera?.accounts ?? [];
      if (accounts.length > 0) {
        const account = accounts[0].split(":").pop();
        setAccountId(account || null);
      }

      setSessionTopic(session.topic);
      setConnected(true);
    } catch (err) {
      console.error("❌ Wallet connection failed:", err);
    }
  }, [connector]);

  // Disconnect Hedera Wallet
  const disconnectWallet = useCallback(async () => {
    try {
      if (connector && sessionTopic) {
        await connector.disconnect(sessionTopic);
      }
    } catch (err) {
      console.warn("Disconnect failed:", err);
    } finally {
      setConnected(false);
      setAccountId(null);
      setSessionTopic(null);
      console.log("🔌 Disconnected from wallet.");
    }
  }, [connector, sessionTopic]);

  return {
    connector,
    accountId,
    ledgerId,
    chainId,
    connected,
    connectWallet,
    disconnectWallet,
  };
}
