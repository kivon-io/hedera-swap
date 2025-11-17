"use client"

import { useEffect, useMemo, useState } from "react"
import { useVault } from "@/providers/VaultProvider"
import { useAccount } from "wagmi"
import VaultSidebarTab from "./VaultSidebarTab"
import VaultAction from "./VaultAction"
import { useWallet, useAccountId } from "@buidlerlabs/hashgraph-react-wallets"

const VaultSidebar = () => {
  const { vault } = useVault()

  // EVM wallet
  const { address: evmAddress } = useAccount()

  // Hedera wallet
  const { isConnected: hederaConnected } = useWallet()
  const { data: hederaAccount } = useAccountId({ autoFetch: hederaConnected })

  const [position, setPosition] = useState(0)
  const [earned, setEarned] = useState(0)


  const wallet = useMemo(() => {
    if (vault?.network?.slug === "hedera") {
      return hederaAccount || null
    }
    return evmAddress || null
  }, [vault?.network?.slug, hederaAccount, evmAddress])



  useEffect(() => {
    if (!wallet || !vault?.id) return

    const loadUserLiquidity = async () => {
      console.log("Using wallet:", wallet)

      try {
        const res = await fetch(
          `/api/vault/user-liquidity?wallet=${wallet}&vault=${vault.network.slug}`
        )

        const data = await res.json()

        if (!data.error) {
          setPosition(Number(data.total_liquidity || 0))
          setEarned(Number(data.profit || 0))
        }
      } catch (err) {
        console.error("Failed to fetch user liquidity", err)
      }
    }

    loadUserLiquidity()
  }, [wallet, vault.id, vault.network.slug])


  return (
    <div className='relative p-4 rounded-lg border border-zinc-200 bg-zinc-100 flex flex-col gap-2'>
      <div className='flex flex-col gap-2 p-4 rounded-lg border border-zinc-200 bg-white'>
        <div className='flex justify-between items-center'>
          <p className='text-sm text-muted-foreground font-medium'>Total Locked</p>
          <p className='text-sm font-medium'>
            {position} {vault.network.symbol}
          </p>
        </div>

        <div className='flex justify-between items-center'>
          <p className='text-sm text-muted-foreground font-medium'>Amount Earned</p>
          <p className='text-sm font-medium'>
            {earned} {vault.network.symbol}
          </p>
        </div>
      </div>

      <VaultSidebarTab />
      <VaultAction/>
    </div>
  )
}

export default VaultSidebar
