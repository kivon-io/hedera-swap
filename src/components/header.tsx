"use client"

import { useEvmWallet } from "@/hooks/useEvmWallet"
import { formatAddress } from "@/lib/utils"
import { useAccountId, useWallet } from "@buidlerlabs/hashgraph-react-wallets"
import { HashpackConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import { ChevronDownIcon } from "lucide-react"
import { useEffect, useState } from "react"
import Logo from "./logo"
import { Button } from "./ui/button"
import { ButtonGroup } from "./ui/button-group"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { Separator } from "./ui/separator"

const Header = () => {
  return (
    <div className=' h-12 bg-zinc-200 w-full flex items-center justify-center px-4 md:px-0'>
      <div className='relative max-w-7xl mx-auto w-full flex items-center justify-between'>
        <div className='flex items-center gap-2 '>
          <div className='flex items-center gap-2'>
            <Logo />
          </div>
        </div>
        <div className='flex gap-2'>
          <EVMWallet />
          <HederaWallet />
        </div>
      </div>
    </div>
  )
}

export default Header

const EVMWallet = () => {
  const { address, isConnected, connect, disconnectWallet } = useEvmWallet()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div>
      {isConnected ? (
        <ButtonGroup>
          <Button variant='outline'>{formatAddress(address as string)}</Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' size='icon' aria-label='Open Popover'>
                <ChevronDownIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent align='end' className='rounded-xl p-0 text-sm'>
              <div className='px-4 py-3'>
                <div className='text-sm font-medium'>EVM Wallet</div>
              </div>
              <Separator />
              <div className='p-2'>
                <Button className='w-full' variant='outline' onClick={disconnectWallet}>
                  Disconnect
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </ButtonGroup>
      ) : (
        <Button variant='outline' onClick={connect}>
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
    <div>
      {isConnected ? (
        <ButtonGroup>
          <Button variant='outline'>{accountId}</Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' size='icon' aria-label='Open Popover'>
                <ChevronDownIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent align='end' className='rounded-xl p-0 text-sm'>
              <div className='px-4 py-3'>
                <div className='text-sm font-medium'>Hedera Wallet</div>
              </div>
              <Separator />
              <div className='p-2'>
                <Button className='w-full' variant='outline' onClick={() => disconnect()}>
                  Disconnect
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </ButtonGroup>
      ) : (
        <Button variant='secondary' onClick={() => connect()}>
          Connect Hedera Wallet
        </Button>
      )}
    </div>
  )
}
