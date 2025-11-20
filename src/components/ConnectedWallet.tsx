"use client"

import { useEvmWallet } from "@/hooks/useEvmWallet"
import { formatAddress } from "@/lib/utils"
import { useWallet, useAccountId } from "@buidlerlabs/hashgraph-react-wallets"

interface ConnectedWalletProps {
  network: string
}

const ConnectedWallet = ({ network }: ConnectedWalletProps) => {
  // EVM wallet
  const { address: evmAddress, isConnected: evmConnected } = useEvmWallet()

  // Hedera wallet
  const { isConnected: hederaConnected } = useWallet()
  const { data: hederaAccount } = useAccountId({ autoFetch: hederaConnected })

  // If network is Hedera
  if (network === "hedera") {
    if (!hederaConnected || !hederaAccount) return null
    return (
      <div className="text-sm font-semibold">
        {hederaAccount}
      </div>
    )
  }

  // Otherwise EVM
  if (!evmConnected || !evmAddress) return null
  return (
    <div className="text-sm font-semibold">
      {formatAddress(evmAddress)}
    </div>
  )
}

export default ConnectedWallet
