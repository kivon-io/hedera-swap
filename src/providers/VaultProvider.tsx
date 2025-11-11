"use client"

import { TABS } from "@/config/vault"
import { createContext, use, useMemo, useState } from "react"

const VaultContext = createContext<VaultContextValue | undefined>(undefined)

const VaultProvider = ({ children, vault }: { children: React.ReactNode; vault: Vault }) => {
  const [activeTab, setActiveTab] = useState(TABS.DEPOSIT)

  const handleTabChange = (tab: keyof typeof TABS) => {
    setActiveTab(tab)
  }

  const values = useMemo(() => ({ vault, activeTab, handleTabChange }), [vault, activeTab])

  return <VaultContext.Provider value={values}>{children}</VaultContext.Provider>
}

const useVault = () => {
  const context = use(VaultContext)
  if (!context) throw new Error("useVault must be used within VaultProvider")
  return context
}

export { useVault, VaultProvider }
