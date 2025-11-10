"use client"

import { useVault } from "@/providers/VaultProvider"
import Image from "next/image"

const VaultDetailsHeader = () => {
  const { vault } = useVault()

  return (
    <div className='relative bg-zinc-100 p-4 rounded-lg border border-zinc-200 flex flex-col gap-4'>
      <div className='flex items-center gap-2'>
        <div className='relative'>
          <div className='h-8 w-8 aspect-square rounded-full bg-zinc-300 overflow-hidden relative'>
            {vault.token.metadata?.logoUrl && (
              <Image
                src={vault.token.metadata.logoUrl}
                alt={vault.token.name}
                fill
                className='object-cover'
              />
            )}
          </div>
          <div className='bg-zinc-200 absolute bottom-0 right-0 w-3 h-3 rounded-full border border-white overflow-hidden'>
            {vault.network.metadata?.logoUrl && (
              <Image
                src={vault.network.metadata.logoUrl}
                alt={vault.network.name}
                fill
                className='object-cover'
              />
            )}
          </div>
        </div>
        <div className='flex flex-col'>
          <p className='text-sm font-medium'>{vault.token.name}</p>
          <p className='text-xs text-zinc-500'>{vault.token.symbol}</p>
        </div>
      </div>
      <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
        <HeaderItem label='APY' value={vault.metrics.apy.toString() + "%"} />
        <HeaderItem label='TVL' value={vault.metrics.totalDeposits.toString()} />
        <HeaderItem label='Fees Generated' value={vault.metrics.feesGenerated.toString()} />
      </div>
    </div>
  )
}

export default VaultDetailsHeader

const HeaderItem = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className='flex flex-col'>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='text-xl font-semibold text-foreground'>{value}</p>
    </div>
  )
}
