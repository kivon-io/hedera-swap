"use client"

import { useConnectModal } from "@rainbow-me/rainbowkit"
import { useAccount, useDisconnect } from "wagmi"
import { LAST_CONNECTOR_ID_KEY } from "./useAutoConnect"

export function useEvmWallet() {
  const { address, isConnected: wagmiConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()

  const isConnected = wagmiConnected && !!address

  const connect = async () => {
    if (openConnectModal) openConnectModal()
  }

  const disconnectWallet = async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LAST_CONNECTOR_ID_KEY)
    }
    disconnect()
  }

  return {
    address,
    isConnected,
    connect,
    disconnectWallet,
  }
}
