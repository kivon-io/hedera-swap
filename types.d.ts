type VaultContextValue = {
  vault: Vault
  activeTab: keyof typeof TABS
  handleTabChange: (tab: keyof typeof TABS) => void
}

type Vault = {
  id: string
  address: string
  token: {
    name: string
    symbol: string
    address: string
    metadata: {
      logoUrl?: string
    }
  }
  network: {
    slug: string
    name: string
    symbol: string
    address: string
    metadata: {
      logoUrl?: string
    }
  }
  createdAt: number
  updatedAt: number

  // add metrics so TypeScript is happy
  metrics: {
    apy: number
    tvl: number
    feesGenerated: number
  }
}


