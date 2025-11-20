type VaultContextValue = {
  vault: Vault
  activeTab: keyof typeof TABS
  handleTabChange: (tab: keyof typeof TABS) => void
}

type Vault = {
  tvl: string | number
  native_token_symbol:string
  apy: string | number
  tvl_usd: string | number
  network: string
  logo: string
  token_logo: string
  token_symbol: string, 
  feesGenerated: string | number
  network_slug: string 
}


