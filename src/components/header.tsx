"use client"

import { useAutoConnect } from "@/hooks/useAutoConnect"
import { useEvmWallet } from "@/hooks/useEvmWallet"
import { formatAddress } from "@/lib/utils"
import { useAccountId, useWallet } from "@buidlerlabs/hashgraph-react-wallets"
import { HashpackConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import { PowerIcon, WalletIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import Logo from "./logo"
import { Button } from "./ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"

const Header = () => {
  return (
    <div className=' h-12 bg-zinc-200 w-full flex items-center justify-center px-4 md:px-0 relative z-10'>
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline'>
                <WalletIcon className='size-4' />
              </Button>
            </PopoverTrigger>
            <PopoverContent align='end' className='bg-white p-0 text-sm shadow-none'>
              <div className='flex flex-col items-center gap-2 p-1'>
                <EVMWallet />
                <HederaWallet />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}

export default Header

const EVMWallet = () => {
  const { address, connect } = useEvmWallet()
  const [mounted, setMounted] = useState(false)
  const { isConnected, guardedDisconnect } = useAutoConnect()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className='w-full flex items-center justify-between'>
      {isConnected ? (
        <div className='flex justify-between gap-2 w-full items-center border border-zinc-200 rounded-xl p-2'>
          <p className='text-sm font-medium'>{formatAddress(address as string)}</p>
          <Button variant='outline' size='icon-sm' onClick={guardedDisconnect}>
            <PowerIcon className='size-4' />
          </Button>
        </div>
      ) : (
        <Button className='w-full' variant='outline' onClick={connect}>
          Connect EVM Wallet
        </Button>
      )}
    </div>
  )
}

const HederaWallet = () => {
  const { isConnected, connect, disconnect } = useWallet(HashpackConnector)
  const { data: accountId } = useAccountId({ autoFetch: isConnected })

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className='w-full flex items-center justify-between'>
      {isConnected ? (
        <div className='flex justify-between gap-2 w-full items-center border border-zinc-200 rounded-xl p-2'>
          <p className='text-sm font-medium'>{accountId}</p>
          <Button variant='outline' size='icon-sm' onClick={() => disconnect()}>
            <PowerIcon className='size-4' />
          </Button>
        </div>
      ) : (
        <Button className='w-full' variant='secondary' onClick={() => connect()}>
          Connect Hedera Wallet
        </Button>
      )}
    </div>
  )
}

// <ButtonGroup>
//   <Button variant='outline'>{formatAddress(address as string)}</Button>
//   <Popover>
//     <PopoverTrigger asChild>
//       <Button variant='outline' size='icon' aria-label='Open Popover'>
//         <ChevronDownIcon />
//       </Button>
//     </PopoverTrigger>
//     <PopoverContent align='end' className='rounded-xl p-0 text-sm'>
//       <div className='px-4 py-3'>
//         <div className='text-sm font-medium'>EVM Wallet</div>
//       </div>
//       <Separator />
//       <div className='p-2'>
//         <Button className='w-full' variant='outline' onClick={guardedDisconnect}>
//           Disconnect
//         </Button>
//       </div>
//     </PopoverContent>
//   </Popover>
// </ButtonGroup>

// <ButtonGroup>
//   <Button variant='outline'>{accountId}</Button>
//   <Popover>
//     <PopoverTrigger asChild>
//       <Button variant='outline' size='icon' aria-label='Open Popover'>
//         <ChevronDownIcon />
//       </Button>
//     </PopoverTrigger>
//     <PopoverContent align='end' className='rounded-xl p-0 text-sm'>
//       <div className='px-4 py-3'>
//         <div className='text-sm font-medium'>Hedera Wallet</div>
//       </div>
//       <Separator />
//       <div className='p-2'>
//         <Button className='w-full' variant='outline' onClick={() => disconnect()}>
//           Disconnect
//         </Button>
//       </div>
//     </PopoverContent>
//   </Popover>
// </ButtonGroup>
