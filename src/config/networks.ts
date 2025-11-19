// config/networks.ts
import type { Address } from "viem"

export type NetworkOption = "ethereum" | "binance" | "hedera" | "arbitrum" | 'base' | 'optimism'

export const NETWORKS: NetworkOption[] = ["ethereum", "binance", "hedera", 'arbitrum', 'base', 'optimism']

export const CONTRACT_ADDRESSES: Record<NetworkOption, Address | string> = {
  ethereum: "0xe179c49A5006EB738A242813A6C5BDe46a54Fc5C",
  arbitrum: "0x119d249246160028fcCCc8C3DF4a5a3C11dc9a6B",
  base: "0xe179c49A5006EB738A242813A6C5BDe46a54Fc5C", 
  optimism: "0x119d249246160028fcCCc8C3DF4a5a3C11dc9a6B", 
  binance: "0x119d249246160028fcCCc8C3DF4a5a3C11dc9a6B",
  hedera: "0.0.10115692",
}

export const CHAIN_IDS: Record<NetworkOption, number> = {
  ethereum: 1,
  binance: 56,        
  hedera: 295, 
  arbitrum: 42161, 
  base: 8453,
  optimism: 10, 
}

export const NETWORKS_INFO = [
  {
    id: CHAIN_IDS.ethereum,
    name: "Ethereum",
    symbol: "ETH",
    address: CONTRACT_ADDRESSES.ethereum,
    decimals: 18,
    native: true,
    metadata: {
      logoUrl: "https://token-icons.s3.amazonaws.com/eth.png",
    },
  },
  {
    id: CHAIN_IDS.binance,
    name: "Binance",
    symbol: "BNB",
    address: CONTRACT_ADDRESSES.binance,
    decimals: 18,
    native: true,
    metadata: {
      logoUrl: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png?1644979850",
    },
  },
  {
    id: CHAIN_IDS.hedera,
    name: "Hedera",
    symbol: "HBAR",
    address: CONTRACT_ADDRESSES.hedera,
    decimals: 8,
    native: true,
    metadata: {
      logoUrl: "https://assets.coingecko.com/coins/images/3688/standard/hbar.png?1696504364",
    },
  },
  {
    id: CHAIN_IDS.arbitrum,
    name: "Arbitrum",
    symbol: "ETH",
    address: CONTRACT_ADDRESSES.arbitrum,
    decimals: 18,
    native: true,
    metadata: {
      logoUrl: "https://moralis.com/wp-content/uploads/2025/03/Arbitrum-Chain-Hero-Image.webp",
    },
  },
  {
    id: CHAIN_IDS.base,
    name: "Base",
    symbol: "ETH",
    address: CONTRACT_ADDRESSES.base,
    decimals: 18,
    native: true,
    metadata: {
      logoUrl: "https://basetradingbots.com/wp-content/uploads/2024/04/base.png",
    },
  },
  {
    id: CHAIN_IDS.optimism,
    name: "Optimism",
    symbol: "ETH",
    address: CONTRACT_ADDRESSES.optimism,
    decimals: 18,
    native: true,
    metadata: {
      logoUrl: "https://coin-images.coingecko.com/coins/images/25244/large/Optimism.png",
    },
  },
]
