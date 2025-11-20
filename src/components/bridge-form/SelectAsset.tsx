"use client"

import { TRANSACTION_TYPE, type TransactionType } from "@/config/bridge"
import { type NetworkOption, NETWORKS, NETWORKS_INFO } from "@/config/networks"
import { TOKENS } from "@/config/tokens"
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
  const { selected, setSelectedNetwork, setSelectedToken } = useBridge()
  const [tempNetwork, setTempNetwork] = useState<NetworkOption>(selected[type].network)

  const networkMetaByKey = useMemo(() => {
    const map = {} as Record<NetworkOption, (typeof NETWORKS_INFO)[number]>
    NETWORKS.forEach((netKey) => {
      // Find network info by matching symbol from NETWORKS_INFO
      const meta = NETWORKS_INFO.find(
        (n) =>
          n.name.toLowerCase() === netKey.toLowerCase() ||
          n.symbol.toLowerCase() === netKey.toLowerCase()
      )
      if (meta) map[netKey] = meta
    })
    return map
  }, [])

  /**
   * Filter networks dynamically — prevents selecting the same network
   */
  const filteredNetworks = useMemo(() => {
    return NETWORKS.filter((net) => {
      if (type === TRANSACTION_TYPE.FROM) return net !== selected.to.network
      if (type === TRANSACTION_TYPE.TO) return net !== selected.from.network
      return true
    })
  }, [selected, type])

  const tokensForSelected = TOKENS[tempNetwork]

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
          {/* Network Filter */}
          <div className='flex flex-col gap-2'>
            <p className='text-xs font-medium text-zinc-500'>Filter by Network</p>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
              {filteredNetworks.map((netKey) => {
                const meta = networkMetaByKey[netKey]
                const isActive = selected[type].network === netKey
                const isSelectedFilter = tempNetwork === netKey
                return (
                  <div
                    key={netKey}
                    className={`p-2 cursor-pointer relative border rounded-lg w-full flex flex-col items-center justify-center transition-all duration-300 ${
                      isSelectedFilter
                        ? "bg-zinc-200 border-zinc-300"
                        : "bg-zinc-50 border-zinc-200 hover:bg-zinc-200"
                    } ${isActive ? "ring ring-kivon-pink" : ""}`}
                    onClick={() => setTempNetwork(netKey)}
                  >
                    <div className='h-6 w-6 aspect-square rounded-full overflow-hidden relative'>
                      {meta?.metadata?.logoUrl && (
                        <Image
                          src={meta.metadata.logoUrl}
                          alt={meta.name}
                          fill
                          className='object-cover'
                        />
                      )}
                    </div>
                    <p className='text-sm font-medium mt-1'>{meta?.name ?? netKey}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tokens List */}
          <div className='flex flex-col gap-1'>
            <p className='text-xs font-medium text-zinc-500'>Available tokens</p>
            <div className='flex flex-col gap-2 max-h-72 overflow-auto pr-1'>
              {Object.keys(tokensForSelected).map((symbol) => {
                const token = tokensForSelected[symbol]
                const isSelectedToken = selected[type].token === symbol
                return (
                  <AssetItem
                    key={symbol}
                    asset={token}
                    isSelected={isSelectedToken}
                    onClick={() => {
                      setSelectedNetwork(type, tempNetwork)
                      setSelectedToken(type, symbol)
                      onOpenChange(false)
                    }}
                  />
                )
              })}
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

const AssetItem = ({
  asset,
  onClick,
  isSelected = false,
}: {
  asset: SimpleTokenMeta
  onClick?: () => void
  isSelected?: boolean
}) => {
  return (
    <div
      className={`rounded-xl px-2 py-1.5 flex items-center gap-2 transition-all duration-300 cursor-pointer ${
        isSelected ? "bg-kivon-pink/10 border border-kivon-pink" : "bg-white hover:bg-zinc-100"
      }`}
      onClick={onClick}
    >
      <div className='h-8 w-8 rounded-full bg-zinc-300 overflow-hidden relative'>
        {asset?.metadata?.logoUrl && (
          <Image src={asset.metadata.logoUrl} alt={asset.symbol} fill className='object-cover' />
        )}
      </div>
      <div className='flex flex-col'>
        <p className='text-sm font-medium'>{asset.symbol}</p>
        <p className='text-xs text-zinc-500'>{asset.symbol}</p>
      </div>
    </div>
  )
}
