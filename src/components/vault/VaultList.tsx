"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { VAULTS } from "@/lib/data/vault"
import { DataTable } from "../ui/data-table"
import columns from "./Columns"

const VaultList = () => {
  const router = useRouter()

  const [vaults, setVaults] = useState(VAULTS)     // <-- holds updated vaults
  const [loading, setLoading] = useState(true)

  const handleRowClick = (row: Vault) => {
    router.push(`/liquidity/${row.id}`)
  }

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const updated = await Promise.all(
          VAULTS.map(async (vault) => {
            const response = await fetch(`/api/vault?network=${vault.network.name}`)
            const data = await response.json()

            return {
              ...vault,
              metrics: {
                tvl: data.tvl,
                feesGenerated: data.feesGenerated,
                apy: data.apy,
              },
            }
          })
        )

        setVaults(updated)
      } catch (error) {
        console.error("Error fetching vault metrics:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  if (loading) {
    return <p className="text-center">Loading vaults...</p>
  }

  return (
    <div className="relative mt-10 flex flex-col gap-4 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold">Vaults</h2>
      <DataTable columns={columns} data={vaults} onRowClick={handleRowClick} />
    </div>
  )
}

export default VaultList
