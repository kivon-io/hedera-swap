"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  useAccountId,
  useWallet,
  useWriteContract as UseWriteContract,
  useApproveTokenAllowance,
  useBalance, 
  useTokensBalance
} from "@buidlerlabs/hashgraph-react-wallets"
import { HashpackConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import { ContractId } from "@hashgraph/sdk"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { type Address, parseUnits, erc20Abi, formatUnits} from "viem"

import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
  useBalance as wUseBalance
} from "wagmi"


import ERC20_ABI from "@/Abi/erc20.json"
import HEDERA_VOLT_ABI from "@/Abi/hedera_vault.json"
import BRIDGE_VOLT_ABI from "@/Abi/vault.json"
import { fetchTokenPrices } from "@/helpers"
import { ArrowLeftRight } from "lucide-react"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { toReadableAmount, fetchEvmBalance, calculateGasCostInToken } from "@/helpers"

/* eslint-disable @typescript-eslint/no-explicit-any */

type NetworkOption = "ethereum" | "bsc" | "hedera"

const NETWORKS: NetworkOption[] = ["ethereum", "bsc", "hedera"]

// --- CONSTANTS AND ADDRESSES ---
const CHAIN_IDS: Record<NetworkOption, number> = {
  ethereum: 11155111, // Sepolia
  bsc: 97, // BSC Testnet
  hedera: 296,
}

const CONTRACT_ADDRESSES: Record<NetworkOption, Address | string> = {
  ethereum: "0x8A8Dbbe919f80Ca7E96A824D61763503dF15166f",
  bsc: "0xA1C6545861c572fc44320f9A52CF1DE32Da84Ab8",
  hedera: "0.0.7103690",
}

const hederContractAddress = "0.0.7103690"
//const hederaCheckSum = "0xe8C85D68B840c6c5A880D5E19B81F3AfE87e2404"
const hederaTokenCheckSum = "0x00000000000000000000000000000000006c6456"

const TOKEN_ADDRESSES: Record<string, Address | string> = {
  USDC: "0xDb740b2CdC598bDD54045c1f9401c011785032A6",
  bUSDC: "0xabbd60313073EB1673940f0f212C7baC5333707e",
  hUSDC: "0.0.7103574",
  ETH: "0x0",
  BNB: "0x0",
  HBAR: "0x0",
}

const TOKENS: Record<NetworkOption, string[]> = {
  ethereum: ["ETH", "USDCt"],
  bsc: ["BNB", "USDCt"],
  hedera: ["HBAR", "USDCt"],
}

const TOKEN_DECIMALS: Record<string, number> = {
  // Stablecoins typically use 6 decimals
  USDCt: 6,
  // Native assets and others, default to 18
  ETH: 18,
  BNB: 18,
  // HBAR uses 8 decimals
  HBAR: 8,
}

const EXPLORER_URLS: Record<string, string> = {
  sepolia: "https://sepolia.etherscan.io/tx/",
  bsc: "https://testnet.bscscan.com/tx/",
  hedera: "https://hashscan.io/testnet/transaction/", // Hedera testnet explorer
}

const getExplorerLink = (txHash: string, network: NetworkOption) => {
  switch (network) {
    case "ethereum":
      return EXPLORER_URLS.sepolia + txHash
    case "bsc":
      return EXPLORER_URLS.bsc + txHash
    case "hedera":
      return EXPLORER_URLS.hedera + txHash  
    default:
      return "#"
  }
}

const truncateHash = (hash: string) => {
  if (!hash) return ""
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

const getTokenDecimals = (tokenSymbol: string): number => {
  return TOKEN_DECIMALS[tokenSymbol] ?? 18 // Default to 18 if not found
}

const PROTOCOL_FEE_PERCENT = 2
const PROTOCOL_FEE_RATE = PROTOCOL_FEE_PERCENT / 100
const DEDUCE_FEE_RATE = 1 - PROTOCOL_FEE_RATE

type TokenPrices = Record<string, number>

type BridgeStatus = {
  step: number
  message: string
  txHash?: string
  error?: string
}

// ----------------------------------------------------------------------
// --- BRIDGE FORM COMPONENT ---
// ----------------------------------------------------------------------

export default function BridgeForm() {
  // --- WAGMI HOOKS ---
  const { address: evmAddress, isConnected: evmConnected } = useAccount()
  const currentChainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { writeContract } = useWriteContract()

  // --- HEDERA HOOKS ---
  const { isConnected: hederaConnected, connect: hederaConnect } = useWallet(HashpackConnector)
  const { data: hederaAccount } = useAccountId({ autoFetch: hederaConnected })
  const { writeContract: WriteContract } = UseWriteContract()
  const { approve } = useApproveTokenAllowance()
  const { data: hBarbalance } = useBalance({ autoFetch: hederaConnected })
  const { data: hTokensBalanceData } = useTokensBalance({ autoFetch: hederaConnected, tokens: [TOKEN_ADDRESSES.hUSDC] })

  // --- STATE ---
  const [fromNetwork, setFromNetwork] = useState<NetworkOption>("ethereum")
  const [toNetwork, setToNetwork] = useState<NetworkOption>("hedera")
  const [fromToken, setFromToken] = useState<string>("ETH")
  const [toToken, setToToken] = useState<string>("HBAR")
  const [amount, setAmount] = useState<string>("")
  const [prices, setPrices] = useState<TokenPrices>({})
  const [isPriceLoading, setIsPriceLoading] = useState(false)
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null)
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null)
  // const [hederaDepositTxHash, setHederaDepositTxHash] = useState<string | null>(null)
  const [withdrawalTxHash, setWithdrawalTxHash] = useState<string | null>(null)

  // --- NEW STATES FOR APPROVAL FLOW ---
  const [isApproving, setIsApproving] = useState(false)
  const [approvalTxHash, setApprovalTxHash] = useState<Address | undefined>(undefined)
  const [networkFee, setNetworkFee] = useState<number>(0);

  // --- CONSTANTS DERIVED FROM STATE ---
  const isNative = fromToken === "ETH" || fromToken === "BNB" || fromToken === "HBAR"
  const tokenAddress = fromNetwork === 'bsc'
        ? TOKEN_ADDRESSES.bUSDC
        : fromNetwork == "hedera"
        ? TOKEN_ADDRESSES.hUSDC
        : TOKEN_ADDRESSES.USDC

  const tokenToAddress = toNetwork === 'bsc'
      ? TOKEN_ADDRESSES.bUSDC
      : toNetwork == "hedera"
      ? TOKEN_ADDRESSES.hUSDC
      : TOKEN_ADDRESSES.USDC

  const voltContractAddress = CONTRACT_ADDRESSES[fromNetwork] as Address
  const units = getTokenDecimals(fromToken)

  const value = useMemo(() => {
    return parseUnits(amount || "0", units)
  }, [amount, units])

  const receivingAddress = toNetwork === "hedera" ? hederaAccount : evmAddress

  const [balanceMsg, setBalalanceMsg] = useState(""); 

  // --- WAGMI HOOKS FOR MONITORING ---
  // 1. Monitor the deposit transaction confirmation
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: txReceipt,
  } = useWaitForTransactionReceipt({
    hash: depositTxHash as Address,
    query: {
      enabled: fromNetwork != "hedera",
    },
  })

  // 2. Monitor the approval transaction confirmation
  const { isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
    query: {
      enabled: !!approvalTxHash && bridgeStatus?.step === 1 && !isApproving,
    },
  })

  // 3. Read the current allowance the contract has over the user's tokens
  const {
    data: allowance,
    refetch: refetchAllowance,
    isLoading: isLoadingAllowance,
  } = useReadContract({
    abi: ERC20_ABI,
    address: evmConnected && !isNative ? tokenAddress as Address: undefined,
    functionName: "allowance",
    args: evmConnected && evmAddress ? [evmAddress as Address, voltContractAddress] : undefined,
    chainId: CHAIN_IDS[fromNetwork],
    query: {
      // Only enabled if EVM connected, it's an ERC20, and we have the necessary addresses
      enabled: evmConnected && !isNative && !!evmAddress && fromNetwork !== "hedera",
      refetchInterval: 10000, // Refetch allowance every 10 seconds
    },
  })

  const fromPrice = prices[fromToken] || 0
  const toPrice = prices[toToken] || 0
  const inputAmount = Number(amount)
  

  const { feeAmount, finalToAmount } = useMemo(() => {
    let rawToAmount = 0
    let fee = 0
    let finalAmount = 0

    if (inputAmount > 0 && fromPrice > 0 && toPrice > 0) {
      const usdValue = inputAmount * fromPrice
      rawToAmount = usdValue / toPrice
      fee = rawToAmount * PROTOCOL_FEE_RATE
      finalAmount = rawToAmount * DEDUCE_FEE_RATE
    }
    finalAmount -= networkFee; 
    return {
      feeAmount: fee.toFixed(4),
      finalToAmount: finalAmount.toFixed(4),
    }
  }, [inputAmount, fromPrice, toPrice])

  const notifyBackend = async (
    txHash: string,
    fromNetwork: NetworkOption,
    toNetwork: NetworkOption,
    fromToken: string,
    toToken: string,
    amount: string, // Human-readable amount (e.g., '10.5')
    expectedReceiveAmount: string // Human-readable amount (e.g., '10.5')
  ) => {
    // Determine if the withdrawal is Native (ETH/HBAR/BNB) or ERC20 (USDC/bUSDC/hUSDC)
    const isNativeWithdrawal = ["ETH", "BNB", "HBAR"].includes(toToken)
    const decimals = TOKEN_DECIMALS[toToken] || 18 // Default to 18 if not found
    // --- 1. Address Determination ---
    let finalContractAddress
    let finalTokenAddress
    const finalRecipientAddress = receivingAddress

    if (toNetwork === "hedera") {
      finalContractAddress = hederContractAddress
      finalTokenAddress = isNativeWithdrawal
        ? "0x0000000000000000000000000000000000000000"
        : hederaTokenCheckSum
    } else {
      finalContractAddress = CONTRACT_ADDRESSES[toNetwork]
      finalTokenAddress = isNativeWithdrawal
        ? "0x0000000000000000000000000000000000000000"
        : toNetwork == "bsc"
        ? TOKEN_ADDRESSES["bUSDC"]
        : TOKEN_ADDRESSES["USDC"]
    }
    const amountInWeiString = parseUnits(expectedReceiveAmount, decimals).toString()

    const payload = {
      chainId: toNetwork,
      contractAddress: finalContractAddress,
      recipient: finalRecipientAddress,

      nativeAmount: isNativeWithdrawal ? amountInWeiString : "0",
      tokenAddress: finalTokenAddress,
      tokenAmount: isNativeWithdrawal ? "0" : amountInWeiString,
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

  // --- CORE DEPOSIT FUNCTION (Extracted for sequential flow) ---
  const handleDepositTx = useCallback(
    (depositValue: bigint) => {
      if (!receivingAddress) {
        setBridgeStatus({
          step: 2,
          message: "❌ Receiving wallet address not available.",
          error: "Destination Address Missing",
        })
        setApprovalTxHash(undefined)
        return
      }

      setBridgeStatus({
        step: 2,
        message: "Step 2/3: Awaiting wallet signature for deposit...",
        txHash: "pending",
      })

      setDepositTxHash("")
      setWithdrawalTxHash("")

      writeContract(
        {
          address: voltContractAddress,
          abi: BRIDGE_VOLT_ABI,
          functionName: isNative ? "depositNative" : "depositERC20",
          args: isNative ? [] : [tokenAddress, depositValue],
          // Use 0n (BigInt zero) for ERC20 value field, or the token amount for native
          value: isNative ? depositValue : parseUnits("0", units),
        },
        {
          onSuccess: (hash) => {
            setBridgeStatus({
              step: 2,
              message: "Step 2/3: Transaction sent. Waiting for confirmation...",
              txHash: hash,
            })

            setDepositTxHash(hash)
            setApprovalTxHash(undefined) // Reset approval hash
            notifyBackend(hash, fromNetwork, toNetwork, fromToken, toToken, amount, finalToAmount)
          },
          onError: (e: any) => {
            setApprovalTxHash(undefined) // Reset hash on failure
            const errMsg = e?.shortMessage || e.message

            setBridgeStatus({
              step: 2,
              message: "❌ Transaction failed/rejected.",
              error: errMsg,
            })

            // 🧹 Optional: clear the deposit TX hash if failed/rejected
            setDepositTxHash("")
          },
        }
      )
    },
    [
      receivingAddress,
      voltContractAddress,
      isNative,
      tokenAddress,
      toToken,
      writeContract,
      BRIDGE_VOLT_ABI,
      units,
      finalToAmount,
    ]
  )

  // Price Fetching
  useEffect(() => {
    const loadPrices = async () => {
      setIsPriceLoading(true)
      try {
        const fetchedPrices = await fetchTokenPrices()
        setPrices(fetchedPrices)
      } catch (error) {
        console.error("Failed to fetch token prices:", error)
      } finally {
        setIsPriceLoading(false)
      }
    }
    loadPrices()
  }, [])

  // 1. Monitor Approval Confirmation and trigger Deposit
  useEffect(() => {
    // Triggers deposit ONLY if approval is confirmed and we are still in step 1 (waiting state)
    if (isApprovalConfirmed && bridgeStatus?.step === 1 && approvalTxHash) {
      setBridgeStatus((prev) => ({
        ...prev!,
        message: "Step 1/3: Approval confirmed. Preparing deposit...",
        txHash: approvalTxHash,
      }))

      // Refetch allowance immediately to update hook status
      refetchAllowance()

      // Trigger the deposit transaction
      handleDepositTx(value)
    }
  }, [isApprovalConfirmed, approvalTxHash, handleDepositTx, refetchAllowance, value])

  // 2. Deposit Confirmation Effect (Relayer call)
  const confirmingHandledRef = useRef(false)
  useEffect(() => {
    if (isConfirming && !confirmingHandledRef.current) {
      confirmingHandledRef.current = true
      setBridgeStatus((prev) => ({
        ...prev!,
        message: "Step 2/3: Transaction is confirming on the From Network...",
      }))
    }

    if (isConfirmed && bridgeStatus?.step === 2 && depositTxHash) {
      confirmingHandledRef.current = false
      setBridgeStatus({
        step: 3,
        message: "Step 3/3: Deposit confirmed. Notifying relayer to complete bridge...",
        txHash: depositTxHash,
      })
    }
  }, [
    isConfirming,
    isConfirmed,
    depositTxHash,
    fromNetwork,
    toNetwork,
    fromToken,
    toToken,
    amount,
    finalToAmount,
  ])

  // --- HANDLER FUNCTIONS ---
  const toNetworks = useMemo(() => {
    return NETWORKS.filter((net) => net !== fromNetwork)
  }, [fromNetwork])

  const handleFromNetworkChange = useCallback(
    (newFromNetwork: NetworkOption) => {
      setFromNetwork(newFromNetwork)
      setFromToken(TOKENS[newFromNetwork][0])
      if (newFromNetwork === toNetwork) {
        const newToNetwork = toNetworks.find((net) => net !== newFromNetwork)
        if (newToNetwork) {
          setToNetwork(newToNetwork)
          setToToken(TOKENS[newToNetwork][0])
        }
      }
      setAmount("")
      setBridgeStatus(null)
      setApprovalTxHash(undefined)
    },
    [toNetwork, toNetworks]
  )

  const handleToNetworkChange = useCallback((newToNetwork: NetworkOption) => {
    setToNetwork(newToNetwork)
    setToToken(TOKENS[newToNetwork][0])
    setAmount("")
    setBridgeStatus(null)
    setApprovalTxHash(undefined)
  }, [])

  const handleFromTokenChange = (newToken: string) => {
    setFromToken(newToken)
    setAmount("")
    setBridgeStatus(null)
    setApprovalTxHash(undefined)
  }

  const handleToTokenChange = (newToken: string) => {
    console.log("To Token Changed:", newToken)
    setToToken(newToken)
    setAmount("")
    setBridgeStatus(null)
  }

  const handleSwapNetworks = () => {
    const prevFrom = fromNetwork
    const prevTo = toNetwork
    const prevFromToken = fromToken
    const prevToToken = toToken

    setFromNetwork(prevTo)
    setToNetwork(prevFrom)

    setFromToken(TOKENS[prevTo].includes(prevToToken) ? prevToToken : TOKENS[prevTo][0])
    setToToken(TOKENS[prevFrom].includes(prevFromToken) ? prevFromToken : TOKENS[prevFrom][0])
    setAmount("")
    setBridgeStatus(null)
    setApprovalTxHash(undefined)
  }


  
    function useEthBalance(address?: `0x${string}`) {
      const { data } = wUseBalance({
        address, // user wallet address
        unit: 'ether'
      });
      return data?.formatted; 
    }

    function useErc20TokenBalance(tokenAddress:any, walletAddress:any) {
      
      const { data: decimals } = useReadContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "decimals",
        query: { enabled: !!tokenAddress },
      });

      const { data: rawBalance } = useReadContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: walletAddress ? [walletAddress] : undefined,
        query: { enabled: !!tokenAddress && !!walletAddress },
      });

      const balance = useMemo(() => {
        if (!rawBalance || decimals === undefined) return "0";
        return formatUnits(rawBalance as bigint, decimals as number);
      }, [rawBalance, decimals]);
      return balance;
    }


  const tokenBalance = useErc20TokenBalance(tokenAddress, evmAddress);
  const ethBalance = useEthBalance(evmAddress);

  const hTokensBalance = hTokensBalanceData || [];

    let TokenBalance: number = 0;
    if (hTokensBalance.length > 0 && hTokensBalance[0].balance) {
      TokenBalance = toReadableAmount(hTokensBalance[0].balance, TOKEN_DECIMALS.USDCt);
    } 

  useEffect(() => {
    setBalalanceMsg("");
    const amt = Number(amount);
    if (!amt) return;

    if (fromNetwork === "hedera") {
      if (isNative) {
        if (amt > Number(hBarbalance?.value)) {
          setBalalanceMsg(`You don't have enough ${fromToken}`);
        }
      } else {
        if (amt > Number(TokenBalance || 0)) {
          setBalalanceMsg(`You don't have enough ${fromToken}`);
        }
      }
    } else {
      if (isNative) {
        const ethVal = Number(ethBalance);
        if (amt > ethVal) {
          setBalalanceMsg(`You don't have enough ${fromToken}`);
        }
      } else {
        const tokenVal = Number(tokenBalance);
        if (amt > tokenVal) {
          setBalalanceMsg(`You don't have enough ${fromToken}`);
        }
      }
    }
  }, [
    amount
  ]);


useEffect(() => {
  let timeoutId: NodeJS.Timeout;

  if (toNetwork && toNetwork !== 'hedera') {
    timeoutId = setTimeout(() => {
      const nativeSymbol = toNetwork === 'bsc' ? 'BNB' : 'ETH';

      calculateGasCostInToken(
        toNetwork,
        70000,
        prices[toToken],
        prices[nativeSymbol]
      )
        .then((result) => {
          setNetworkFee(result.gasCostInToken);
        })
        .catch((err) => {
          console.error("Failed to calculate gas cost:", err);
        });
    }, 2000);
  }
  return () => clearTimeout(timeoutId);
}, [toNetwork, toToken]);


  // --- MAIN BRIDGE LOGIC ---
  const handleBridge = async () => {
      let liquidityBalance : any;

      const  IsNative = toToken === "ETH" || toToken === "BNB" || toToken === "HBAR";
      if(IsNative){
        liquidityBalance = await fetchEvmBalance(toNetwork, CONTRACT_ADDRESSES[toNetwork] as Address);
      }else{
        liquidityBalance = await fetchEvmBalance(toNetwork, CONTRACT_ADDRESSES[toNetwork] as Address, tokenToAddress)
      }

      const { nativeBalance, tokenBalance } = liquidityBalance; 

     if(IsNative){
        if( Number(finalToAmount) > Number(nativeBalance) ){
          setBalalanceMsg("Amount too large for bridge. Reduce amount or try later."); 
          return; 
        }
     }else{
        if( Number(finalToAmount) > Number(tokenBalance) ){
          setBalalanceMsg("Amount too large for bridge. Reduce amount or try later."); 
          return; 
        }
     }

  
    // 1. Connection and Chain Enforcement
    if (fromNetwork !== "hedera") {
      const requiredChainId = CHAIN_IDS[fromNetwork]
      if (currentChainId !== requiredChainId) {
        setBridgeStatus({
          step: 1,
          message: `Step 1/3: Switching to ${fromNetwork.toUpperCase()}...`,
          txHash: "N/A",
        })
        try {
          switchChain({ chainId: requiredChainId })
          return // Return and wait for chain change to trigger re-render
        } catch (e) {
          setBridgeStatus({
            step: 1,
            message: `❌ Failed to switch to ${fromNetwork.toUpperCase()}.`,
            error: String(e),
          })
          return
        }
      }
    }

    // 2. Wallet Connection Check (If not connected, prompt to connect)
    if (fromNetwork === "hedera" && !hederaConnected) {
      setBridgeStatus({ step: 1, message: "Step 1/3: Connecting Hedera wallet...", txHash: "N/A" })
      try {
        await hederaConnect()
        return
      } catch (e) {
        setBridgeStatus({ step: 1, message: "❌ Hedera connection failed.", error: String(e) })
        return
      }
    }

    if (fromNetwork === "hedera") {
      // 1. Initial connection checks
      if (!hederaConnected || !hederaAccount) {
        setBridgeStatus({
          step: 1,
          message: "❌ Hedera wallet not connected.",
          error: "Connect wallet",
        })
        return
      }

      try {
        setBridgeStatus({
          step: 2,
          message: `Step 2/3: Initiating Hedera deposit of ${amount} ${fromToken}...`,
          txHash: "pending",
        })

        const contractId = hederContractAddress
        // parseUnits returns the token amount with decimals as a BigInt
        const amountBig = parseUnits(amount, TOKEN_DECIMALS[fromToken])
        let txHash: string | undefined | any

        if (fromToken === "HBAR") {
          // Deposit native HBAR
          const hbarAmount = amount
          txHash = await WriteContract({
            contractId: ContractId.fromString(contractId),
            abi: HEDERA_VOLT_ABI,
            functionName: "depositNative",
            args: [], // required by the hook's type even when there are no parameters
            metaArgs: { gas: 120_000, amount: Number(hbarAmount) },
          })
        } else {
          try {
            //later improvement
            //check for token balance before initiation.
            //check for token balance in desChain

            const TOKENS = [{ tokenId:TOKEN_ADDRESSES.hUSDC, amount: Number(amountBig) }];
            const SPENDER = CONTRACT_ADDRESSES.hedera;
             setIsApproving(true)
            await approve(TOKENS, SPENDER);
             setIsApproving(false)
            txHash = await WriteContract({
              contractId: ContractId.fromString(contractId),
              abi: HEDERA_VOLT_ABI,
              functionName: "depositHTS",
              args: [hederaTokenCheckSum, amountBig.toString()], // required by the hook's type even when there are no parameters
              metaArgs: { gas: 120_000 },
            })
          } catch (e) {
             setIsApproving(false)
            console.error(e)
          }
        }

        setDepositTxHash(txHash)

        if (!txHash) throw new Error("Failed to get transaction hash")

        setBridgeStatus({
          step: 2,
          message: "Step 2/3: Hedera deposit sent. Waiting for confirmation...",
          txHash,
        })

        // Wait for confirmation (polling your SDK helper)
        // const confirmed = await waitForHederaConfirmation(txHash);
        // if (!confirmed) throw new Error("Hedera transaction not confirmed");

        // When confirmed
        setBridgeStatus({
          step: 3,
          message: "Step 3/3: Deposit confirmed. Notifying relayer...",
          txHash,
        })

        await notifyBackend(
          txHash,
          fromNetwork,
          toNetwork,
          fromToken,
          toToken,
          amount,
          finalToAmount
        )
      } catch (err: any) {
        setBridgeStatus({
          step: 2,
          message: "❌ Hedera transaction failed.",
          error: err.message || String(err),
        })
      }

      return
    }

    // --- 4. EVM ERC-20 APPROVAL CHECK (START) ---
    try {
      if (!isNative) {
        if (isLoadingAllowance) {
          setBridgeStatus({
            step: 1,
            message: "Step 1/3: Checking token allowance...",
            txHash: "N/A",
          })
          return
        }

        // Check if allowance is insufficient (safely checking for bigint type)
        if (typeof allowance !== "bigint" || allowance < value) {
          setBridgeStatus({
            step: 1,
            message: `Step 1/3: Awaiting wallet signature for ${fromToken} approval...`,
            txHash: "pending",
          })
          setIsApproving(true)

          try {
            // Call the ERC-20 approve function on the TOKEN ADDRESS
            writeContract(
              {
                address: tokenAddress as Address, // Token contract address
                abi: ERC20_ABI,
                functionName: "approve",
                args: [voltContractAddress, value], // Approve bridge contract to spend this amount
                value: parseUnits("0", units), // ERC-20 approve does not send native currency
              },
              {
                onSuccess: (hash) => {
                  setIsApproving(false)
                  setBridgeStatus({
                    step: 1,
                    message: "Step 1/3: Approval transaction sent. Waiting for confirmation...",
                    txHash: hash,
                  })
                  setApprovalTxHash(hash) // Save hash to monitor confirmation
                },
                onError: (e: any) => {
                  setIsApproving(false)
                  const errMsg = e?.shortMessage || e.message
                  setBridgeStatus({
                    step: 1,
                    message: "❌ Approval failed/rejected.",
                    error: errMsg,
                  })
                },
              }
            )
            return // Stop here, waiting for approval TX
          } catch (e: any) {
            setIsApproving(false)
            const errMsg = e?.shortMessage || e.message
            setBridgeStatus({ step: 1, message: "❌ Prepare approval failed.", error: errMsg })
            return
          }
        }
        setIsApproving(false) // Allowance is sufficient, proceed to deposit
      }

      // --- 5. EVM DEPOSIT (Called if native OR ERC20 approval is sufficient/completed) ---
      handleDepositTx(value)
    } catch (e: any) {
      const errMsg = e?.shortMessage || e.message
      setBridgeStatus({
        step: 2,
        message: "❌ Prepare transaction failed.",
        error: errMsg,
      })
    }
  }

  // --- RENDER HELPERS: UPDATED getButtonText ---
  const getButtonText = () => {
    // --- 1. HANDLE BRIDGE STATUS CHECKS (Priority on active transaction state) ---
    if (bridgeStatus?.step === 1 && (bridgeStatus.txHash === "pending" || isApproving))
      return "Waiting for Approval Signature..."
    if (bridgeStatus?.step === 1 && approvalTxHash) return "Waiting for Approval Confirmation..."
    if (bridgeStatus?.step === 2 && bridgeStatus.txHash === "pending")
      return "Waiting for Deposit Signature..."
    if (isConfirming && toNetwork != "hedera") return "Confirming Deposit..."
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

    // If the 'To Network' is EVM (and the 'From Network' is Hedera), ensure EVM wallet is connected.
    if (toNetwork !== "hedera" && !evmConnected && fromNetwork === "hedera") {
      return "Connect EVM Wallet (To receive)"
    }

    // 4. ERC20 Check
    if (!isNative && evmConnected && typeof allowance !== "bigint") {
      // Show checking status if allowance is actively being loaded
      if (isLoadingAllowance) return "Checking Token Allowance..."
      // If allowance read failed or is undefined, prompt for approval
      return "Approve " + fromToken
    }
    if (!isNative && evmConnected && typeof allowance === "bigint" && allowance < value) {
      return "Approve " + fromToken
    }

    // --- 5. DEFAULT ACTION ---
    return "Bridge Tokens"
  }

  const BridgeStatusTracker: React.FC<{ status: BridgeStatus }> = ({ status }) => {
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

  // Helper to check if receiving wallet is connected
  const isReceivingWalletConnected = useMemo(() => {
    if (toNetwork === "hedera") return hederaConnected
    return evmConnected // Covers all other EVM networks (ethereum, bsc)
  }, [toNetwork, hederaConnected, evmConnected])

  const isPriceInvalid = fromPrice <= 0 || toPrice <= 0

  const isButtonDisabled =
    isPriceLoading ||
    Number(amount) <= 0 ||
    isPriceInvalid ||
    fromNetwork === toNetwork ||
    (fromNetwork === "hedera" && !hederaConnected) ||
    (fromNetwork !== "hedera" && !evmConnected) ||
    (fromNetwork !== "hedera" && evmConnected && currentChainId !== CHAIN_IDS[fromNetwork]) ||
    !isReceivingWalletConnected ||
    // Only disable if an actual TX or approval is in progress
    isApproving ||
    bridgeStatus?.txHash === "pending" ||
    (isConfirming && fromNetwork != "hedera") ||
    (bridgeStatus?.step === 3 && !bridgeStatus.error)

  // Display a loading state if prices are not ready
  if (isPriceLoading || Object.keys(prices).length === 0) {
    return (
      <Card className='max-w-lg w-full mx-auto mt-10 bg-zinc-900 border-zinc-800 text-zinc-800'>
        <CardContent className='p-6 text-center'>
          <p className="text-white">Loading Bridge data....</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className='max-w-lg w-full mx-auto mt-10 bg-zinc-50 border border-zinc-300 text-zinc-800'>
      <CardHeader>
        <CardTitle className='text-center text-xl font-semibold text-zinc-800'>
          Kivon Hedera Bridge <Badge variant='destructive'>Testnet</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className='space-y-4'>
          {/* Network Selectors (Unchanged) */}
          <div className='grid grid-cols-12 gap-4 md:gap-0'>
            {/* From Network... */}
            <div className='col-span-12 md:col-span-5'>
              <label className='block text-sm text-zinc-600 mb-1'>From Network</label>
              <Select
                value={fromNetwork}
                onValueChange={(value) => handleFromNetworkChange(value as NetworkOption)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select network' />
                </SelectTrigger>
                <SelectContent>
                  {NETWORKS.map((net) => (
                    <SelectItem key={net} value={net}>
                      {net.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='col-span-12 md:col-span-2 flex items-center md:justify-center md:mt-4'>
              <Button
                onClick={handleSwapNetworks}
                size='icon'
                variant='outline'
                className='text-zinc-600'
              >
                <ArrowLeftRight className='size-4 rotate-90 md:rotate-0' />
              </Button>
            </div>
            {/* To Network... */}
            <div className='col-span-12 md:col-span-5'>
              <label className='block text-sm text-zinc-600 mb-1'>To Network</label>
              <Select
                value={toNetwork}
                onValueChange={(value) => handleToNetworkChange(value as NetworkOption)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select network' />
                </SelectTrigger>
                <SelectContent>
                  {toNetworks.map((net) => (
                    <SelectItem key={net} value={net}>
                      {net.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Token Selectors (Unchanged) */}
          <div className='flex justify-between items-center gap-2'>
            <div className='w-1/2'>
              <label className='block text-sm text-zinc-600 mb-1'>From Token</label>
              <Select value={fromToken} onValueChange={(value) => handleFromTokenChange(value)}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select token' />
                </SelectTrigger>
                <SelectContent>
                  {TOKENS[fromNetwork].map((token) => (
                    <SelectItem key={token} value={token}>
                      {token}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-gray-500 mt-1'>Price: ${fromPrice.toFixed(2)}</p>
            </div>

            <div className='w-1/2'>
              <label className='block text-sm text-zinc-600 mb-1'>To Token</label>
              <Select value={toToken} onValueChange={(value) => handleToTokenChange(value)}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select token' />
                </SelectTrigger>
                <SelectContent>
                  {TOKENS[toNetwork].map((token) => (
                    <SelectItem key={token} value={token}>
                      {token}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-gray-500 mt-1'>Price: ${toPrice.toFixed(2)}</p>
            </div>
          </div>

          {/* Amount Input (Unchanged) */}
          <div className='space-y-3'>
            <div>
              <label className='block text-sm text-zinc-600 mb-1'>
                Amount to send ({fromToken})
              </label>
              <Input
                type='number'
                min='0'
                step='any'
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder='0.00'
              />
            </div>

            {/* Estimated Receive Amount Display (Unchanged) */}
            <div className='relative'>
              <label className='block text-sm text-zinc-600 mb-1'>
                Estimated amount to receive ({toToken})
              </label>
              <Input
                type='text'
                readOnly
                value={Number(amount) > 0 ? finalToAmount : "0.00"}
                placeholder='0.00'
              />
              {isPriceInvalid && (
                <p className='text-sm text-yellow-400 mt-2'>
                  ⚠️ Price data unavailable for conversion.
                </p>
              )}
            </div>
          </div>

          {/* Fee and Conversion Details (Unchanged) */}
          <div className='pt-2 border-t border-zinc-700 space-y-1 text-sm'>
            <div className='flex justify-between'>
              <span className='text-zinc-600'>Conversion Rate:</span>
              <span className='text-zinc-800'>
                1 {fromToken} ≈ {(fromPrice / toPrice).toFixed(4)} {toToken}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-zinc-600'>Protocol Fee:</span>
              <span className='text-zinc-800'>
                {PROTOCOL_FEE_PERCENT}% ({Number(feeAmount) > 0 ? feeAmount : "0.00"} {toToken})
              </span>
            </div>

             {toNetwork !== "hedera" &&

              <div className='flex justify-between'>
                <span className='text-zinc-600'>Network Fee:</span>
                <span className='text-zinc-800'>
                 {Number(networkFee) > 0 ? networkFee : "0.00"} {toToken}
                </span>
              </div>
            }

            <div className='flex justify-between font-semibold text-sm mt-2'>
              <span className='text-gray-800'>Total Received:</span>
              <span className='text-green-400'>
                {Number(amount) > 0 ? finalToAmount : "0.00"} {toToken}
              </span>
            </div>
          </div>

          {/* Action Button */}

          {balanceMsg && <div className="text-red-500">{balanceMsg}</div>}
          <Button
            className='w-full'
            onClick={handleBridge}
            disabled={isButtonDisabled ? true : false}
          >
            {getButtonText()}
          </Button>

          {/* Status Summary (Updated) */}
          {bridgeStatus && <BridgeStatusTracker status={bridgeStatus} />}

          <div className='text-sm text-zinc-600 mt-4 text-left border-t border-zinc-300 pt-4'>
            <p>
              EVM Wallet:{" "}
              <span className={evmConnected ? "text-green-400" : "text-red-400"}>
                {evmConnected
                  ? evmAddress?.slice(0, 6) + "..." + evmAddress?.slice(-4)
                  : "Disconnected"}
              </span>
              {evmConnected &&
                fromNetwork !== "hedera" &&
                currentChainId !== CHAIN_IDS[fromNetwork] && (
                  <span className='text-yellow-400 ml-2'> (Wrong Chain!)</span>
                )}
            </p>
            <p>
              Hedera Wallet:{" "}
              <span className={hederaConnected ? "text-green-400" : "text-red-400"}>
                {hederaConnected ? hederaAccount : "Disconnected"}
              </span>
            </p>
            <p>
              Receiving Address:{" "}
              <span className='text-indigo-400'>
                {receivingAddress ? receivingAddress : "None"}
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
