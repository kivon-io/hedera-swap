"use client"
import { useState, useEffect, useCallback } from "react"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { useAccount, useDisconnect } from "wagmi"

export function useEvmWallet() {
  const [mounted, setMounted] = useState(false)

  // Only mark as mounted on the client
  useEffect(() => {
    setMounted(true)
  }, [])

  const account = useAccount()
  const disconnectHook = useDisconnect()
  const connectModal = useConnectModal()

  // Before mounted, return safe defaults so hooks aren't called
  if (!mounted) {
    return {
      address: null,
      isConnected: false,
      connect: async () => {},
      disconnectWallet: async () => {},
    }
  }

  const isConnected = account.isConnected && !!account.address

  const connect = useCallback(async () => {
    if (connectModal.openConnectModal) connectModal.openConnectModal()
  }, [connectModal])

  const disconnectWallet = useCallback(async () => {
    disconnectHook.disconnect()
  }, [disconnectHook])

  return {
    address: account.address,
    isConnected,
    connect,
    disconnectWallet,
  }
}
