"use client"

import { WalletDialogProvider } from "@/providers/WalletDialogProvider"
import { HWBridgeProvider } from "@buidlerlabs/hashgraph-react-wallets"
import { HederaMainnet } from "@buidlerlabs/hashgraph-react-wallets/chains"
import { HWCConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import { connectorsForWallets, RainbowKitProvider } from "@rainbow-me/rainbowkit"
import {
  bitgetWallet,
  braveWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  phantomWallet,
  rabbyWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useEffect, useMemo, useState } from "react"
import { fallback } from "viem"
import { cookieToInitialState, createConfig, createStorage, http, WagmiProvider } from "wagmi"
import { arbitrum, base, bsc, mainnet, optimism } from "wagmi/chains"

type ProvidersProps = {
  children: ReactNode
}

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID
const projectId2 = process.env.NEXT_PUBLIC_WC_PROJECT_ID2
const alchemy_key = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const Providers = ({ children }: ProvidersProps) => {

  const [queryClient] = useState(() => new QueryClient())
  if(!projectId2){ return; }

  const connectors = connectorsForWallets(
    [
      {
        groupName: "Recommended",
        wallets: [
          injectedWallet,
          (walletOptions) =>
            metaMaskWallet({
              ...walletOptions,
              projectId: projectId2!,
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
      projectId: projectId2!,
      appUrl: typeof window !== "undefined" ? window.location.origin : "",
    }
  )

  const wagmiConfig = useMemo(
    () =>
      createConfig({
        ssr: false,
        chains: [mainnet, arbitrum, base, optimism, bsc],
        connectors,
        transports: {
          [mainnet.id]: fallback([
            http(`https://eth-mainnet.g.alchemy.com/v2/${alchemy_key}`),
          ]),
          [arbitrum.id]: fallback([
            http(`https://arb-mainnet.g.alchemy.com/v2/${alchemy_key}`),
          ]),
          [base.id]: fallback([
            http(
              `https://base-mainnet.g.alchemy.com/v2/${alchemy_key}`
            ),
          ]),
          [optimism.id]: fallback([
            http(`https://opt-mainnet.g.alchemy.com/v2/${alchemy_key}`),
          ]),
          [bsc.id]: fallback([
            http(`https://bnb-mainnet.g.alchemy.com/v2/${alchemy_key}`),
          ]),
        },
        storage:
          typeof window !== "undefined"
            ? createStorage({ storage: window.localStorage, key: 'wagmi-evm' })
            : undefined,
      }),
    [connectors]
  )

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
      connectors={[HWCConnector]}
      chains={[HederaMainnet]}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <WalletDialogProvider>{children}</WalletDialogProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </HWBridgeProvider>
  )
}

export default Providers
