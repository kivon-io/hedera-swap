"use client"

import "@rainbow-me/rainbowkit/styles.css"
import "../styles/globals.css"

import { HWBridgeProvider } from "@buidlerlabs/hashgraph-react-wallets"
import { HederaTestnet } from "@buidlerlabs/hashgraph-react-wallets/chains"
import { HashpackConnector, KabilaConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"

import DAppLogo from "./fake_logo.png"

import Header from "@/components/header"
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { bscTestnet, sepolia } from "wagmi/chains"

const WALLET_CONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID!

const config = getDefaultConfig({
  appName: "Kivon Hedera Bridge",
  projectId: WALLET_CONNECT_PROJECT_ID,
  chains: [bscTestnet, sepolia],
})

const metadata = {
  name: "Kivon Hedera Bridge",
  description: "Kivon Hedera Bridge",
  icons: [DAppLogo.src],
  url: typeof window !== "undefined" ? window.location.origin : "",
}

const queryClient = new QueryClient()

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <HWBridgeProvider
          metadata={metadata}
          projectId={WALLET_CONNECT_PROJECT_ID}
          connectors={[HashpackConnector, KabilaConnector]}
          chains={[HederaTestnet]}
        >
          <QueryClientProvider client={queryClient}>
            <WagmiProvider config={config}>
              <RainbowKitProvider>
                <Header />
                <main className='max-w-4xl mx-auto mt-10 px-6'>{children}</main>
              </RainbowKitProvider>
            </WagmiProvider>
          </QueryClientProvider>
        </HWBridgeProvider>
      </body>
    </html>
  )
}
