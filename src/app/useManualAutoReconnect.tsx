"use client"

import {  useEffect, useState } from "react"
import { Connector, CreateConnectorFn, useConnect } from "wagmi"

export function useManualAutoReconnect() {
  const { connect, connectors, connectAsync } = useConnect()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!mounted) return
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

    } catch (e: unknown) {
      console.error("Auto reconnect failed:", e)
    }
  }, [connect, connectors, mounted])
}



// "use client"

// import { useEffect, useState } from "react"
// import { useAccount, useConnect } from "wagmi"

// export function useManualAutoReconnect() {
//   const { isConnected } = useAccount()
//   const { connectors, connectAsync } = useConnect()
//   const [hydrated, setHydrated] = useState(false)

//   useEffect(() => {
//     setHydrated(true)
//   }, [])

//   useEffect(() => {
//     if (!hydrated) return
//     if (isConnected) return

//     const restore = async () => {
//       for (const connector of connectors) {
//         try {
//           // Only try eager connectors
//           if (!connector.ready || !connector.isAuthorized) continue

//           const authorized = await connector.isAuthorized()
//           if (!authorized) continue

//           await connectAsync({ connector })
//           break
//         } catch {
//           // try next connector
//         }
//       }
//     }

//     restore()
//   }, [hydrated, isConnected, connectors, connectAsync])
// }
