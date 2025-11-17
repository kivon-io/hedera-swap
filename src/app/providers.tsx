"use client"

import { ReactNode, useMemo, useState,useEffect } from "react"
import { HWBridgeProvider } from "@buidlerlabs/hashgraph-react-wallets"
import { HederaTestnet } from "@buidlerlabs/hashgraph-react-wallets/chains"
import { HashpackConnector, KabilaConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { bscTestnet, sepolia } from "wagmi/chains"

import DAppLogo from "./fake_logo.png"

type ProvidersProps = {
  children: ReactNode
}

const Providers = ({ children }: ProvidersProps) => {

  const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID
  const [queryClient] = useState(() => new QueryClient()) 

  const wagmiConfig = useMemo(() => {
    if (!projectId || typeof window === "undefined") {
      return undefined
    }

    return getDefaultConfig({
      appName: "Kivon Hedera Bridge",
      projectId,
      chains: [bscTestnet, sepolia],
    })
  }, [projectId])

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);


  const metadata = useMemo(
    () => ({
      name: "Kivon Hedera Bridge",
      description: "Kivon Hedera Bridge",
      icons: [DAppLogo.src],
      url: typeof window !== "undefined" ? window.location.origin : "",
    }),
    []
  )

  if (!mounted || !projectId || !wagmiConfig) {
    return null;
  }
 
  return (
    <HWBridgeProvider
      metadata={metadata}
      projectId={projectId}
      connectors={[HashpackConnector, KabilaConnector]}
      chains={[HederaTestnet]}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <RainbowKitProvider>{children}</RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </HWBridgeProvider>
  )
}

export default Providers
