"use client"

import { TRANSACTION_TYPE, type TransactionType } from "@/config/bridge"
import type { NetworkOption } from "@/config/networks"
import { useBridge } from "@/providers/BridgeProvider"
import Image from "next/image"
import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog"

const SelectAsset = ({
  type,
  open,
  onOpenChange,
}: {
  type: TransactionType
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const { networks, tokensByNetwork, setSelectedNetwork, setSelectedToken } = useBridge()
  const [selectedNetwork, setNetworkFilter] = useState<NetworkOption>("ethereum")

  const networksInOrder: NetworkOption[] = ["ethereum", "bsc", "hedera"]

  const networkMetaByKey = useMemo(() => {
    const bySymbol = (symbol: string) => networks.find((n) => n.symbol === symbol)
    return {
      ethereum: bySymbol("ETH"),
      bsc: bySymbol("BNB"),
      hedera: bySymbol("HBAR"),
    } as Record<NetworkOption, (typeof networks)[number] | undefined>
  }, [networks])

  const tokensForSelected = tokensByNetwork[selectedNetwork]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='text-sm'>
            {type === TRANSACTION_TYPE.FROM ? "Select From Asset" : "Select To Asset"}
          </DialogTitle>
          <DialogDescription className='sr-only'>
            Select the asset you want to bridge from or to
          </DialogDescription>
        </DialogHeader>
        <div className='relative flex flex-col gap-4'>
          <div className='flex flex-col gap-2'>
            <p className='text-xs font-medium text-zinc-500'>Filter by Network</p>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
              {networksInOrder.map((netKey) => {
                const meta = networkMetaByKey[netKey]
                const isActive = selectedNetwork === netKey
                return (
                  <div
                    key={netKey}
                    className={`p-2 cursor-pointer relative border rounded-lg w-full flex flex-col items-center justify-center transition-all duration-300 ${
                      isActive
                        ? "bg-zinc-200 border-zinc-300"
                        : "bg-zinc-100 border-zinc-200 hover:bg-zinc-200"
                    }`}
                    onClick={() => setNetworkFilter(netKey)}
                  >
                    <div className='h-6 w-6 aspect-square rounded-full bg-zinc-300 overflow-hidden relative'>
                      {meta?.metadata?.logoUrl ? (
                        <Image
                          src={meta.metadata.logoUrl}
                          alt={meta.name}
                          className='h-full w-full object-cover'
                          fill
                        />
                      ) : null}
                    </div>
                    <p className='text-sm font-medium mt-1'>{meta?.name ?? netKey}</p>
                  </div>
                )
              })}
            </div>
          </div>
          <div className='flex flex-col gap-1'>
            <p className='text-xs font-medium text-zinc-500'>Available tokens</p>
            <div className='flex flex-col gap-2 max-h-72 overflow-auto pr-1'>
              {Object.keys(tokensForSelected).map((symbol) => (
                <Assetitem
                  key={symbol}
                  asset={tokensForSelected[symbol]}
                  onClick={() => {
                    setSelectedNetwork(type, selectedNetwork)
                    setSelectedToken(type, symbol)
                    onOpenChange(false)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SelectAsset

type SimpleTokenMeta = {
  symbol: string
  metadata?: {
    logoUrl?: string
  }
}

const Assetitem = ({ asset, onClick }: { asset: SimpleTokenMeta; onClick?: () => void }) => {
  return (
    <div
      className='rounded-xl bg-white px-2 py-1.5 flex items-center gap-2 hover:bg-zinc-100 transition-all duration-300 cursor-pointer'
      onClick={onClick}
    >
      <div className='h-8 w-8 rounded-full bg-zinc-300 overflow-hidden relative'>
        {asset?.metadata?.logoUrl ? (
          <Image src={asset.metadata.logoUrl} alt={asset.symbol} fill className='object-cover' />
        ) : null}
      </div>
      <div className='flex flex-col'>
        <p className='text-sm font-medium'>{asset.symbol}</p>
        <p className='text-xs text-zinc-500'>{asset.symbol}</p>
      </div>
    </div>
  )
}
