"use client"

import { useWalletConnect } from "@/hooks/useWalletConnect"
import { useCallback, useEffect, useRef } from "react"

const registerAddresses = async (addresses: string[]) => {
  if (!addresses.length) return

  await fetch("/api/user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ addresses }),
  })
}

const WalletRegistrationWatcher = () => {
  const { isEvmConnected, evmAddress, isHederaConnected, hederaAccountId } = useWalletConnect()

  const registeredAddresses = useRef(new Set<string>())

  const registerIfNeeded = useCallback(async (address?: string | null) => {
    if (!address) return
    const normalized = address.toLowerCase()
    if (registeredAddresses.current.has(normalized)) return
    try {
      await registerAddresses([address])
      registeredAddresses.current.add(normalized)
    } catch (error) {
      console.error("Failed to register wallet address", error)
    }
  }, [])

  useEffect(() => {
    if (isEvmConnected && evmAddress) {
      registerIfNeeded(evmAddress)
    }
  }, [isEvmConnected, evmAddress, registerIfNeeded])

  useEffect(() => {
    if (isHederaConnected && hederaAccountId) {
      registerIfNeeded(hederaAccountId)
    }
  }, [isHederaConnected, hederaAccountId, registerIfNeeded])

  return null
}

export default WalletRegistrationWatcher
