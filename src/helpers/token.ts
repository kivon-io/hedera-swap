import {type NetworkOption } from "@/config/networks";

export const EXPLORER_URLS = {
  ethereum: "https://sepolia.etherscan.io/tx/",
  bsc: "https://testnet.bscscan.com/tx/",
  hedera: "https://hashscan.io/testnet/transaction/",
};

export const truncateHash = (hash: string) =>
  !hash ? "" : `${hash.slice(0, 6)}...${hash.slice(-4)}`;

export const getExplorerLink = (txHash: string, network: NetworkOption) =>
  EXPLORER_URLS[network] + txHash;
