"use client"

import authenticationAdapter from "@/lib/wallet/authenticationAdapter"
import { WalletDialogProvider } from "@/providers/WalletDialogProvider"
import WalletRegistrationWatcher from "@/providers/WalletRegistrationWatcher"
import { HWBridgeProvider } from "@buidlerlabs/hashgraph-react-wallets"
import { HederaMainnet } from "@buidlerlabs/hashgraph-react-wallets/chains"
import { HashpackConnector, KabilaConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import {
  connectorsForWallets,
  RainbowKitAuthenticationProvider,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit"
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

const Providers = ({ children }: ProvidersProps) => {
  const cookieString = typeof document === "undefined" ? undefined : document.cookie

  const [queryClient] = useState(() => new QueryClient())
  const [mounted, setMounted] = useState(false)
  const [authenticationStatus, setAuthenticationStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading")

  const connectors = connectorsForWallets(
    [
      {
        groupName: "Recommended",
        wallets: [
          injectedWallet,
          (walletOptions) =>
            metaMaskWallet({
              ...walletOptions,
              projectId: projectId!,
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
      projectId: projectId!,
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
            http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
          ]),
          [arbitrum.id]: fallback([
            http(`https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
          ]),
          [base.id]: fallback([
            http(
              `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
            ),
          ]),
          [optimism.id]: fallback([
            http(`https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
          ]),
          [bsc.id]: fallback([
            http(`https://bnb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
          ]),
        },
        storage:
          typeof window !== "undefined"
            ? createStorage({ storage: window.localStorage })
            : undefined,
      }),
    [connectors]
  )

  const metadata = useMemo(
    () => ({
      name: process.env.NEXT_PUBLIC_APP_NAME!,
      description: "Kivon Hedera Bridge",
      icons: ["https://trusty-dinosaur-aff6ef4f16.media.strapiapp.com/04_Coloured_c41a6772d1.png"],
      url: typeof window !== "undefined" ? window.location.origin : "",
    }),
    []
  )

  const enhancedAuthenticationAdapter = useMemo(() => {
    return {
      ...authenticationAdapter,
      verify: async (args: Parameters<typeof authenticationAdapter.verify>[0]) => {
        const verified = await authenticationAdapter.verify(args)
        setAuthenticationStatus(verified ? "authenticated" : "unauthenticated")
        return verified
      },
      signOut: async () => {
        await authenticationAdapter.signOut()
        setAuthenticationStatus("unauthenticated")
      },
    }
  }, [])
  const wagmiInitialState = useMemo(() => {
    if (!cookieString || !wagmiConfig) return undefined
    return cookieToInitialState(wagmiConfig, cookieString)
  }, [cookieString, wagmiConfig])

  useEffect(() => {
    setMounted(true)
    setAuthenticationStatus("unauthenticated")
  }, [])

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
      <WagmiProvider config={wagmiConfig} initialState={wagmiInitialState}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitAuthenticationProvider
            adapter={enhancedAuthenticationAdapter}
            status={authenticationStatus}
          >
            <RainbowKitProvider>
              <WalletDialogProvider>
                <WalletRegistrationWatcher />
                {children}
              </WalletDialogProvider>
            </RainbowKitProvider>
          </RainbowKitAuthenticationProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </HWBridgeProvider>
  )
}

export default Providers
