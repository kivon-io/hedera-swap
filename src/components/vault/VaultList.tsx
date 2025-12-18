"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DataTable } from "../ui/data-table"
import columns from "./Columns"

const VaultList = () => {
  const router = useRouter()

  const [vaults, setVaults] = useState([])     // <-- holds updated vaults
  const [loading, setLoading] = useState(true)

  const handleRowClick = (row: Vault) => {
    router.push(`/liquidity/${row.network}`)
  }

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`/api/vault/all`)
        const data = await response.json()
        // console.log("all volts")
        // console.log(data?.data); 
        setVaults(data?.data)
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
