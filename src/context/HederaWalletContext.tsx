"use client"

import { HWBridgeProvider, useAccountId, useWallet } from "@buidlerlabs/hashgraph-react-wallets"
import { HederaTestnet } from "@buidlerlabs/hashgraph-react-wallets/chains"
import { HashpackConnector, KabilaConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import React, { createContext, useContext } from "react"

import DAppLogo from "../app/fake_logo.png"

/* eslint-disable @typescript-eslint/no-explicit-any */

interface HederaContextType {
  isConnected: boolean
  connect: (...args: any[]) => Promise<any>
  disconnect: (...args: any[]) => Promise<any>
  accountId: any
}

const HederaContext = createContext<HederaContextType | undefined>(undefined)

export const useHedera = () => {
  const context = useContext(HederaContext)
  if (!context) throw new Error("useHedera must be used within HederaProvider")
  return context
}

export const HederaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <HWBridgeProvider
      metadata={{
        name: "MultiChain Bridge",
        description: "MultiChain Bridge",
        icons: [DAppLogo.src],
        url: typeof window !== "undefined" ? window.location.origin : "",
      }}
      projectId={process.env.NEXT_PUBLIC_WC_PROJECT_ID!}
      connectors={[HashpackConnector, KabilaConnector]}
      chains={[HederaTestnet]}
    >
      <HederaConsumer>{children}</HederaConsumer>
    </HWBridgeProvider>
  )
}

// Wraps useWallet and exposes only the needed methods via context
const HederaConsumer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConnected, connect, disconnect } = useWallet(HashpackConnector)
  const { data: accountId } = useAccountId({ autoFetch: isConnected })
  return (
    <HederaContext.Provider
      value={{
        isConnected,
        connect,
        disconnect,
        accountId,
      }}
    >
      {children}
    </HederaContext.Provider>
  )
}
