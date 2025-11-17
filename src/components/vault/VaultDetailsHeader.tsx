"use client"

import { useVault } from "@/providers/VaultProvider"
import Image from "next/image"
import { useEffect } from "react"



const VaultDetailsHeader = () => {
  const { vault } = useVault()

  useEffect(()=>{
    console.log(vault)
  }, [])

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
        <HeaderItem label='APY' value={vault.metrics.apy.toString() + "%"} symbol='' />
        <HeaderItem label='TVL' value={vault.metrics.tvl.toString()} symbol=""/>
        <HeaderItem label='Fees Generated' value={vault.metrics.feesGenerated.toString()} symbol={vault.token.symbol} />
      </div>
    </div>
  )
}

export default VaultDetailsHeader

const HeaderItem = ({ label, value, symbol }: { label: string; value: string, symbol: string }) => {
  return (
    <div className='flex flex-col'>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='text-xl font-semibold text-foreground'>{value} {symbol}</p>
    </div>
  )
}
