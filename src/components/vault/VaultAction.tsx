"use client"

import { TABS } from "@/config/vault"
import { useVault } from "@/providers/VaultProvider"
import { Button } from "../ui/button"

const VaultAction = () => {
  const { activeTab } = useVault()
  return <>{activeTab === TABS.DEPOSIT ? <DepositAction /> : <WithdrawAction />}</>
}

export default VaultAction

const DepositAction = () => {
  return (
    <Button className='w-full rounded-xl h-12' size={"lg"}>
      Deposit
    </Button>
  )
}

const WithdrawAction = () => {
  return (
    <Button className='w-full rounded-xl h-12' size={"lg"}>
      Withdraw
    </Button>
  )
}
