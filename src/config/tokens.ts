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

    WBTC: {
      symbol: "WBTC",
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      decimals: 8,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400",
      },
    },

    USDC: {
      symbol: "USDC",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
      },
    },

    USDT: {
      symbol: "USDT",
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661",
      },
    },
  },

  arbitrum: {
    ETH: {
      symbol: "ETH",
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
      native: true,
      metadata: {
        logoUrl: "https://token-icons.s3.amazonaws.com/eth.png",
      },
    },

    WBTC: {
      symbol: "WBTC",
      address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
      decimals: 8,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400",
      },
    },

    USDC: {
      symbol: "USDC",
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
      },
    },

    USDT: {
      symbol: "USDT",
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661",
      },
    },
  },

  optimism: {
    ETH: {
      symbol: "ETH",
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
      native: true,
      metadata: {
        logoUrl: "https://token-icons.s3.amazonaws.com/eth.png",
      },
    },

    WBTC: {
      symbol: "WBTC",
      address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
      decimals: 8,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400",
      },
    },

    USDC: {
      symbol: "USDC",
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
      },
    },

    USDT: {
      symbol: "USDT",
      address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661",
      },
    },
  },

  base: {
    ETH: {
      symbol: "ETH",
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
      native: true,
      metadata: {
        logoUrl: "https://token-icons.s3.amazonaws.com/eth.png",
      },
    },

    WBTC: {
      symbol: "WBTC",
      address: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
      decimals: 8,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400",
      },
    },

    USDC: {
      symbol: "USDC",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
      },
    },

    USDT: {
      symbol: "USDT",
      address: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661",
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
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18,
      native: false,
      metadata: {
        logoUrl: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
      },
    },

    BTCB: {
      symbol: "BTCB",
      address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
      decimals: 18,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400",
      },
    },

    // ETH: {
    //   symbol: "ETH",
    //   address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
    //   decimals: 18,
    //   native: false,
    //   metadata: {
    //     logoUrl: "https://token-icons.s3.amazonaws.com/eth.png",
    //   },
    // },

    USDT: {
      symbol: "USDT",
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661",
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
      address: "0.0.731861",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl:
          "https://assets.coingecko.com/coins/images/27401/standard/SAUCE_ICON_FINAL_200x200.png?1748588084",
      },
    },
    PACK: {
      symbol: "PACK",
      address: "0.0.4794920",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/38078/large/token.png?1718152817",
      },
    },
    WBTC: {
      symbol: "WBTC",
      address: "0.0.10082597",
      decimals: 8,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400",
      },
    },
    WETH: {
      symbol: "WETH",
      address: "0.0.9770617",
      decimals: 8,
      native: false,
      metadata: {
        logoUrl: "https://token-icons.s3.amazonaws.com/eth.png",
      },
    },
    USDC: {
      symbol: "USDC",
      address: "0.0.456858",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/6319/large/usdc.png?1696506694",
      },
    },
    USDT: {
      symbol: "USDT",
      address: "0.0.1055472",
      decimals: 6,
      native: false,
      metadata: {
        logoUrl: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661",
      },
    },
  },
}
