"use client"
import { TOKENS } from "@/config/tokens"
import { useWalletConnect, WalletType } from "@/hooks/useWalletConnect"
import { formatAddress } from "@/lib/utils"
import { PowerIcon } from "lucide-react"
import Image from "next/image"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog"

type ConnectWalletDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const ConnectWalletDialog = ({ open, onOpenChange }: ConnectWalletDialogProps) => {
  const {
    connect,
    isEvmConnected,
    isHederaConnected,
    hederaAccountId,
    disconnectHedera,
    evmAddress,
    disconnectEvm,
  } = useWalletConnect()

  const hedera = TOKENS.hedera.HBAR.metadata?.logoUrl
  const evm = TOKENS.ethereum.ETH.metadata?.logoUrl

  const handleConnect = (network: WalletType) => {
    connect(network)
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm rounded-2xl'>
        <DialogHeader>
          <DialogTitle>Login with your wallet</DialogTitle>
          <DialogDescription>Please select a network to connect.</DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-2'>
          {isEvmConnected ? (
            <div className='flex justify-between gap-2 w-full items-center border border-zinc-200 rounded-xl p-2'>
              <p className='text-sm font-medium'>{formatAddress(evmAddress as string)}</p>
              <Button variant='outline' size='icon-sm' onClick={disconnectEvm}>
                <PowerIcon className='size-4' />
              </Button>
            </div>
          ) : (
            <Button
              variant='outline'
              className='w-full h-12 flex items-center justify-start pl-2 shadow-sm rounded-xl'
              onClick={() => handleConnect("ethereum")}
              size='lg'
            >
              <div className='rounded-full h-8 w-8 relative overflow-hidden bg-zinc-200'>
                {evm && <Image src={evm} alt='EVM' width={32} height={32} />}
              </div>
              EVM
            </Button>
          )}
          {isHederaConnected ? (
            <div className='flex justify-between gap-2 w-full items-center border border-zinc-200 rounded-xl p-2'>
              <p className='text-sm font-medium'>{hederaAccountId}</p>
              <Button variant='outline' size='icon-sm' onClick={() => disconnectHedera()}>
                <PowerIcon className='size-4' />
              </Button>
            </div>
          ) : (
            <Button
              variant='outline'
              className='w-full h-12 flex items-center justify-start pl-2 shadow-sm rounded-xl'
              onClick={() => handleConnect("hedera")}
            >
              <div className='rounded-full h-8 w-8 relative overflow-hidden bg-zinc-200'>
                {hedera && <Image src={hedera} alt='Hedera' width={32} height={32} />}
              </div>
              Hedera
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ConnectWalletDialog
