"use client";
import "../styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";

import { HWBridgeProvider } from "@buidlerlabs/hashgraph-react-wallets"; 
import { HashpackConnector, KabilaConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors";
import { HederaTestnet } from "@buidlerlabs/hashgraph-react-wallets/chains"; 

import DAppLogo from "./fake_logo.png";

import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { bscTestnet, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

  const WALLET_CONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID!;

  const config = getDefaultConfig({
    appName: "MultiChain Bridge",
    projectId: WALLET_CONNECT_PROJECT_ID,
    chains: [bscTestnet, sepolia],
  });

  const metadata={
    name: "MultiChain Bridge",
    description: "MultiChain Bridge",
    icons: [DAppLogo.src],
    url: typeof window !== "undefined" ? window.location.origin : "",
  }; 

const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <HWBridgeProvider
        metadata={metadata}
        projectId={WALLET_CONNECT_PROJECT_ID}
        connectors={[HashpackConnector, KabilaConnector]}
        chains={[HederaTestnet]}>
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={config}>
            <RainbowKitProvider>
                <main className="max-w-4xl mx-auto mt-10 px-6">{children}</main>
            </RainbowKitProvider>
          </WagmiProvider>
        </QueryClientProvider>
        </HWBridgeProvider>
      </body>
    </html>
  );
}