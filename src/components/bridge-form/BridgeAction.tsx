"use client"

import { useBridge } from "@/providers/BridgeProvider"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "../ui/button"

import BRIDGE_ABI from "@/Abi/bridge.json"
import HEDERA_BRIDGE_ABI from "@/Abi/hedera_abi.json"
import { TX_MESSAGES, TX_STATUS } from "@/config/bridge"
import { CHAIN_IDS, CONTRACT_ADDRESSES, NetworkOption } from "@/config/networks"
import { TOKENS } from "@/config/tokens"
import { convertHederaIdToEVMAddress } from "@/helpers"
import { checkTokenAssociation } from "@/helpers/token"
import { useSwitchNetwork } from "@/hooks/useSwitchNetwork"
import { useWalletDialog } from "@/providers/WalletDialogProvider"
import {
  useAccountId,
  useAccountInfo,
  useApproveTokenAllowance,
  useAssociateTokens,
  useWriteContract as UseHederaWriteContract,
  useTokensBalance,
  useWallet,
  useWatchTransactionReceipt as useWatchHederaTransaction,
} from "@buidlerlabs/hashgraph-react-wallets"
import { HWCConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import { AccountId, ContractId } from "@hashgraph/sdk"
import { erc20Abi as ERC20_ABI, formatUnits, parseUnits, type Address } from "viem"
import { useBalance as evmUseBalance, useAccount, useChainId, useWriteContract } from "wagmi"
import TransactionDialog from "./TransactionDialog"

const POLL_INTERVAL = 1000

const BridgeAction = () => {
  const { selected, setTxStatus } = useBridge()
  const { address: evmAddress, isConnected: evmConnected } = useAccount()
  const { isConnected: hederaConnected } = useWallet(HWCConnector)
  const { data: hederaAccount } = useAccountId({ autoFetch: hederaConnected })

  const { writeContract: evmWriteContract, writeContractAsync: evmWriteContractAsync } =
    useWriteContract()
  const { writeContract: hederaWriteContract } = UseHederaWriteContract()

  const fromAmount = Number(selected.from.amount)
  const [depositTx, setDepositTx] = useState<string | null>(null)
  const [uDepositTx, setUdepositTx] = useState<string | null>(null)
  const [evmAprovalTx, setEvmAprovalTx] = useState<string | null>(null)
  const [withdrawTx, setWithdrawTx] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [step, setStep] = useState<number>(0)
  const [isBridging, setIsBridging] = useState(false)
  const [nonce, setNonce] = useState<string>("")

  const [minted, setMinted] = useState<boolean>(false)

  const { associateTokens } = useAssociateTokens()
  const { approve } = useApproveTokenAllowance()
  const chainId = useChainId()
  const { openWalletDialog } = useWalletDialog()

  const fromNetwork = selected.from.network
  const toNetwork = selected.to.network
  const fromToken = selected.from.token
  const toToken = selected.to.token
  const bridgeContractAddress = CONTRACT_ADDRESSES[fromNetwork] as Address | string

  const fromTokenInfo = TOKENS[fromNetwork][fromToken]
  const toTokenInfo = TOKENS[toNetwork][toToken]

  const units = TOKENS[fromNetwork][fromToken].decimals
  const value = useMemo(() => parseUnits(fromAmount.toString() || "0", units), [fromAmount, units])

  const { data: accountInfo } = useAccountInfo({ autoFetch: hederaConnected })
  const { data: tokensBalance } = useTokensBalance({
    tokens: [fromNetwork == "hedera" ? fromTokenInfo.address : ""],
    autoFetch: hederaConnected,
  })

  const hederaHTSTokenBalance = useMemo(() => {
    if (fromNetwork === "hedera" && tokensBalance) {
      const tokenBal = tokensBalance[0]?.balance ?? 0
      return tokenBal ? Number(formatUnits(tokenBal.toString(), units)) : 0
    }
    return 0
  }, [fromAmount, units, fromNetwork, tokensBalance, fromTokenInfo])

  const hbarBalance = useMemo(() => {
    if (fromNetwork === "hedera" && hederaConnected && fromTokenInfo.native) {
      const balance = accountInfo?.balance?.balance ?? 0
      return balance ? Number(formatUnits(balance.toString(), 8)) : 0
    }
    return 0
  }, [fromAmount, units, fromNetwork, tokensBalance, fromTokenInfo, hederaConnected, accountInfo])

  const { data: Erc20TokenBalance } = evmUseBalance({
    address: evmAddress,
    token: fromTokenInfo.address as Address,
  })

  const { data: EthBalance } = evmUseBalance({ address: evmAddress })

  const ethBalance = useMemo(() => {
    if (fromNetwork != "hedera" && evmConnected && fromTokenInfo.native) {
      return EthBalance?.formatted ?? 0
    }
    return 0
  }, [fromAmount, units, fromNetwork, fromTokenInfo, accountInfo])

  const erc20TokenBalance = useMemo(() => {
    if (fromNetwork != "hedera" && evmConnected && !fromTokenInfo.native) {
      return Erc20TokenBalance?.formatted ?? 0
    }
    return 0
  }, [fromAmount, units, fromNetwork, fromTokenInfo, accountInfo])

  const userBalance = useMemo(() => {
    if (fromNetwork === "hedera") {
      if (fromTokenInfo.native) return hbarBalance // HBAR
      return hederaHTSTokenBalance // HTS token
    } else {
      if (fromTokenInfo.native) return Number(ethBalance) // ETH / BNB / etc
      return Number(erc20TokenBalance) // ERC20 token
    }
  }, [
    fromNetwork,
    fromTokenInfo,
    hbarBalance,
    hederaHTSTokenBalance,
    ethBalance,
    erc20TokenBalance,
  ])
  const switchToFromChain = useSwitchNetwork(CHAIN_IDS[fromNetwork])

  const insufficientBalance = fromAmount > (userBalance || 0)
  const isFromWalletConnected = fromNetwork === "hedera" ? hederaConnected : evmConnected
  const isFromChainCorrect = fromNetwork === "hedera" ? true : chainId === CHAIN_IDS[fromNetwork]
  const isToNetworkConnected = toNetwork === "hedera" ? hederaConnected : evmConnected

  const needsChainSwitch =
    fromNetwork !== "hedera" && isFromWalletConnected && !!fromAmount && !isFromChainCorrect
  const shouldBlockForBalance = insufficientBalance && !needsChainSwitch

  const isDisabled =
    !fromAmount ||
    shouldBlockForBalance ||
    isBridging ||
    (!needsChainSwitch && !isToNetworkConnected)

  const getButtonText = () => {
    if (!fromAmount) return "Enter amount"

    if (!isFromWalletConnected) return `Connect ${fromNetwork} wallet`
    if (fromNetwork !== "hedera" && !isFromChainCorrect) return `Switch to ${fromNetwork}`
    if (!isToNetworkConnected) return `Connect ${toNetwork} wallet`

    if (insufficientBalance) return `Insufficient ${fromToken} for bridge`

    if (isBridging) return `Bridging...`

    return `Bridge ${fromAmount} ${selected.from.token} → ${selected.to.token}`
  }

  useEffect(() => {
    console.log("Account Info Updated: ", accountInfo)
    console.log("Tokens Balance Updated: ", hederaHTSTokenBalance)
    console.log("The token balance: ", tokensBalance)
    console.log("The hbar balance: ", hbarBalance)

    console.log("eth balance", ethBalance)
    console.log("erc20 balance", erc20TokenBalance)
  }, [accountInfo, tokensBalance, erc20TokenBalance, ethBalance])

  // Check allowance (EVM)
  // const { data: allowance } = useReadContract({
  //   abi: ERC20_ABI,
  //   address: evmConnected && !TOKENS[fromNetwork][fromToken].native ? TOKENS[fromNetwork][fromToken].address as Address : undefined,
  //   functionName: "allowance",
  //   args: evmConnected && evmAddress ? [evmAddress as Address, bridgeContractAddress as Address] : undefined,
  //   chainId: CHAIN_IDS[fromNetwork],
  //   query: {
  //     enabled: evmConnected && !TOKENS[fromNetwork][fromToken].native && !!evmAddress && fromNetwork !== "hedera",
  //     refetchInterval: 10000,
  //   },
  // });

  type BridgeData = {
    fromNetwork: NetworkOption
    toNetwork: NetworkOption
    fromToken: string
    toToken: string
    amount: number
    fromAddress: string | AccountId | Address
    toAddress: string | AccountId | Address
    nonce?: string
  }

  const getRecipient = () => {
    if (toNetwork === "hedera") {
      return hederaAccount ? accountInfo.evm_address : evmAddress
    } else {
      return evmAddress
    }
  }

  //1. Monitor the deposit transaction confirmation
  // const {
  //   isLoading: isConfirming,
  //   isSuccess: isConfirmed,
  //   data: txReceipt,
  // } = useWaitForTransactionReceipt({
  //   hash: depositTx as Address,
  //   query: {
  //     enabled: !!depositTx && fromNetwork != 'hedera',
  //   },
  // })

  //1. Monitor evm token transaction confirmation
  // const {
  //   isLoading: approvalIsConfirming,
  //   isSuccess: approvalIsConfirmed,
  //   data: approvalTxReceipt,
  // } = useWaitForTransactionReceipt({
  //   hash: evmAprovalTx as Address,
  //   query: {
  //     enabled: !!evmAprovalTx && fromNetwork != 'hedera',
  //   },
  // })

  const evmDeposit = async (bridgeData: BridgeData) => {
    const { fromNetwork, fromToken, toNetwork, toToken, nonce } = bridgeData
    const tokenFromInfo = TOKENS[fromNetwork][fromToken]
    const tokenToInfo = TOKENS[toNetwork][toToken]
    const recipient = getRecipient()
    const args = [
      tokenFromInfo.address,
      toNetwork == "hedera"
        ? convertHederaIdToEVMAddress(tokenToInfo.address)
        : tokenToInfo.address,
      recipient,
      value,
      nonce,
      CHAIN_IDS[toNetwork],
    ]
    const isNative = TOKENS[fromNetwork][fromToken].native === true

    console.log("EVM Deposit args:", args)

    evmWriteContract(
      {
        address: bridgeContractAddress as Address,
        abi: BRIDGE_ABI,
        functionName: "bridgeDeposit",
        args,
        ...(isNative ? { value: value } : { value: BigInt(0) }),
      },
      {
        onSuccess: (hash) => {
          setStatusMessage(
            `Step 2/3: Deposit TX sent! Waiting for confirmation on ${fromNetwork}...`
          )
          setTxStatus(TX_STATUS.PENDING, TX_MESSAGES.DEPOSIT_SUCCESS)
          setDepositTx(hash)
          setUdepositTx(hash)
          notifyRelayer()
        },
        onError: (e: unknown) => {
          setIsBridging(false)
          let errMsg: string
          if (e instanceof Error) {
            errMsg = e.message
          } else if (typeof e === "object" && e !== null && "shortMessage" in e) {
            errMsg = (e as { shortMessage?: string }).shortMessage || "Unknown error"
          } else {
            errMsg = "Unknown error"
          }

          setStatusMessage(`❌ Deposit failed/rejected. ${errMsg}`)
          setTxStatus(TX_STATUS.FAILED, TX_MESSAGES.DEPOSIT_FAILED)
        },
      }
    )
  }

  const { watch: watchHedera } = useWatchHederaTransaction()

  const hederaDeposit = async (bridgeData: BridgeData) => {
    const contractId = ContractId.fromString(bridgeContractAddress as string)
    const tokenFromInfo = TOKENS[fromNetwork][fromToken]
    const tokenToInfo = TOKENS[toNetwork][toToken]
    const recipient = getRecipient()
    const { nonce } = bridgeData
    setStatusMessage(`Step 2/3: Confirming deposit in wallet...`)
    setTxStatus(TX_STATUS.PENDING, TX_MESSAGES.DEPOSIT_PENDING)
    try {
      console.log("hbar value", value)
      console.log("hbar token from info", tokenFromInfo)
      console.log("hbar token to info", tokenToInfo)
      console.log("hbar nounc", nonce)
      console.log("hbar to chain id info", CHAIN_IDS[toNetwork])
      console.log("hbar recipient info", recipient)

      const txHash = await hederaWriteContract({
        contractId,
        abi: HEDERA_BRIDGE_ABI,
        functionName: "bridgeDeposit",
        args: [
          !tokenFromInfo.native
            ? convertHederaIdToEVMAddress(tokenFromInfo.address)
            : tokenFromInfo.address,
          tokenToInfo.address,
          recipient,
          value,
          nonce,
          CHAIN_IDS[toNetwork],
        ],
        metaArgs: {
          gas: 220_000,
          amount: tokenFromInfo.native ? Number(fromAmount) : 0,
        },
      })

      console.log("hedera", txHash)
      setStatusMessage(`Step 2/3: Deposit TX sent! Waiting for confirmation on ${fromNetwork}...`)
      setTxStatus(TX_STATUS.PENDING, TX_MESSAGES.DEPOSIT_SUCCESS)
      console.log("Hedera deposit tx hash:", txHash)

      watchHedera(txHash as string, {
        onSuccess: (transaction) => {
          console.log("succesfull")
          setUdepositTx(txHash as string)
          notifyRelayer()
          return transaction
        },
        onError: (transaction, error) => {
          console.log(error)
          setStatusMessage(`❌ Deposit failed/rejected. ${error}`)
          setIsBridging(false)
          setTxStatus(TX_STATUS.FAILED, TX_MESSAGES.DEPOSIT_FAILED)
          return transaction
        },
      })
    } catch (e: unknown) {
      setIsBridging(false)
      let errMsg: string
      if (e instanceof Error) {
        errMsg = e.message
      } else if (typeof e === "object" && e !== null && "shortMessage" in e) {
        errMsg = (e as { shortMessage?: string }).shortMessage || "Unknown error"
      } else {
        errMsg = "Unknown error"
      }
      setStatusMessage(`❌ Deposit failed/rejected.`)
      setTxStatus(TX_STATUS.FAILED, TX_MESSAGES.DEPOSIT_FAILED)
      throw new Error(errMsg)
    }
  }

  const bridgeData: BridgeData = {
    fromNetwork,
    toNetwork,
    fromToken,
    toToken,
    amount: fromAmount,
    fromAddress: fromNetwork == "hedera" ? hederaAccount : evmAddress,
    toAddress: toNetwork == "hedera" ? hederaAccount : evmAddress,
    nonce,
  }

  const notifyRelayer = async () => {
    const data = await fetch("/api/bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bridgeData),
    })

    const result = await data.json()
    console.log("Bridge result:", result)

    if (result?.success) {
      setStatusMessage("Relayer Processing Withdrawal...")
      setTxStatus(TX_STATUS.PENDING, TX_MESSAGES.TRANSACTION_PENDING)
    }
    // --- Start Polling for Withdrawal Hash ---
    const poller = setInterval(async () => {
      try {
        const res = await fetch("/api/bridge/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nonce: bridgeData.nonce }),
        })
        const status = await res.json()
        console.log("Polling result:", status)
        //  Stop if no hash yet
        if (!status || !status.withdrawHash) return
        // Withdrawal hash found
        clearInterval(poller)
        setWithdrawTx(status.withdrawHash)
        setStatusMessage("Bridge Completed ✅")
        setTxStatus(TX_STATUS.SUCCESS, TX_MESSAGES.TRANSACTION_SUCCESS)
        setIsBridging(false)
        if (fromNetwork == "hedera" || toNetwork == "hedera") {
          setMinted(true)
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 2000) // Poll every 2 seconds
  }

  // const calledRef1 = useRef(false);
  // useEffect(()=>{
  //   console.log('is deposit cofirmation is hit')
  //   if (isConfirmed && !calledRef1.current){
  //     setUdepositTx(txReceipt?.transactionHash)
  //     notifyRelayer();
  //   }
  // }, [isConfirmed])

  // const calledRef = useRef(false);
  // useEffect(() => {
  //   if (fromNetwork !== "hedera" && approvalIsConfirmed && !calledRef.current) {
  //     evmDeposit(bridgeData);
  //     calledRef.current = true;
  //   }
  // }, [approvalIsConfirmed]);

  const handleBridge = useCallback(async () => {
    // Ensure from wallet is connected; if not, prompt connect
    if (!isFromWalletConnected) {
      openWalletDialog()
      return
    }
    // If EVM chain mismatch, switch and return so bridge flow doesn't proceed
    if (fromNetwork !== "hedera" && !isFromChainCorrect) {
      switchToFromChain()
      return
    }
    if (isDisabled) return
    setIsBridging(true)
    setDepositTx(null)
    setUdepositTx(null)
    setWithdrawTx(null)
    setMinted(false)
    // calledRef.current = false;
    // calledRef1.current = false;
    setStep(0)
    setStatusMessage("Checking bridge preconditions...")
    setTxStatus(TX_STATUS.PENDING, TX_MESSAGES.TRANSACTION_PENDING)

    try {
      const preCheckRes = await fetch("/api/bridge/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bridgeData),
      })
      const preCheck = await preCheckRes.json()

      console.log("Precheck result:", preCheck)

      if (!preCheck?.Data?.node_precheck?.canBridge) {
        setStatusMessage(preCheck.Data.node_precheck.message || "Cannot perform bridge")
        setIsBridging(false)
        setTxStatus(TX_STATUS.FAILED, TX_MESSAGES.TRANSACTION_FAILED)
        return
      }

      let requireAllowance = false

      if (preCheck?.Data?.node_precheck?.requireAllowance) {
        requireAllowance = preCheck.Data.node_precheck.requireAllowance
      }

      console.log("nonce from precheck", preCheck?.Data?.nonce)

      const freshNonce = preCheck?.Data?.nonce
      setNonce(freshNonce)
      bridgeData.nonce = freshNonce

      setStep(1)
      setStatusMessage("Step 1/3: Preparing wallet...")
      setTxStatus(TX_STATUS.PENDING, TX_MESSAGES.TRANSACTION_PENDING)

      if (fromNetwork === "hedera" && !fromTokenInfo.native) {
        const tokenAddr = fromTokenInfo.address
        const isAssociated = await checkTokenAssociation(hederaAccount, tokenAddr)
        if (!isAssociated) {
          setStatusMessage(`${fromToken} is not associated to your account`)
          setStep(0)
          setIsBridging(false)
          setTxStatus(TX_STATUS.PENDING, TX_MESSAGES.TOKEN_NOT_ASSOCIATED)
          return
        }
      }

      if (toNetwork === "hedera" && !toTokenInfo.native) {
        const tokenAddr = toTokenInfo.address
        const isAssociated = await checkTokenAssociation(hederaAccount, tokenAddr)
        if (!isAssociated) {
          setStatusMessage(`Step 1/3: Associating ${toToken} token...`)
          setTxStatus(TX_STATUS.PENDING, TX_MESSAGES.TOKEN_ASSOCIATING)
          await associateTokens([tokenAddr])
        }
      }

      if (fromNetwork === "hedera" && !fromTokenInfo.native) {
        const tokenAddr = fromTokenInfo.address
        if (requireAllowance) {
          setStatusMessage(`Step 1/3: Approving ${fromToken}...`)
          setTxStatus(TX_STATUS.PENDING, TX_MESSAGES.APPROVAL_PENDING)
          await approve([{ tokenId: tokenAddr, amount: Number(value) }], bridgeContractAddress)
          setStatusMessage(`Step 1/3: ${fromToken} approved.`)
          setTxStatus(TX_STATUS.SUCCESS, TX_MESSAGES.APPROVAL_SUCCESS)
        }
      }

      if (fromNetwork !== "hedera" && !fromTokenInfo.native) {
        const tokenAddr = fromTokenInfo.address

        // if (typeof allowance !== "bigint" || allowance < value) {
        if (requireAllowance) {
          setStatusMessage(`Step 1/3: Confirming approval for ${fromToken} in wallet...`)
          setTxStatus(TX_STATUS.PENDING, TX_MESSAGES.APPROVAL_PENDING)
          const approvalTrx = await evmWriteContractAsync({
            address: tokenAddr as Address,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [bridgeContractAddress as Address, value],
          })
          setStatusMessage(
            `Step 1/3: ${fromToken} approved. Waiting for transaction confirmation...`
          )
          setTxStatus(TX_STATUS.PENDING, TX_MESSAGES.APPROVAL_SUCCESS)
          setEvmAprovalTx(approvalTrx)
          // evmDeposit(bridgeData);
          // return;
        }
        // }
      }

      setStep(2)
      setStatusMessage("Step 2/3: Initiating deposit to bridge contract...")
      if (fromNetwork === "hedera") {
        await hederaDeposit(bridgeData)
        console.log("Hedera Deposit initiated.")
      } else {
        evmDeposit(bridgeData)
        console.log("EVM Deposit initiated.")
      }
      setStep(3)
      setStatusMessage("Step 3/3: Monitoring bridge execution...")
      setTxStatus(TX_STATUS.PENDING, TX_MESSAGES.TRANSACTION_PENDING)
    } catch (error: unknown) {
      setIsBridging(false)
      let errMsg: string
      if (error instanceof Error) {
        errMsg = error.message
      } else if (typeof error === "object" && error !== null && "shortMessage" in error) {
        errMsg = (error as { shortMessage?: string }).shortMessage || "Unknown error"
      } else {
        errMsg = "Unknown error"
      }
      if (!statusMessage?.startsWith("❌")) {
        setStatusMessage(`❌ Bridge flow failed`)
        setTxStatus(TX_STATUS.FAILED, TX_MESSAGES.TRANSACTION_FAILED)
      }
    }
  }, [
    selected,
    fromAmount,
    evmAddress,
    hederaAccount,
    fromNetwork,
    toNetwork,
    isDisabled,
    isFromWalletConnected,
    isFromChainCorrect,
    switchToFromChain,
    openWalletDialog,
    value,
    nonce,
    evmWriteContractAsync,
    associateTokens,
    approve,
    hederaWriteContract,
  ])

  return (
    <>
      <div className='space-y-4'>
        <Button
          className='w-full rounded-xl h-12 bg-kivon-pink hover:bg-kivon-pink/90 text-white font-semibold transition-all duration-300'
          size='lg'
          onClick={handleBridge}
          disabled={isDisabled}
        >
          {getButtonText()}
        </Button>
      </div>
      <TransactionDialog
        depositTx={uDepositTx}
        withdrawTx={withdrawTx}
        minted={minted}
        nonce={nonce}
        setMinted={setMinted}
      />
    </>
  )
}

export default BridgeAction
