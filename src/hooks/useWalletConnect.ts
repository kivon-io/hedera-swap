"use client"

import { useAccountId, useWallet } from "@buidlerlabs/hashgraph-react-wallets"
import { HWCConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import { useMemo } from "react"
import { useEvmWallet } from "./useEvmWallet"

type WalletType = "ethereum" | "hedera"

export function useWalletConnect() {
  // EVM (via wagmi + RainbowKit in useEvmWallet)
  const {
    address: evmAddress,
    isConnected: isEvmConnected,
    connect: connectEvm,
    disconnectWallet: disconnectEvm,
  } = useEvmWallet()

  // Hedera (via hashgraph-react-wallets)
  const {
    isConnected: isHederaConnected,
    connect: connectHederaRaw,
    disconnect: disconnectHederaRaw,
  } = useWallet(HWCConnector)
  const { data: hederaAccountId } = useAccountId({ autoFetch: isHederaConnected })

  const connect = async (type: WalletType) => {
    if (type === "ethereum") {
      await connectEvm()
      return
    }
    await connectHederaRaw()
  }

  const disconnect = async (type: WalletType) => {
    if (type === "ethereum") {
      await disconnectEvm()
      return
    }
    await disconnectHederaRaw()
  }

  const isConnected = (type: WalletType) => {
    return type === "ethereum" ? isEvmConnected : isHederaConnected
  }

  const address = (type: WalletType) => {
    return type === "ethereum" ? evmAddress ?? null : hederaAccountId ?? null
  }

  return useMemo(
    () => ({
      // generic API
      connect,
      disconnect,
      isConnected,
      address,
      // granular access
      connectEvm,
      disconnectEvm,
      isEvmConnected,
      evmAddress,
      connectHedera: connectHederaRaw,
      disconnectHedera: disconnectHederaRaw,
      isHederaConnected,
      hederaAccountId,
    }),
    /* eslint-disable react-hooks/exhaustive-deps */
    [
      connectEvm,
      disconnectEvm,
      isEvmConnected,
      evmAddress,
      connectHederaRaw,
      disconnectHederaRaw,
      isHederaConnected,
      hederaAccountId,
    ]
  )
}

export type { WalletType }
