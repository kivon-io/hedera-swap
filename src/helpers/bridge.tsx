import { NetworkOption} from "@/config/networks"
import { TOKENS } from "@/config/tokens"
import { getExplorerLink, truncateHash } from "./token"

export type BridgeStatus = {
  step: number
  message: string
  txHash?: string
  error?: string
}

export const notifyBackend = async (
    txHash: string,
    toNetwork: NetworkOption,
    toToken: string,
    expectedReceiveAmount: string,  // Human-readable amount (e.g., '10.5') //hbar
    receivingAddress: string, 
    setBridgeStatus: (status: BridgeStatus) => void,
    setWithdrawalTxHash: (hash: string) => void,
  ) => {
    const token = TOKENS[toNetwork][toToken]; 
    const isNativeWithdrawal = token.native; 
    const decimals = token.decimals; 
    //const amountInWeiString = parseUnits(expectedReceiveAmount, decimals).toString()

    const payload = {
      chainId: toNetwork,
      recipient: receivingAddress,
      nativeAmount: isNativeWithdrawal ? expectedReceiveAmount : "0",
      tokenAddress: token.address,
      tokenAmount: isNativeWithdrawal ? "0" : expectedReceiveAmount,
    }

    try {
      const response = await fetch("/api/bridge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.status === 202) {
        // Expect 202 Accepted
        setTimeout(() => {
          setWithdrawalTxHash(data.hash)
          setBridgeStatus({
            step: 4,
            message: `✅ Withdrawal transaction submitted on ${toNetwork}`,
          })
        }, 2000)
      } else {
        // Handle 400 or 500 errors from the backend
        setBridgeStatus({
          step: 4,
          message: `❌ Withdrawal failed: ${data.error || "Unknown error"}`,
          error: data.details || data.error,
        })
      }
    } catch (error) {
      setBridgeStatus({
        step: 4,
        message: `❌ Withdrawal failed: Could not reach relayer service.`,
        txHash,
        error: String(error),
      })
    }
}


// --- RENDER HELPERS: UPDATED getButtonText ---
export const getButtonText = (
    bridgeStatus:  BridgeStatus, 
    isApproving:boolean, 
    approvalTxHash: string, 
    isConfirming:boolean,
    fromNetwork:string,
    toNetwork:string, 
    hederaConnected:boolean,
    evmConnected:boolean,
    currentChainId:number,
    CHAIN_IDS:Record<string, number>,
    isNative:boolean,
    allowance:bigint | undefined,
    isLoadingAllowance:boolean,
    fromToken:string,
    value:bigint
) => {
    // --- 1. HANDLE BRIDGE STATUS CHECKS (Priority on active transaction state) ---
    if (bridgeStatus?.step === 1 && (bridgeStatus.txHash === "pending" || isApproving))
      return "Waiting for Approval Signature..."
    if (bridgeStatus?.step === 1 && approvalTxHash) return "Waiting for Approval Confirmation..."
    if (bridgeStatus?.step === 2 && bridgeStatus.txHash === "pending")
      return "Waiting for Deposit Signature..."
    if (isConfirming) return "Confirming Deposit..."
    if (bridgeStatus && bridgeStatus.step === 3) return "Relayer Processing..."
    if (bridgeStatus?.step === 4 && !bridgeStatus.error) return "Bridge Tokens"

    // Final check - prevent bridging to the same network
    if (fromNetwork === toNetwork) {
      return "Cannot Bridge to Same Network"
    }

    // --- 2. FROM NETWORK CONNECTION/CHAIN CHECKS ---
    if (fromNetwork === "hedera" && !hederaConnected) return "Connect Hedera Wallet (From)"
    if (fromNetwork !== "hedera" && !evmConnected) return "Connect EVM Wallet (From)"
    // Check if the connected EVM wallet is on the correct chain for the "From" side
    if (fromNetwork !== "hedera" && evmConnected && currentChainId !== CHAIN_IDS[fromNetwork]) {
      return `Switch to ${fromNetwork.toUpperCase()} (From)`
    }

    // --- 3. TO NETWORK CONNECTION CHECKS (Symmetrical Logic) ---
    // If the 'To Network' is Hedera, ensure the Hedera wallet is connected.
    if (toNetwork === "hedera" && !hederaConnected) {
      return "Connect Hedera Wallet (To receive)"
    }

    // // If the 'To Network' is EVM (and the 'From Network' is Hedera), ensure EVM wallet is connected.
    // if (toNetwork !== "hedera" && !evmConnected && fromNetwork === "hedera") {
    //   return "Connect EVM Wallet (To receive)"
    // }

    // 4. ERC20 Checks - Approval Needed
    if (!isNative && evmConnected && typeof allowance === "bigint" && allowance < value) {
        if (isLoadingAllowance) return "Checking Token Allowance..."
        return "Approve " + fromToken
    }
    // --- 5. DEFAULT ACTION ---
    return "Bridge Tokens"
  }

type BridgeStatusTrackerProps = {
  status: BridgeStatus;
  depositTxHash: string | null;
  withdrawalTxHash: string | null;
  fromNetwork: NetworkOption;
  toNetwork: NetworkOption;
};
export const BridgeStatusTracker: React.FC<BridgeStatusTrackerProps> = ({ 
  status,  
  depositTxHash, 
  withdrawalTxHash, 
  fromNetwork, 
  toNetwork
 }) => {

    const getStatusColor = (step: number) => {
        if (status.step > step) return "text-green-500"
        if (status.step === step && status.error) return "text-red-500"
        if (status.step === step) return "text-yellow-500"
        return "text-gray-500"
    }
      return (
        <div className='p-3 bg-zinc-800 rounded-lg border border-zinc-700 space-y-2'>
          <p className='font-semibold text-zinc-800'>Bridge Status:</p>
          <div className={`text-sm ${getStatusColor(1)}`}>
            {status.step > 1
              ? "✅"
              : status.step === 1 && status.error
              ? "❌"
              : status.step === 1
              ? "➡️"
              : "○"}{" "}
            Step 1: Connect & Network Check
          </div>
          <div className={`text-sm ${getStatusColor(2)}`}>
            {status.step > 2
              ? "✅"
              : status.step === 2 && status.error
              ? "❌"
              : status.step === 2
              ? "⏳"
              : "○"}{" "}
            Step 2: Deposit to Volt Contract
          </div>
          <div className={`text-sm ${getStatusColor(3)}`}>
            {status.step > 3
              ? "✅"
              : status.step === 3 && status.error
              ? "❌"
              : status.step === 3
              ? "⚙️"
              : "○"}{" "}
            Step 3: Relayer Processing (Withdrawal)
          </div>
          <div
            className={`text-sm font-medium ${
              status.error ? "text-red-500" : status.step === 4 ? "text-green-500" : "text-white"
            }`}
          >
            {status.message}
          </div>
  
          {depositTxHash && (
            <p className='text-xs text-gray-300 truncate'>
              Deposit TX Hash:{" "}
              <a
                href={getExplorerLink(depositTxHash, fromNetwork)}
                target='_blank'
                rel='noopener noreferrer'
                title='Verify'
                className='text-blue-300 hover:underline'
              >
                {truncateHash(depositTxHash)}
              </a>
            </p>
          )}
  
          {withdrawalTxHash && (
            <p className='text-xs text-gray-300 truncate'>
              Withdrawal TX Hash:{" "}
              <a
                href={getExplorerLink(withdrawalTxHash, toNetwork)}
                target='_blank'
                rel='noopener noreferrer'
                title='Verify'
                className='text-blue-400 hover:underline'
              >
                {truncateHash(withdrawalTxHash)}
              </a>
            </p>
          )}
  
          {status.error && <p className='text-xs text-red-400'>Error: {status.error}</p>}
        </div>
    )
}