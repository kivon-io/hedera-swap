"use client"

import { type TransactionType, type TxStatus } from "@/config/bridge"
import { NETWORKS_INFO, type NetworkOption } from "@/config/networks"
import { TOKENS } from "@/config/tokens"
import React, { createContext, useCallback, useContext, useMemo, useState } from "react"

type TokenMetadata = {
  symbol: string
  address: string
  decimals: number
  native?: boolean
  metadata?: {
    logoUrl?: string
  }
}

type NetworkMetadata = {
  name: string
  symbol: string
  address: string
  decimals: number
  native: boolean
  metadata?: {
    logoUrl?: string
  }
}

type BridgeContextValue = {
  txStatus: {
    status: TxStatus | null
    message: string | null
  }
  networks: NetworkMetadata[]
  tokensByNetwork: Record<NetworkOption, Record<string, TokenMetadata>>
  selected: {
    from: { network: NetworkOption; token: string; amount: number }
    to: { network: NetworkOption; token: string; amount: number }
  }
  setSelectedNetwork: (type: TransactionType, network: NetworkOption) => void
  setSelectedToken: (type: TransactionType, token: string) => void
  setAmount: (type: TransactionType, amount: number) => void
  setTxStatus: (status: TxStatus | null, message: string | null) => void
}

const BridgeContext = createContext<BridgeContextValue | undefined>(undefined)

export function BridgeProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState({
    from: { network: "ethereum" as NetworkOption, token: "ETH", amount: 0 },
    to: { network: "hedera" as NetworkOption, token: "HBAR", amount: 0 },
  })
  const [txStatus, setTxStatusState] = useState<{
    status: TxStatus | null
    message: string | null
  }>({
    status: null,
    message: null,
  })
  const setTxStatus = useCallback((status: TxStatus | null, message: string | null) => {
    setTxStatusState({ status, message })
  }, [])

  const setSelectedNetwork = (type: TransactionType, network: NetworkOption) => {
    setSelected((prev) => {
      const firstTokenKey = Object.keys(TOKENS[network])[0]
      const firstTokenSymbol =
        (TOKENS[network] as Record<string, { symbol: string }>)[firstTokenKey]?.symbol ||
        firstTokenKey

      return {
        ...prev,
        [type]: {
          network,
          token: prev[type].network === network ? prev[type].token : firstTokenSymbol,
          amount: prev[type].amount, // preserve amount
        },
      }
    })
  }

  const setSelectedToken = (type: TransactionType, token: string) => {
    setSelected((prev) => {
      const updated = {
        ...prev,
        from: {
          ...prev.from,
          amount: 0,
        },
        to: {
          ...prev.to,
          amount: 0,
        },
      }
      updated[type] = {
        ...updated[type],
        token,
      }
      return updated
    })
  }

  const setAmount = (type: TransactionType, amount: number) => {
    setSelected((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        amount,
      },
    }))
  }

  const value = useMemo<BridgeContextValue>(() => {
    return {
      networks: NETWORKS_INFO,
      tokensByNetwork: TOKENS as Record<NetworkOption, Record<string, TokenMetadata>>,
      selected,
      txStatus,
      setSelectedNetwork,
      setSelectedToken,
      setAmount,
      setTxStatus,
    }
  }, [selected, txStatus, setTxStatus])

  return <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>
}

export function useBridge() {
  const ctx = useContext(BridgeContext)
  if (!ctx) throw new Error("useBridge must be used within a BridgeProvider")
  return ctx
}

export type { BridgeContextValue }
