"use client"

import { useCallback, useEffect } from "react"
import { useAccount, useConfig, useConnect, useDisconnect } from "wagmi"

export const LAST_CONNECTOR_ID_KEY = "wagmi.lastConnectedConnectorId"

export function useAutoConnect() {
  const isClient = typeof window !== "undefined"
  const { connect } = useConnect()
  const { isConnected, connector: activeConnector } = useAccount()
  const { disconnect } = useDisconnect()
  const config = useConfig()

  // --- Save / Clear connector ID ---
  const saveConnectorId = useCallback((connectorId: string | undefined) => {
    if (connectorId) {
      window.localStorage.setItem(LAST_CONNECTOR_ID_KEY, connectorId)
    }
  }, [])

  const clearConnectorId = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LAST_CONNECTOR_ID_KEY)
    }
  }, [])

  // --- Auto connect on mount ---
  useEffect(() => {
    if (isConnected) return
    if (!connect) return

    const lastUsedConnectorId = window.localStorage.getItem(LAST_CONNECTOR_ID_KEY)

    if (lastUsedConnectorId) {
      const lastUsedConnector = config.connectors.find(
        (connector) => connector.id === lastUsedConnectorId
      )

      if (lastUsedConnector) {
        connect({ connector: lastUsedConnector })
      } else {
        clearConnectorId()
      }
    }
  }, [isConnected, connect, config, clearConnectorId])

  // --- Track successful connections ---
  useEffect(() => {
    if (isConnected && activeConnector) {
      saveConnectorId(activeConnector.id)
    }
  }, [isConnected, activeConnector, saveConnectorId])

  // --- Guarded disconnect ---
  const guardedDisconnect = useCallback(() => {
    clearConnectorId()
    disconnect() // use Wagmi's built-in disconnect
  }, [disconnect, clearConnectorId])

  return {
    isConnected,
    activeConnector,
    guardedDisconnect,
  }
}
