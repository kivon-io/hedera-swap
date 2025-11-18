// config/tokens.ts
import type { NetworkOption } from "@/config/networks"
import type { Address } from "viem"

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
      symbol: string
      address: Address | string
      decimals: number
      native?: boolean // if the token is the native gas token (ETH, BNB, HBAR)
      metadata?: {
        logoUrl?: string
      }
    }
  >
> = {
  ethereum: {
    ETH: {
      symbol: "ETH",
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
      native: true,
      metadata: {
        logoUrl: "https://token-icons.s3.amazonaws.com/eth.png",
      },
    },
    USDCt: {
      symbol: "USDCt",
      address: "0xDb740b2CdC598bDD54045c1f9401c011785032A6",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
      },
    },
  },

  binance: {
    BNB: {
      symbol: "BNB",
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
      native: true,
      metadata: {
        logoUrl: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png?1644979850",
      },
    },
    USDC: {
      symbol: "USDC",
      address: "0xabbd60313073EB1673940f0f212C7baC5333707e",
      decimals: 18,
      native: false,
      metadata: {
        logoUrl: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
      },
    },
  },

  hedera: {
    HBAR: {
      symbol: "HBAR",
      address: "0x0000000000000000000000000000000000000000",
      decimals: 8,
      native: true,
      metadata: {
        logoUrl: "https://assets.coingecko.com/coins/images/3688/standard/hbar.png?1696504364",
      },
    },
    SAUCE: {
      symbol: "SAUCE",
      address: "0.0.1183558",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl:
          "https://assets.coingecko.com/coins/images/27401/standard/SAUCE_ICON_FINAL_200x200.png?1748588084",
      },
    },
    CLXY: {
      symbol: "CLXY",
      address: "0.0.5365",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl:
          "https://assets.coingecko.com/coins/images/25638/standard/CLXY_logo_sm.png?1696524772",
      },
    },
    DAI: {
      symbol: "DAI",
      address: "0.0.5529",
      decimals: 8,
      native: false,
      metadata: {
        logoUrl: "https://assets.coingecko.com/coins/images/9956/standard/Badge_Dai.png?1696509996",
      },
    },
  },
}
