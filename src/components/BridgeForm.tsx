"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  useAccountId,
  useWallet,
  useWriteContract as UseWriteContract,
  useApproveTokenAllowance,
  useBalance, 
  useAssociateTokens 
} from "@buidlerlabs/hashgraph-react-wallets"
import { HashpackConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { type Address, parseUnits, erc20Abi as ERC20_ABI} from "viem"

import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
  useBalance as wUseBalance
} from "wagmi"


import BRIDGE_VOLT_ABI from "@/Abi/vault.json"
import { fetchHederaBalance, fetchTokenPrices } from "@/helpers"
import { ArrowLeftRight } from "lucide-react"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { calculateGasCostInToken } from "@/helpers"

import { truncateHash, useErc20TokenBalance, useEthBalance, convertTokenByUSD, checkTokenAssociation } from "@/helpers/token"
import { NETWORKS, CHAIN_IDS, CONTRACT_ADDRESSES, type NetworkOption } from "@/config/networks";
import { TOKENS } from "@/config/tokens";
import { type BridgeStatus, BridgeStatusTracker, getButtonText, notifyBackend } from "@/helpers/bridge"


const PROTOCOL_FEE_PERCENT = 2
const PROTOCOL_FEE_RATE = PROTOCOL_FEE_PERCENT / 100
const DEDUCE_FEE_RATE = 1 - PROTOCOL_FEE_RATE

type TokenPrices = Record<string, number>


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
  const receivingAddress = hederaAccount ? hederaAccount.toString() : null;
  const { associateTokens } = useAssociateTokens();


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
  const [withdrawalTxHash, setWithdrawalTxHash] = useState<string | null>(null)

  // --- NEW STATES FOR APPROVAL FLOW ---
  const [isApproving, setIsApproving] = useState(false)
  const [approvalTxHash, setApprovalTxHash] = useState< Address | undefined>(undefined)
  const [networkFee, setNetworkFee] = useState<number>(0);


  const units = TOKENS[fromNetwork][fromToken]?.decimals || 18;
  const value = useMemo(() => {
    return parseUnits(amount || "0", units)
  }, [amount, units])


  const [balanceMsg, setBalalanceMsg] = useState(""); 

  
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

  //--- WAGMI HOOKS FOR MONITORING ---
  //1. Monitor the deposit transaction confirmation
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: txReceipt,
  } = useWaitForTransactionReceipt({
    hash: depositTxHash as Address,
    query: {
       enabled: !!depositTxHash && !!fromNetwork,
    },
  })

  // 2. Monitor the approval transaction confirmation
  const { isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
    query: {
      enabled: !!approvalTxHash && bridgeStatus?.step === 1 && !isApproving,
    },
  })





  const isNative = TOKENS[fromNetwork][fromToken]?.native || false;
  const tokenAddress = TOKENS[fromNetwork][fromToken]?.address;
  const voltContractAddress = CONTRACT_ADDRESSES[fromNetwork] as Address;

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
  
  const { feeAmount, finalToAmount, hbarAmount } = useMemo(() => {
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
    const hbarPrice = prices['HBAR']
    const hbarAmount = convertTokenByUSD(finalAmount??0, toPrice??0, hbarPrice??0);
    return {
      feeAmount: fee.toFixed(6),
      finalToAmount: finalAmount.toFixed(6),
      hbarAmount: hbarAmount
    }

  }, [inputAmount, fromPrice, toPrice, networkFee])



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
              notifyBackend(hash, toNetwork, toToken, hbarAmount, receivingAddress, setBridgeStatus, setWithdrawalTxHash)
            },
            onError: (e: unknown) => {
              setApprovalTxHash(undefined); // Reset hash on failure

              let errMsg: string;

              if (e instanceof Error) {
                errMsg = e.message;
              } else if (typeof e === "object" && e !== null && "shortMessage" in e) {
                
                errMsg = (e as { shortMessage?: string }).shortMessage || "Unknown error";
              } else {
                errMsg = "Unknown error";
              }

              setBridgeStatus({
                step: 2,
                message: "❌ Transaction failed/rejected.",
                error: errMsg,
              });
              setDepositTxHash(""); // Optional cleanup
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



    const handleBridge = async () => {
      
      const liquidityBalance = await fetchHederaBalance(CONTRACT_ADDRESSES[toNetwork]);
      const { nativeBalance } = liquidityBalance;
      if( hbarAmount > Number(nativeBalance) ){
        setBalalanceMsg("Amount too large for bridge. Reduce amount or try later."); 
        return; 
      }


      const theToToken = TOKENS[toNetwork][toToken]; 
      if(!theToToken.native){
        const isAssociated = await checkTokenAssociation(hederaAccount, theToToken.address);
        if(!isAssociated){
            setBridgeStatus({
                step: 1,
                message: "Step 1/3: Checking token association...",
                txHash: "N/A",
            })
          try {
            await associateTokens([TOKENS[toNetwork][toToken].address]);
          } catch (e) {
            setBridgeStatus({
                step: 1,
                message: "Could not get token association",
                txHash: "N/A",
            })
            return; 
          }
        }
      }

    
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
                  onError: (e: unknown) => {
                    setIsApproving(false);
                    let errMsg: string;
                    if (e instanceof Error) {
                      // Standard Error object
                      errMsg = e.message;
                    } else if (typeof e === "object" && e !== null && "shortMessage" in e) {
                      
                      errMsg = (e as { shortMessage?: string }).shortMessage || "Unknown error";
                    } else {
                      errMsg = "Unknown error";
                    }

                    setBridgeStatus({
                      step: 1,
                      message: "❌ Approval failed/rejected.",
                      error: errMsg,
                    });
                  },
                }
              )
              return // Stop here, waiting for approval TX
            } catch (e: unknown) {
              setIsApproving(false);
              let errMsg: string;
              if (e instanceof Error) {
                errMsg = e.message; // standard Error
              } else if (typeof e === "object" && e !== null && "shortMessage" in e) {
                // library-specific error object
             
                errMsg = (e as { shortMessage?: string }).shortMessage || "Unknown error";
              } else {
                errMsg = "Unknown error";
              }
              setBridgeStatus({
                step: 1,
                message: "❌ Prepare approval failed.",
                error: errMsg,
              });
              return;
            }
          }
          setIsApproving(false) // Allowance is sufficient, proceed to deposit
        }
        // --- 5. EVM DEPOSIT (Called if native OR ERC20 approval is sufficient/completed) ---
        handleDepositTx(value)
      } catch (e: unknown) {
        let errMsg: string;

        if (e instanceof Error) {
          // standard Error object
          errMsg = e.message;
        } else if (typeof e === "object" && e !== null && "shortMessage" in e) {
          // some libraries throw objects with shortMessage
          
          errMsg = (e as { shortMessage?: string }).shortMessage || "Unknown error";
        } else {
          errMsg = "Unknown error";
        }

        setBridgeStatus({
          step: 2,
          message: "❌ Prepare transaction failed.",
          error: errMsg,
        });
      }
    }
    


  // 1. Monitor Approval Confirmation and trigger Deposit
  useEffect(() => {
    // Triggers deposit ONLY if approval is confirmed and we are still in step 1 (waiting state)
    if (isApprovalConfirmed && bridgeStatus?.step === 1 && approvalTxHash) {

    setBridgeStatus((prev: BridgeStatus | null) => ({
      ...prev!,
      message: "Step 1/3: Approval confirmed. Preparing deposit...",
      txHash: approvalTxHash,
    }));
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
      setBridgeStatus((prev:  BridgeStatus | null) => ({
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
    // return NETWORKS.filter((net) => net !== fromNetwork)
    return NETWORKS.filter((net) => net == toNetwork)
  }, [fromNetwork])

  const handleFromNetworkChange = useCallback(
    (newFromNetwork: NetworkOption) => {
      setFromNetwork(newFromNetwork)
      const firstFromTokenSymbol = Object.keys(TOKENS[newFromNetwork])[0];
      setFromToken(TOKENS[newFromNetwork][firstFromTokenSymbol].symbol)

      if (newFromNetwork === toNetwork) {
        const newToNetwork = toNetworks.find((net) => net !== newFromNetwork)
        if (newToNetwork) {
          setToNetwork(newToNetwork)
          const firstToTokenSymbol = Object.keys(TOKENS[newToNetwork])[0];
          setToToken(TOKENS[newToNetwork][firstToTokenSymbol].symbol)
        }
      }
      setAmount("")
      setBridgeStatus(null)
      setApprovalTxHash(undefined)
    },
    [toNetwork, toNetworks, TOKENS]
  )

  const handleToNetworkChange = useCallback((newToNetwork: NetworkOption) => {
    setToNetwork(newToNetwork)
    const newTokens = TOKENS[newToNetwork];
    const firstTokenSymbol = Object.keys(newTokens)[0];
    const firstTokenData = newTokens[firstTokenSymbol];
    setToToken(firstTokenData.symbol);
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
    setToToken(newToken)
    setAmount("")
    setBridgeStatus(null)
  }

  const tokenBalance = useErc20TokenBalance(TOKENS[fromNetwork][fromToken].address as Address, evmAddress as Address);
  const ethBalance = useEthBalance(evmAddress);
  useEffect(() => {
      setBalalanceMsg("");
      const amt = Number(amount);
      if (!amt) return;

      if ( TOKENS[fromNetwork][fromToken]?.native ) {
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
  }, [amount]);


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
    !hederaConnected ||
    !evmConnected ||
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
                    {NETWORKS.map((net) => ( net != 'hedera' &&
                      <SelectItem key={net} value={net}>
                        {net.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='col-span-12 md:col-span-2 flex items-center md:justify-center md:mt-4'>
                <Button
                  // onClick={handleSwapNetworks}
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
                      {Object.keys(TOKENS[fromNetwork]).map((tokenSymbol) => {
                        const tokenDetails = TOKENS[fromNetwork][tokenSymbol]; 
                        return (
                          <SelectItem 
                            key={tokenSymbol} 
                            value={tokenSymbol}
                          >
                            {tokenDetails.symbol} 
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                <p className='text-xs text-gray-500 mt-1'>Price: ${fromPrice.toFixed(6)}</p>
              </div>

              <div className='w-1/2'>
                <label className='block text-sm text-zinc-600 mb-1'>To Token</label>
                <Select value={toToken} onValueChange={(value) => handleToTokenChange(value)}>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select token' />
                  </SelectTrigger>
                  <SelectContent>
                      {Object.keys(TOKENS[toNetwork]).map((tokenSymbol) => {
                        const tokenDetails = TOKENS[toNetwork][tokenSymbol]; 
                        return (
                          <SelectItem 
                            key={tokenSymbol} 
                            value={tokenSymbol}
                          >
                            {tokenDetails.symbol} 
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                <p className='text-xs text-gray-500 mt-1'>Price: ${toPrice.toFixed(6)}</p>
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
                  1 {fromToken} ≈ {(fromPrice / toPrice).toFixed(6)} {toToken}
                </span>
              </div>

              <div className='flex justify-between'>
                <span className='text-zinc-600'>Protocol Fee:</span>
                <span className='text-zinc-800'>
                  {PROTOCOL_FEE_PERCENT}% ({Number(feeAmount) > 0 ? feeAmount : "0.00"} {toToken})
                </span>
              </div>

            
              {/* <div className='flex justify-between'>
                <span className='text-zinc-600'>Network Fee:</span>
                <span className='text-zinc-800'>
                  {Number(networkFee) > 0 ? networkFee : "0.00"} {toToken}
                </span>
              </div>  */}

              <div className='flex justify-between font-semibold text-sm mt-2'>
                <span className='text-gray-800'>Est. Total Received:</span>
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
              {getButtonText(
                bridgeStatus as BridgeStatus,
                isApproving,
                approvalTxHash as Address, 
                isConfirming,
                fromNetwork,
                toNetwork, 
                hederaConnected,
                evmConnected,
                currentChainId,
                CHAIN_IDS,
                isNative,
                allowance as bigint | undefined,
                isLoadingAllowance,
                fromToken,
                value
              )}
            </Button>

            {/* Status Summary (Updated) */}
            {bridgeStatus && 
                <BridgeStatusTracker
                  status={bridgeStatus}
                  depositTxHash={depositTxHash}
                  withdrawalTxHash={withdrawalTxHash}
                  fromNetwork={fromNetwork}
                  toNetwork={toNetwork}
                />
            }

            <div className='text-sm text-zinc-600 mt-4 text-left border-t border-zinc-300 pt-4'>
              <p>
                EVM Wallet:{" "}
                <span className={evmConnected ? "text-green-400" : "text-red-400"}>
                  {evmConnected
                    ? truncateHash(evmAddress)
                    : "Disconnected"}
                </span>
                { evmConnected && currentChainId !== CHAIN_IDS[fromNetwork] && (
                    <span className='text-yellow-400 ml-2'> (Wrong Chain!)</span>
                )}
              </p>

              <p>
                Receiving Address:{" "}
                <span className='text-indigo-400'>
                  {receivingAddress ? receivingAddress : "None"}
                </span>
              </p>

              <p>
                Hedera Wallet:{" "}
                <span className={hederaConnected ? "text-green-400" : "text-red-400"}>
                  {hederaConnected ? hederaAccount : "Disconnected"}
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
}
