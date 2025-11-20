"use client"
//seimulating redeployment
import { TABS } from "@/config/vault"
import { useVault } from "@/providers/VaultProvider"
import DepositAction from "./DepositAction"
import WithdrawAction from "./WithdrawAction"

const VaultAction = () => {
  const { activeTab } = useVault()
  return <>{activeTab === TABS.DEPOSIT ? <DepositAction/> : <WithdrawAction/>}</>
}
export default VaultAction