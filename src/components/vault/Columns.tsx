"use client"

import { ColumnDef } from "@tanstack/react-table"
import Image from "next/image"

const columns: ColumnDef<Vault>[] = [
  {
    header: "Vault",
    accessorKey: "network",
    cell: ({ row }) => {
      return (
        <div className='flex items-center gap-2'>
          <div className='relative'>
            <div className='h-8 w-8 aspect-square rounded-full bg-zinc-300 overflow-hidden relative'>
              {row.original.logo && (
                <Image
                  src={row.original.token_logo}
                  alt={row.original.native_token_symbol}
                  fill
                  className='object-cover'
                />
              )}
            </div>
            <div className='bg-zinc-200 absolute bottom-0 right-0 w-3 h-3 rounded-full border border-white overflow-hidden'>
              {row.original.logo && (
                <Image
                  src={row.original.logo}
                  alt={row.original.network}
                  fill
                  className='object-cover'
                />
              )}
            </div>
          </div>
          <div className='flex flex-col'>
            <p className='text-sm font-medium'>{row.original.network.toUpperCase()}</p>
            <p className='text-xs text-zinc-500'>{row.original.native_token_symbol}</p>
          </div>
        </div>
      )
    },
  },
  {
    header: "APY",
    accessorKey: "apy",
    cell: ({ row }) => {
      // Use optional chaining + fallback
      const apy = row.original.apy?? 0
      return <div className='text-sm font-medium'>{apy}%</div>
    },
  },
  {
    header: "TVL",
    accessorKey: "metrics.totalDeposits",
    cell: ({ row }) => {
      const totalDeposits = Number(row.original?.tvl ?? 0).toFixed(3)
      return (
        <div className='text-sm font-medium'>
          {totalDeposits} {row.original.native_token_symbol} <sub>${Number(row.original?.tvl_usd ?? 0).toFixed(3).toLocaleString()}</sub>
        </div>
      )
    },
  },
]

export default columns
