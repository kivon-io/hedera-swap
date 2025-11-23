"use client"
import { TX_MESSAGES, TX_STATUS, TxStatus } from "@/config/bridge"
import { NetworkOption } from "@/config/networks"
import { getExplorerLink } from "@/helpers/token"
import { useWalletConnect } from "@/hooks/useWalletConnect"
import { formatAddress } from "@/lib/utils"
import { useBridge } from "@/providers/BridgeProvider"
import { motion } from "framer-motion"
import Link from "next/link"
import { useEffect, useState } from "react"
import { LuCircleCheckBig, LuCircleX } from "react-icons/lu"
import { MdOutlineOpenInNew } from "react-icons/md"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import MintButton from "./MintInvoice"

const TransactionDialog = ({
  depositTx,
  withdrawTx,
  minted,
  nonce,
  setMinted,
}: {
  depositTx: string | null
  withdrawTx: string | null
  minted: boolean
  nonce: string
  setMinted: (minted: boolean) => void
}) => {
  const [open, setOpen] = useState(false)
  const { selected, txStatus } = useBridge()
  const { hederaAccountId } = useWalletConnect()
  const handleOpenChange = (open: boolean) => {
    setOpen(open)
  }
  const fromNetwork = selected.from.network
  const toNetwork = selected.to.network

  useEffect(() => {
    if (depositTx || withdrawTx || txStatus.status) {
      setOpen(true)
    }
  }, [depositTx, withdrawTx, txStatus.status])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-sm rounded-2xl'>
        <DialogHeader className='gap-1'>
          <DialogTitle className='text-center font-medium text-base'>
            Transaction Status
          </DialogTitle>
          <DialogDescription className='text-center text-sm'>
            View the status of your transaction.
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-8'>
          <TransactionHeader status={txStatus.status} />
          <div className='rounded-xl p-2 bg-zinc-100 flex flex-col gap-4 border border-zinc-200'>
            {depositTx && (
              <TransactionHash text='Deposit Transaction' hash={depositTx} network={fromNetwork} />
            )}
            {withdrawTx && (
              <TransactionHash
                text='Withdraw Transaction'
                hash={withdrawTx as string}
                network={toNetwork}
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <div className='flex flex-col gap-2 w-full'>
            {minted && (
              <MintButton
                hederaAccount={hederaAccountId}
                nonce={nonce}
                minted={minted}
                setMinted={setMinted}
              />
            )}
            <Button
              onClick={() => setOpen(false)}
              className='w-full rounded-xl'
              size='lg'
              variant='outline'
              disabled={txStatus.status === TX_STATUS.PENDING}
            >
              {txStatus.status === TX_STATUS.PENDING ? `${txStatus.message}...` : "Close"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default TransactionDialog

const TransactionHeader = ({ status }: { status: TxStatus | null }) => {
  return (
    <div className='flex flex-col gap-2 w-full'>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5 }}
        className='relative flex items-center justify-center'
      >
        {status === TX_STATUS.SUCCESS && <LuCircleCheckBig className='size-10 text-emerald-500' />}
        {status === TX_STATUS.FAILED && <LuCircleX className='size-10 text-red-500' />}
        {status === TX_STATUS.PENDING && (
          <div className='relative flex items-center justify-center size-6'>
            <span className='absolute flex size-6 rounded-full z-10'>
              <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-kivon-pink opacity-75'></span>
              <span className='absolute inline-flex size-6 rounded-full bg-kivon-pink'></span>
            </span>
          </div>
        )}
      </motion.div>
      <div className='flex flex-col gap-3 w-full'>
        <p className='text-sm font-medium text-center'>
          {status === TX_STATUS.SUCCESS
            ? TX_MESSAGES.TRANSACTION_SUCCESS
            : status === TX_STATUS.FAILED
            ? TX_MESSAGES.TRANSACTION_FAILED
            : status === TX_STATUS.PENDING
            ? TX_MESSAGES.TRANSACTION_PENDING
            : ""}
        </p>
      </div>
    </div>
  )
}

const TransactionHash = ({
  text,
  hash,
  network,
}: {
  text: string
  hash: string
  network: NetworkOption
}) => {
  const url = getExplorerLink(hash, network)

  return (
    <div className='flex flex-col gap-1'>
      <div className='flex items-center justify-between'>
        <p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>{text}</p>
        <Link
          className='flex items-center gap-1 text-kivon-pink hover:text-kivon-pink/80'
          href={url}
          target='_blank'
        >
          <p className='text-sm font-medium'>{formatAddress(hash)}</p>
          <MdOutlineOpenInNew className='size-3' />
        </Link>
      </div>
    </div>
  )
}
