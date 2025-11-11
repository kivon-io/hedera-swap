// config/networks.ts
import type { Address } from "viem"

export type NetworkOption = "ethereum" | "binance" | "hedera"

export const NETWORKS: NetworkOption[] = ["ethereum", "binance", "hedera"]

export const CONTRACT_ADDRESSES: Record<NetworkOption, Address | string> = {
  ethereum: "0x8A8Dbbe919f80Ca7E96A824D61763503dF15166f",
  binance: "0xA1C6545861c572fc44320f9A52CF1DE32Da84Ab8",
  hedera: "0.0.7103690",
}

export const NETWORKS_INFO = [
  {
    id:11155111,
    name: "Ethereum",
    symbol: "ETH",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    native: true,
    metadata: {
      logoUrl: "https://token-icons.s3.amazonaws.com/eth.png",
    },
  },
  {
    id:97,
    name: "Binance",
    symbol: "BNB",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    native: true,
    metadata: {
      logoUrl: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png?1644979850",
    },
  },
  {
    id:296,
    name: "Hedera",
    symbol: "HBAR",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 8,
    native: true,
    metadata: {
      logoUrl: "https://assets.coingecko.com/coins/images/3688/standard/hbar.png?1696504364",
    },
  },
]
