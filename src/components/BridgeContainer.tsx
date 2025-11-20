"use client"
import { TOKENS } from "@/config/tokens"
import Image from "next/image"
import React from "react"

const BridgeContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className='max-w-md w-full mx-auto flex flex-col gap-2 p-0 relative z-10'>
      <div className='flex gap-4 items-center rounded-2xl px-2.5 py-2 bg-linear-to-r from-neutral-50 to-neutral-200 border border-zinc-200'>
        <div className='flex flex-col border-r border-zinc-200 pr-4 gap-1'>
          <p className='text-xs text-zinc-500'>Powered by</p>
          <div className='flex gap-2 items-center'>
            <div className='h-6 w-6 bg-zinc-700 rounded-full relative'>
              <Image
                src={TOKENS.hedera.HBAR.metadata?.logoUrl || ""}
                alt='Hedera'
                width={24}
                height={24}
                className='object-cover'
              />
            </div>
            <p className='text-sm font-medium text-zinc-900'>Hedera</p>
          </div>
        </div>
        <p className='text-base text-zinc-900'>Multichain swap</p>
      </div>
      <div className='p-2 md:p-4 bg-zinc-50 text-zinc-800 border border-zinc-200 rounded-2xl flex flex-col gap-4'>
        {children}
      </div>
    </div>
  )
}
export default BridgeContainer
