"use client"

import { useConnectModal } from "@rainbow-me/rainbowkit"
import { useAccount, useDisconnect } from "wagmi"

export function useEvmWallet() {
  const { address, isConnected: wagmiConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()

  const isConnected = wagmiConnected && !!address

  const connect = async () => {
    if (openConnectModal) openConnectModal()
  }

  const disconnectWallet = async () => {
    disconnect()
  }

  return {
    address,
    isConnected,
    connect,
    disconnectWallet,
  }
}
