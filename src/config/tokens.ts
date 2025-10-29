// config/tokens.ts
import type { Address } from "viem";
import type { NetworkOption } from "@/config/networks";

/**
 * TOKENS
 * One unified object that stores token metadata (symbol, address, decimals)
 * for each network. You can easily add new networks or tokens here.
 */
export const TOKENS: Record< 
  NetworkOption,
  Record<
    string,
    {
      symbol: string;
      address: Address | string;
      decimals: number;
      native?: boolean; // if the token is the native gas token (ETH, BNB, HBAR)
    }
  >
> = {
  ethereum: {
    ETH: {
      symbol: "ETH",
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
      native: true,
    },
    USDCt: {
      symbol: "USDCt",
      address: "0xDb740b2CdC598bDD54045c1f9401c011785032A6",
      decimals: 6,
    }
  },

  bsc: {
    BNB: {
      symbol: "BNB",
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
      native: true,
    },
    USDCt: {
      symbol: "USDCt",
      address: "0xabbd60313073EB1673940f0f212C7baC5333707e",
      decimals: 6,
    },
  },

  hedera: {
    HBAR: {
      symbol: "HBAR",
      address: "0x0000000000000000000000000000000000000000",
      decimals: 8,
      native: true,
    },
    SAUCE: {
      symbol: "SAUCE",
      address: "0.0.1183558",
      decimals: 6,
    },
    CLXY: {
      symbol: "CLXY",
      address: "0.0.5365",
      decimals: 6,
    },
    DAI: {
      symbol: "DAI",
      address: "0.0.5529",
      decimals: 8,
    }
  }
};