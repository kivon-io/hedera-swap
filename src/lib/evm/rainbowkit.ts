import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia, polygon, polygonAmoy } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "MultiChain Bridge",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
  chains: [mainnet, sepolia, polygon, polygonAmoy],
  ssr: true,
});
