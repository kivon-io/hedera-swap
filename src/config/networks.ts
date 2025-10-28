// config/networks.ts
import type { Address } from "viem";

export type NetworkOption = "ethereum" | "bsc" | "hedera";

export const NETWORKS: NetworkOption[] = ["ethereum", "bsc", "hedera"];

export const CHAIN_IDS: Record<NetworkOption, number> = {
  ethereum: 11155111,
  bsc: 97,
  hedera: 296,
};

export const CONTRACT_ADDRESSES: Record<NetworkOption, Address | string> = {
  ethereum: "0x8A8Dbbe919f80Ca7E96A824D61763503dF15166f",
  bsc: "0xA1C6545861c572fc44320f9A52CF1DE32Da84Ab8",
  hedera: "0.0.7103690",
};

