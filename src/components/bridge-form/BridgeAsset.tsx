import { TRANSACTION_TYPE, type TransactionType } from "@/config/bridge"
import { cn } from "@/lib/utils"
import { useBridge } from "@/providers/BridgeProvider"
import { ChevronDown } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { Input } from "../ui/input"
import ConnectedAddress from "./ConnectedAddress"
import SelectAsset from "./SelectAsset"

// Utility function to compute conversion
export const calculateToAmount = (
  fromAmount: number,
  fromPrice: number,
  toPrice: number
): number => {
  if (!fromAmount || !fromPrice || !toPrice) return 0
  return parseFloat(((fromAmount * fromPrice) / toPrice).toFixed(6))
}

const BridgeAsset = ({
  type,
  fromPrice,
  toPrice,
  className,
}: {
  type: TransactionType
  fromPrice: number
  toPrice: number
  className?: string
}) => {
  const [open, setOpen] = useState(false)
  const { selected, networks, tokensByNetwork, setAmount } = useBridge()
  const current = type === TRANSACTION_TYPE.FROM ? selected.from : selected.to
  const networkSymbolMap: Record<string, string> = { ethereum: "ETH", bsc: "BNB", hedera: "HBAR" }
  const networkMeta = networks.find((n) => n.symbol === networkSymbolMap[current.network])
  const tokenMeta = tokensByNetwork[current.network]?.[current.token]
  const [fromInput, setFromInput] = useState("")
  const handleOpenSelectAsset = () => setOpen(true)

  const handleAmountChange = (value: string) => {
    setFromInput(value)
    const parsed = parseFloat(value)
    setAmount(TRANSACTION_TYPE.FROM, isNaN(parsed) ? 0 : parsed)
    setAmount(
      TRANSACTION_TYPE.TO,
      calculateToAmount(isNaN(parsed) ? 0 : parsed, fromPrice, toPrice)
    )
  }
  const price = type === TRANSACTION_TYPE.FROM ? fromPrice : toPrice

  return (
    <>
      <div
        className={cn(
          "relative border border-zinc-200 rounded-2xl px-4 py-6 bg-white flex flex-col gap-2",
          className
        )}
      >
        <TransactionType type={type} />
        <div className='flex gap-2'>
          <div className='w-full'>
            <Input
              className='border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 text-lg md:text-2xl h-11 font-medium'
              placeholder='0.00'
              value={type === TRANSACTION_TYPE.FROM ? fromInput || "" : selected.to.amount || ""}
              onKeyDown={(e) => {
                if (["e", "E", "+", "-"].includes(e.key)) {
                  e.preventDefault()
                }
              }}
              step='any'
              onChange={(e) => handleAmountChange(e.target.value)}
              disabled={type === TRANSACTION_TYPE.TO}
            />
          </div>
          <div
            className='rounded-full px-2 py-1.5 flex items-center gap-4 cursor-pointer border border-zinc-200 bg-zinc-100'
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

        {/* Price display */}
        <p className='text-xs text-zinc-600'>
          {price ? `$${(price * current.amount).toFixed(6)}` : "$0.00"}
        </p>
      </div>

      {open && <SelectAsset open={open} onOpenChange={setOpen} type={type} />}
    </>
  )
}

export default BridgeAsset

const TransactionType = ({ type }: { type: TransactionType }) => (
  <div className='flex items-center justify-between'>
    <p className='text-sm text-zinc-600 capitalize'>
      {type === TRANSACTION_TYPE.FROM ? TRANSACTION_TYPE.FROM : TRANSACTION_TYPE.TO}
    </p>
    <ConnectedAddress type={type} />
  </div>
)
