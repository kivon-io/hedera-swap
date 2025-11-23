"use client"

import { useWalletConnect } from "@/hooks/useWalletConnect"
import { useWalletDialog } from "@/providers/WalletDialogProvider"
import Link from "next/link"
import Logo from "./logo"
import { Button } from "./ui/button"

const Header = () => {
  const { openWalletDialog } = useWalletDialog()
  const { isEvmConnected, isHederaConnected } = useWalletConnect()

  return (
    <div className=' h-12 bg-white md:bg-zinc-200 w-full flex items-center justify-center px-4 md:px-0 relative z-10 border-b border-zinc-200 md:border-0'>
      <div className='relative max-w-7xl mx-auto w-full flex items-center justify-between'>
        <div className='flex items-center gap-2 '>
          <div className='flex items-center gap-2'>
            <Logo />
          </div>
        </div>
        <div className='flex items-center gap-4'>
          <Link href='/liquidity' className='text-sm font-medium text-zinc-900'>
            Liquidity
          </Link>
          <Button
            variant='outline'
            className='uppercase font-bold italic bg-linear-to-r from-black to-zinc-600 hover:from-zinc-600 hover:to-black text-white hover:text-white border-0 transition-all duration-300 flex items-center justify-center'
            onClick={openWalletDialog}
          >
            {(isEvmConnected || isHederaConnected) && (
              <div className='size-2 rounded-full bg-emerald-500' />
            )}
            {isEvmConnected || isHederaConnected ? "Connected" : "Connect Wallet"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Header
