"use client"

import { WalletDialogProvider } from "@/providers/WalletDialogProvider"
import { HWBridgeProvider } from "@buidlerlabs/hashgraph-react-wallets"
import { HederaMainnet } from "@buidlerlabs/hashgraph-react-wallets/chains"
import { HashpackConnector, KabilaConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useEffect, useMemo, useState } from "react"
import { WagmiProvider } from "wagmi"
import { arbitrum, base, bsc, mainnet, optimism } from "wagmi/chains"

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
      chains: [mainnet, arbitrum, base, optimism, bsc],
    })
  }, [projectId])

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const metadata = useMemo(
    () => ({
      name: "Kivon Hedera Bridge",
      description: "Kivon Hedera Bridge",
      icons: ["https://trusty-dinosaur-aff6ef4f16.media.strapiapp.com/04_Coloured_c41a6772d1.png"],
      url: typeof window !== "undefined" ? window.location.origin : "",
    }),
    []
  )

  if (!mounted || !projectId || !wagmiConfig) {
    return null
  }

  return (
    <HWBridgeProvider
      metadata={metadata}
      projectId={projectId}
      connectors={[HashpackConnector, KabilaConnector]}
      chains={[HederaMainnet]}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <RainbowKitProvider>
            <WalletDialogProvider>{children}</WalletDialogProvider>
          </RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </HWBridgeProvider>
  )
}

export default Providers
