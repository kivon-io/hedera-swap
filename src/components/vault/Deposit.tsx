"use client"

import { useEvmWallet } from "@/hooks/useEvmWallet"
import { formatAddress } from "@/lib/utils"
import { useVault } from "@/providers/VaultProvider"
import Image from "next/image"
import { Input } from "../ui/input"

const Deposit = () => {
  const { vault } = useVault()
  return (
    <div className='relative w-full'>
      <div className='flex justify-between items-center'>
        <p className='text-sm text-zinc-600 capitalize'>From wallet</p>
        <ConnectedWallet />
      </div>
      <div className='flex gap-2 w-full'>
        <div className='w-full'>
          <Input
            className=' border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 text-lg md:text-2xl h-11 font-medium'
            placeholder='0'
          />
        </div>
        <div className='rounded-full px-2 py-1.5 flex items-center gap-4 cursor-pointer border border-zinc-200  bg-zinc-100'>
          <div className='flex items-center gap-2'>
            <div className='relative'>
              <div className='h-7 w-7 aspect-square rounded-full bg-zinc-300 overflow-hidden relative'>
                {vault.token.metadata?.logoUrl ? (
                  <Image
                    src={vault.token.metadata.logoUrl}
                    alt={vault.token.name}
                    fill
                    className='object-cover'
                  />
                ) : null}
              </div>
              <div className='absolute bottom-0 right-0 w-3 h-3 rounded-full border border-white overflow-hidden'>
                {vault.network.metadata?.logoUrl ? (
                  <Image
                    src={vault.network.metadata.logoUrl}
                    alt={vault.network.name}
                    fill
                    className='object-cover'
                  />
                ) : (
                  <div className='w-full h-full bg-zinc-600 rounded-full'></div>
                )}
              </div>
            </div>
            <div className='flex flex-col -space-y-0.5'>
              <p className='text-sm font-medium'>{vault.token.name}</p>
              <span className='text-[10px] text-zinc-500 uppercase'>{vault.network.name}</span>
            </div>
          </div>
        </div>
      </div>
      {/* TODO: Show the price of the asset */}
      <p className='text-xs text-zinc-600'>$0.00</p>
    </div>
  )
}

export default Deposit

// TODO: Show Connected Wallet
const ConnectedWallet = () => {
  const { address } = useEvmWallet()
  return <div className='text-sm font-semibold'>{formatAddress(address ?? "")}</div>
}
