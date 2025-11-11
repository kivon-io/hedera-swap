type VaultContextValue = {
  vault: Vault
  activeTab: keyof typeof TABS
  handleTabChange: (tab: keyof typeof TABS) => void
}

type Vault = {
  id: string
  address: string
  metrics: {
    totalDeposits: number
    feesGenerated: number
    apy: number
  }
  token: {
    name: string
    symbol: string
    address: string
    metadata: {
      logoUrl?: string
    }
  }
  network: {
    name: string
    symbol: string
    address: string
    metadata: {
      logoUrl?: string
    }
  }
  createdAt: number
  updatedAt: number
}
