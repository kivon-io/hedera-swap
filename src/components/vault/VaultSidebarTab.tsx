"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TABS } from "@/config/vault"

import { useVault } from "@/providers/VaultProvider"
import Deposit from "./Deposit"
import Withdraw from "./Withdraw"

const VaultSidebarTab = () => {
  const { activeTab, handleTabChange } = useVault()
  return (
    <Tabs
      value={activeTab as string}
      onValueChange={handleTabChange}
      className='w-full bg-white p-2 rounded-lg border border-zinc-200'
    >
      <TabsList>
        <TabsTrigger value={TABS.DEPOSIT}>{TABS.DEPOSIT}</TabsTrigger>
        <TabsTrigger value={TABS.WITHDRAW}>{TABS.WITHDRAW}</TabsTrigger>
      </TabsList>
      <TabsContent value={TABS.DEPOSIT}>
        <Deposit />
      </TabsContent>
      <TabsContent value={TABS.WITHDRAW}>
        <Withdraw />
      </TabsContent>
    </Tabs>
  )
}

export default VaultSidebarTab
