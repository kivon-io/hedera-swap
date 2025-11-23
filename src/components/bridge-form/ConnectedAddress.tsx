import { TRANSACTION_TYPE, TransactionType } from "@/config/bridge"
import { useWalletConnect } from "@/hooks/useWalletConnect"
import { formatAddress } from "@/lib/utils"
import { useBridge } from "@/providers/BridgeProvider"
import { useWalletDialog } from "@/providers/WalletDialogProvider"
import { Button } from "../ui/button"

const ConnectedAddress = ({ type }: { type: TransactionType }) => {
  const { selected } = useBridge()
  const { evmAddress, hederaAccountId } = useWalletConnect()
  const fromNetwork = selected[type].network
  const toNetwork = selected[type].network

  const address =
    type === TRANSACTION_TYPE.FROM
      ? fromNetwork === "hedera"
        ? hederaAccountId
        : evmAddress && formatAddress(evmAddress as string)
      : toNetwork === "hedera"
      ? hederaAccountId
      : evmAddress && formatAddress(evmAddress as string)

  if (type === TRANSACTION_TYPE.FROM) {
    return address ? <Address address={address} /> : <ConnectWalletButton />
  }

  return address ? <Address address={address} /> : <ConnectWalletButton />
}

export default ConnectedAddress

const Address = ({ address }: { address: string }) => {
  return <p className='font-medium text-kivon-pink text-sm'>{address}</p>
}

const ConnectWalletButton = () => {
  const { openWalletDialog } = useWalletDialog()
  return (
    <Button
      variant='link'
      className='text-kivon-pink text-sm decoration-none hover:no-underline'
      onClick={openWalletDialog}
    >
      Connect Wallet
    </Button>
  )
}
