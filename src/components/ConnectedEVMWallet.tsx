import { useEvmWallet } from "@/hooks/useEvmWallet"
import { formatAddress } from "@/lib/utils"

// TODO: Show Connected Wallet
const ConnectedEVMWallet = () => {
  const { address, isConnected } = useEvmWallet()

  if (!isConnected) return null

  return <div className='text-sm font-semibold'>{formatAddress(address ?? "")}</div>
}

export default ConnectedEVMWallet
