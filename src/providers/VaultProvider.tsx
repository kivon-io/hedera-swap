"use client"

import { TABS } from "@/config/vault"
import { createContext, use, useMemo, useState, useEffect } from "react"

type VaultContextValue = {
  vault: Vault
  activeTab: keyof typeof TABS
  handleTabChange: (tab: keyof typeof TABS) => void, 
  depositAmount: number | string,
  setDepositAmount: (amount: number | string)=> void
}

const VaultContext = createContext<VaultContextValue | undefined>(undefined)

const VaultProvider = ({ children, network }: { children: React.ReactNode; network: string }) => {
  const [activeTab, setActiveTab] = useState<keyof typeof TABS>("DEPOSIT")
  const [depositAmount, setDepositAmount] = useState<number | string>(0); 

  const [vault, setVault] = useState<Vault>({
    tvl: 0,
    native_token_symbol:'',
    apy: 0,
    tvl_usd: 0,
    network: network,
    logo: "",
    token_logo: '',
    token_symbol: '', 
    feesGenerated: 0,
    network_slug: network, 
    native_token_price: 0
  })

  const handleTabChange = (tab: keyof typeof TABS) => {
    setActiveTab(tab)
  }

  useEffect(() => {
    if (!vault?.network_slug) return

    const getMetrics = async () => {
      try {
        const res = await fetch(`/api/vault?network=${vault.network_slug}`)
        const data = await res.json()

        setVault((prev) => ({
          ...prev,
            apy: data.apy,
            tvl: data.tvl,
            feesGenerated: data.feesGenerated,
            logo: data.logo,
            token_logo: data.token_logo,
            token_symbol: data.token_symbol, 
            network_slug: network,
            native_token_symbol: data.native_token_symbol,
            native_token_price: data.native_token_price

        }))
      } catch (err) {
        console.error("Failed to load vault metrics", err)
      }
    }

    getMetrics()
  }, [vault.network_slug])

  const values = useMemo(() => ({ vault, activeTab, handleTabChange, depositAmount, setDepositAmount }), [vault, activeTab, depositAmount])

  return <VaultContext.Provider value={values}>{children}</VaultContext.Provider>
}

const useVault = () => {
  const context = use(VaultContext)
  if (!context) throw new Error("useVault must be used within VaultProvider")
  return context
}

export { useVault, VaultProvider }
