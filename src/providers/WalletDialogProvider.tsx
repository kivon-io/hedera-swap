"use client"

import ConnectWalletDialog from "@/components/bridge-form/ConnectWalletDialog"
import { createContext, useCallback, useContext, useMemo, useState } from "react"

type WalletDialogContextValue = {
  isWalletDialogOpen: boolean
  openWalletDialog: () => void
  closeWalletDialog: () => void
  toggleWalletDialog: () => void
  setWalletDialogOpen: (open: boolean) => void
}

const WalletDialogContext = createContext<WalletDialogContextValue | undefined>(undefined)

export function WalletDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const openWalletDialog = useCallback(() => setOpen(true), [])
  const closeWalletDialog = useCallback(() => setOpen(false), [])
  const toggleWalletDialog = useCallback(() => setOpen((v) => !v), [])
  const setWalletDialogOpen = useCallback((v: boolean) => setOpen(v), [])

  const value = useMemo<WalletDialogContextValue>(
    () => ({
      isWalletDialogOpen: open,
      openWalletDialog,
      closeWalletDialog,
      toggleWalletDialog,
      setWalletDialogOpen,
    }),
    [open, openWalletDialog, closeWalletDialog, toggleWalletDialog, setWalletDialogOpen]
  )

  return (
    <WalletDialogContext.Provider value={value}>
      {children}
      <ConnectWalletDialog open={open} onOpenChange={setOpen} />
    </WalletDialogContext.Provider>
  )
}

export function useWalletDialog() {
  const ctx = useContext(WalletDialogContext)
  if (!ctx) throw new Error("useWalletDialog must be used within a WalletDialogProvider")
  return ctx
}
