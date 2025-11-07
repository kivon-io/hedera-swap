import { TRANSACTION_TYPE, type TransactionType } from "@/config/bridge"
import { useBridge } from "@/providers/BridgeProvider"
import { ChevronDown } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { Input } from "../ui/input"
import SelectAsset from "./SelectAsset"

const BridgeAsset = ({ type }: { type: TransactionType }) => {
  const [open, setOpen] = useState(false)
  const { selected, networks, tokensByNetwork } = useBridge()
  const current = type === TRANSACTION_TYPE.FROM ? selected.from : selected.to
  const networkSymbolMap: Record<string, string> = { ethereum: "ETH", bsc: "BNB", hedera: "HBAR" }
  const networkMeta = networks.find((n) => n.symbol === networkSymbolMap[current.network])
  const tokenMeta = tokensByNetwork[current.network]?.[current.token]

  const handleOpenSelectAsset = () => {
    setOpen(true)
  }

  return (
    <>
      <div className='relative border border-zinc-200 rounded-2xl px-4 py-6 bg-white flex flex-col gap-2'>
        <TransactionType type={type} />
        <div className='flex gap-2'>
          <div className='w-full'>
            <Input
              className=' border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 text-lg md:text-2xl h-11 font-medium'
              placeholder='0'
            />
          </div>
          <div
            className='rounded-full px-2 py-1.5 flex items-center gap-4 cursor-pointer border border-zinc-200  bg-zinc-100'
            onClick={handleOpenSelectAsset}
          >
            <div className='flex items-center gap-2'>
              <div className='relative'>
                <div className='h-7 w-7 aspect-square rounded-full bg-zinc-300 overflow-hidden relative'>
                  {tokenMeta?.metadata?.logoUrl ? (
                    <Image
                      src={tokenMeta.metadata.logoUrl}
                      alt={current.token}
                      fill
                      className='object-cover'
                    />
                  ) : null}
                </div>
                <div className='absolute bottom-0 right-0 w-3 h-3 rounded-full border border-white overflow-hidden'>
                  {networkMeta?.metadata?.logoUrl ? (
                    <Image
                      src={networkMeta.metadata.logoUrl}
                      alt={networkMeta.name}
                      fill
                      className='object-cover'
                    />
                  ) : (
                    <div className='w-full h-full bg-zinc-600 rounded-full'></div>
                  )}
                </div>
              </div>
              <div className='flex flex-col -space-y-0.5'>
                <p className='text-sm font-medium'>{current.token}</p>
                <span className='text-[10px] text-zinc-500 uppercase'>{current.network}</span>
              </div>
            </div>
            <ChevronDown className='size-4' />
          </div>
        </div>
        {/* TODO: Show the price of the asset */}
        <p className='text-xs text-zinc-600'>$0.00</p>
      </div>
      {open && <SelectAsset open={open} onOpenChange={(open) => setOpen(open)} type={type} />}
    </>
  )
}

export default BridgeAsset

const TransactionType = ({ type }: { type: TransactionType }) => {
  return (
    <p className='text-sm text-zinc-600 capitalize'>
      {type === TRANSACTION_TYPE.FROM ? TRANSACTION_TYPE.FROM : TRANSACTION_TYPE.TO}
    </p>
  )
}
