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
  const lastRegisteredKey = useRef<string | null>(null)

  const registerCurrentAddresses = useCallback(async () => {
    const addresses = [
      ...(isEvmConnected && evmAddress ? [evmAddress] : []),
      ...(isHederaConnected && hederaAccountId ? [hederaAccountId] : []),
    ]

    if (!addresses.length) return

    const normalized = Array.from(
      new Set(addresses.map((addr) => addr.trim().toLowerCase()).filter(Boolean))
    )
    if (!normalized.length) return

    const key = normalized.join(",")
    if (key === lastRegisteredKey.current) return

    try {
      await registerAddresses(addresses)
      lastRegisteredKey.current = key
    } catch (error) {
      console.warn("Failed to register wallet address", error)
    }
  }, [evmAddress, hederaAccountId, isEvmConnected, isHederaConnected])

  useEffect(() => {
    registerCurrentAddresses()
  }, [registerCurrentAddresses])

  return null
}

export default WalletRegistrationWatcher
