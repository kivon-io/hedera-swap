"use client";

import "../styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitProvider,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import { HederaWalletProvider } from "@/context/HederaWalletContext";
import { WagmiProvider } from "wagmi";
import { mainnet, polygon, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const config = getDefaultConfig({
  appName: "MultiChain Bridge",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
  chains: [mainnet, polygon, sepolia],
});

const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WagmiProvider config={config}>
          <HederaWalletProvider>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider>
                <main className="max-w-4xl mx-auto mt-10 px-6">{children}</main>
              </RainbowKitProvider>
            </QueryClientProvider>
          </HederaWalletProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}