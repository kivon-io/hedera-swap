"use client";

import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

export function useEvmWallet() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  const connect = async () => {
    if (openConnectModal) openConnectModal();
  };

  const disconnectWallet = async () => {
    disconnect();
  };

  return {
    address,
    isConnected,
    connect,
    disconnectWallet,
  };
}
