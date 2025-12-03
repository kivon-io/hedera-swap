"use client"

import { useState, useEffect } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider, createConfig, createStorage } from "wagmi"
import { fallback, http } from "viem"
import { connectorsForWallets, RainbowKitProvider } from "@rainbow-me/rainbowkit"
import {ClientOnly} from "@/app/ClientOnly"

import {
  injectedWallet,
  metaMaskWallet,
  phantomWallet,
  walletConnectWallet,
  braveWallet,
  rabbyWallet,
  ledgerWallet,
  safeWallet,
  rainbowWallet,
  bitgetWallet,
} from "@rainbow-me/rainbowkit/wallets"

import { mainnet, arbitrum, base, optimism, bsc } from "wagmi/chains"

import { HWBridgeProvider } from "@buidlerlabs/hashgraph-react-wallets"
import { HederaMainnet } from "@buidlerlabs/hashgraph-react-wallets/chains"
import { HashpackConnector, KabilaConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"

import { WalletDialogProvider } from "@/providers/WalletDialogProvider"

// ========================================================
// 1️⃣ Build connectors ONCE (never inside component)
// ========================================================
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID!

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [
        injectedWallet,
        (opts) =>
          metaMaskWallet({
            ...opts,
            projectId,
          }),
        walletConnectWallet,
        phantomWallet,
        braveWallet,
        bitgetWallet,
        rabbyWallet,
        safeWallet,
        ledgerWallet,
        rainbowWallet,
      ],
    },
  ],
  {
    appName: "Kivon Hedera Bridge",
    projectId,
    appUrl: typeof window !== "undefined" ? window.location.origin : "",
  }
)

// ========================================================
// 2️⃣ Build wagmi config ONCE (client-only, no SSR)
// ========================================================
const wagmiConfig = createConfig({
  ssr: false,
  chains: [mainnet, arbitrum, base, optimism, bsc],
  connectors,
  transports: {
    [mainnet.id]: fallback([
      http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
    ]),
    [arbitrum.id]: fallback([
      http(`https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
    ]),
    [base.id]: fallback([
      http(`https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
    ]),
    [optimism.id]: fallback([
      http(`https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
    ]),
    [bsc.id]: http(`https://bnb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
  },
  storage: typeof window !== "undefined" ? createStorage({ storage: window.localStorage }) : undefined,
})

const queryClient = new QueryClient()

// ========================================================
// 3️⃣ Providers component
// ========================================================
export default function Providers({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])

  const metadata = {
    name: "Kivon Hedera Bridge",
    description: "Kivon Hedera Bridge",
    icons: [
      "https://trusty-dinosaur-aff6ef4f16.media.strapiapp.com/04_Coloured_c41a6772d1.png",
    ],
    url: typeof window !== "undefined" ? window.location.origin : "",
  }

  return (
    <WalletDialogProvider>
      {isClient ? (
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              <HWBridgeProvider
                metadata={metadata}
                projectId={projectId}
                connectors={[HashpackConnector, KabilaConnector]}
                chains={[HederaMainnet]}
              >
                {children}
              </HWBridgeProvider>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      ) : (
        // On server, just render children so context exists
        children
      )}
    </WalletDialogProvider>
  )
}
