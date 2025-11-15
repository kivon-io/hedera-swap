// config/networks.ts
import type { Address } from "viem"

export type NetworkOption = "ethereum" | "binance" | "hedera"

export const NETWORKS: NetworkOption[] = ["ethereum", "binance", "hedera"]

export const CONTRACT_ADDRESSES: Record<NetworkOption, Address | string> = {
  ethereum: "0xE3C9B2A7EfB6901db58B497E003B15f50c4E90D2",
  binance: "0x6C293F50Fd644ec898Cfd94AB977450E188e6078",
  hedera: "0.0.7265617",
}

export const CHAIN_IDS: Record<NetworkOption, number> = {
  ethereum: 11155111, // Sepolia Testnet
  binance: 97,        // BNB Smart Chain Testnet
  hedera: 296,       // Hedera Testnet
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
