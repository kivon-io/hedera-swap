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

const VaultProvider = ({ children, vault: initialVault }: { children: React.ReactNode; vault: Vault }) => {
  const [activeTab, setActiveTab] = useState<keyof typeof TABS>("DEPOSIT")
  const [depositAmount, setDepositAmount] = useState<number | string>(0); 

  const [vault, setVault] = useState<Vault>({
    ...initialVault,
    metrics: {
      apy: 0,
      tvl: 0,
      feesGenerated: 0,
    },
  })

  const handleTabChange = (tab: keyof typeof TABS) => {
    setActiveTab(tab)
  }

  useEffect(() => {
    if (!vault?.network?.slug) return

    const getMetrics = async () => {
      try {
        const res = await fetch(`/api/vault?network=${vault.network.slug}`)
        const data = await res.json()

        setVault((prev) => ({
          ...prev,
          metrics: {
            apy: data.apy,
            tvl: data.tvl,
            feesGenerated: data.feesGenerated,
          },
        }))
      } catch (err) {
        console.error("Failed to load vault metrics", err)
      }
    }

    getMetrics()
  }, [vault.network.slug])

  const values = useMemo(() => ({ vault, activeTab, handleTabChange, depositAmount, setDepositAmount }), [vault, activeTab, depositAmount])

  return <VaultContext.Provider value={values}>{children}</VaultContext.Provider>
}

const useVault = () => {
  const context = use(VaultContext)
  if (!context) throw new Error("useVault must be used within VaultProvider")
  return context
}

export { useVault, VaultProvider }
