"use client"

import { VAULTS } from "@/lib/data/vault"
import { ColumnDef } from "@tanstack/react-table"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { DataTable } from "../ui/data-table"

const VaultList = () => {
  const router = useRouter()

  const handleRowClick = (row: Vault) => {
    router.push(`/liquidity/${row.id}`)
  }

  return (
    <div className='relative mt-10 flex flex-col gap-4 max-w-4xl mx-auto'>
      <h2 className='text-xl font-semibold'>Vaults</h2>
      <DataTable columns={columns} data={VAULTS} onRowClick={handleRowClick} />
    </div>
  )
}

export default VaultList

const columns: ColumnDef<Vault>[] = [
  {
    header: "Vault",
    accessorKey: "id",
    cell: ({ row }) => {
      return (
        <div className='flex items-center gap-2'>
          <div className='relative'>
            <div className='h-8 w-8 aspect-square rounded-full bg-zinc-300 overflow-hidden relative'>
              {row.original.token.metadata?.logoUrl && (
                <Image
                  src={row.original.token.metadata.logoUrl}
                  alt={row.original.token.name}
                  fill
                  className='object-cover'
                />
              )}
            </div>
            <div className='bg-zinc-200 absolute bottom-0 right-0 w-3 h-3 rounded-full border border-white overflow-hidden'>
              {row.original.network.metadata?.logoUrl && (
                <Image
                  src={row.original.network.metadata.logoUrl}
                  alt={row.original.network.name}
                  fill
                  className='object-cover'
                />
              )}
            </div>
          </div>
          <div className='flex flex-col'>
            <p className='text-sm font-medium'>{row.original.token.name}</p>
            <p className='text-xs text-zinc-500'>{row.original.token.symbol}</p>
          </div>
        </div>
      )
    },
  },
  {
    header: "APY",
    accessorKey: "metrics.apy",
    cell: ({ row }) => {
      return <div className='text-sm font-medium'>{row.original.metrics.apy}%</div>
    },
  },
  {
    header: "TVL",
    accessorKey: "metrics.totalDeposits",
    cell: ({ row }) => {
      return <div className='text-sm font-medium'>{row.original.metrics.totalDeposits}</div>
    },
  },
]
