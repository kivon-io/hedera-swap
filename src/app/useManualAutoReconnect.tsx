"use client"

import { useEffect } from "react"
import { useConnect, useConnectorClient } from "wagmi"

export function useManualAutoReconnect() {
  const { connect, connectors } = useConnect()

  useEffect(() => {
    if (typeof window === "undefined") return

    const raw = localStorage.getItem("wagmi-evm.store")
    if (!raw) return

    try {
      const parsed = JSON.parse(raw)
      const currentKey = parsed?.state?.current
      const mapValues = parsed?.state?.connections?.value

      if (!currentKey || !Array.isArray(mapValues)) return

      // find the matching connection entry
      const entry = mapValues.find(([key]) => key === currentKey)
      if (!entry) return

      const connectionData = entry[1]
      const connectorId = connectionData?.connector?.name
      if (!connectorId) return

      // find wagmi connector instance
      const connector = connectors.find((c) => c.name === connectorId)
      if (!connector) return

      // reconnect immediately
      connect({ connector })
    } catch (e) {
      console.error("Auto reconnect failed:", e)
    }
  }, [connect, connectors])
}
