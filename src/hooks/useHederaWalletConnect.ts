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
  // Keeping this constant as requested
  const [ledgerId] = useState<LedgerId>(LedgerId.TESTNET); 
  const [chainId, setChainId] = useState<HederaChainId | null>(null);
  const [sessionTopic, setSessionTopic] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Initialize connector and restore session if exists
  useEffect(() => {
    // 💡 Capture state setters/values needed inside the effect
    const currentSessionTopic = sessionTopic;
    const setters = { setAccountId, setChainId, setConnected, setSessionTopic };
    
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

        // 👂 Listen for WalletConnect events
        const onSessionEvent = ({ event }: any) => {
          console.log("📩 Session event:", event);
          if (event.name === "chainChanged") setters.setChainId(event.data);
          if (event.name === "accountsChanged") {
            const newAccount = event.data[0]?.split(":").pop();
            setters.setAccountId(newAccount || null);
          }
        };

        const onSessionUpdate = ({ topic, params }: any) => {
          console.log("🔁 Session updated:", topic, params);
          const accounts = params.namespaces?.hedera?.accounts ?? [];
          if (accounts.length > 0) {
            const account = accounts[0].split(":").pop();
            setters.setAccountId(account || null);
          }
        };

        const onSessionDelete = ({ topic }: any) => {
          console.log("❌ Session deleted:", topic);
          // 💡 Use the captured 'currentSessionTopic' for reliable comparison
          if (topic === currentSessionTopic) { 
            setters.setConnected(false);
            setters.setAccountId(null);
            setters.setSessionTopic(null);
          }
        };
        
        // Attach listeners
        wc.on("session_event", onSessionEvent);
        wc.on("session_update", onSessionUpdate);
        wc.on("session_delete", onSessionDelete);

        // 🧹 Return cleanup function
        return () => {
          // Remove all listeners to prevent memory leaks/stale closures
          wc.off("session_event", onSessionEvent);
          wc.off("session_update", onSessionUpdate);
          wc.off("session_delete", onSessionDelete);
        };
      }
      return undefined; // Must return a cleanup function or undefined
    };

    const cleanupPromise = init();
    
    // Return the cleanup function from the outer scope
    return () => {
        cleanupPromise.then(cleanup => cleanup && cleanup());
    };

  // ✅ UPDATED DEPENDENCY ARRAY: 
  // - Includes 'sessionTopic' as it's used inside the effect's session_delete listener.
  // - Includes state setters for strict correctness, though React guarantees stability.
  }, [
    ledgerId, 
    sessionTopic, 
    setAccountId, 
    setChainId, 
    setConnected, 
    setSessionTopic
  ]);
  
  // Connect Hedera Wallet
  const connectWallet = useCallback(async () => {
    // ... (no changes needed here)
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
  }, [connector, setAccountId, setSessionTopic, setConnected]); // Added setters for completeness

  // Disconnect Hedera Wallet
  const disconnectWallet = useCallback(async () => {
    // ... (no changes needed here)
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
  }, [connector, sessionTopic, setConnected, setAccountId, setSessionTopic]); // Added setters for completeness

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