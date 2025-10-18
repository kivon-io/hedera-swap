"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAccount, useChainId, useSwitchChain, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"; 
import { type Address, parseUnits } from "viem"; 
import { useHederaWallet } from "@/context/HederaWalletContext"; 
import { fetchTokenPrices } from "@/helpers"
import BRIDGE_VOLT_ABI from "@/Abi/vault.json"; 
import ERC20_ABI from "@/Abi/erc20.json"; 


type NetworkOption = "ethereum" | "bsc" | "hedera";

const NETWORKS: NetworkOption[] = ["ethereum", "bsc", "hedera"];

// --- CONSTANTS AND ADDRESSES ---
const CHAIN_IDS: Record<NetworkOption, number> = {
    ethereum: 11155111, // Sepolia
    bsc: 97, // BSC Testnet
    hedera: 296, 
};

const CONTRACT_ADDRESSES: Record<NetworkOption, Address> = {
    ethereum: "0x8A8Dbbe919f80Ca7E96A824D61763503dF15166f", 
    bsc: "0xA1C6545861c572fc44320f9A52CF1DE32Da84Ab8", 
    hedera: "0x8A8Dbbe919f80Ca7E96A824D61763503dF15166f", 
};

const TOKEN_ADDRESSES: Record<string, Address> = {
    USDC: "0xDb740b2CdC598bDD54045c1f9401c011785032A6", 
    bUSDC: "0xabbd60313073EB1673940f0f212C7baC5333707e", 
    hUSDC: "0xDb740b2CdC598bDD54045c1f9401c011785032A6", 
    ETH: "0x0", 
    BNB: "0x0", 
    HBAR: "0x0", 
};

const TOKENS: Record<NetworkOption, string[]> = {
  ethereum: ["ETH", "USDC"],
  bsc: ["BNB", "bUSDC"],
  hedera: ["HBAR", "hUSDC"],
};

const TOKEN_DECIMALS: Record<string, number> = {
    // Stablecoins typically use 6 decimals
    USDC: 6,
    bUSDC: 6,
    hUSDC: 6,
    // Native assets and others, default to 18
    ETH: 18,
    BNB: 18,
    // HBAR uses 8 decimals
    HBAR: 8,
};

const getTokenDecimals = (tokenSymbol: string): number => {
    return TOKEN_DECIMALS[tokenSymbol] ?? 18; // Default to 18 if not found
};

const PROTOCOL_FEE_PERCENT = 2;
const PROTOCOL_FEE_RATE = PROTOCOL_FEE_PERCENT / 100;
const DEDUCE_FEE_RATE = 1 - PROTOCOL_FEE_RATE;

type TokenPrices = Record<string, number>;

type BridgeStatus = {
    step: number;
    message: string;
    txHash?: string;
    error?: string;
};

const BridgeStatusTracker: React.FC<{ status: BridgeStatus }> = ({ status }) => {
    const getStatusColor = (step: number) => {
        if (status.step > step) return "text-green-500";
        if (status.step === step && status.error) return "text-red-500";
        if (status.step === step) return "text-yellow-500";
        return "text-gray-600";
    }

    return (
        <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700 space-y-2">
            <p className="font-semibold text-white">Bridge Status:</p>
            <div className={`text-sm ${getStatusColor(1)}`}>
                {status.step > 1 ? "✅" : status.step === 1 && status.error ? "❌" : status.step === 1 ? "➡️" : "○"} Step 1: Connect & Network Check
            </div>
            <div className={`text-sm ${getStatusColor(2)}`}>
                {status.step > 2 ? "✅" : status.step === 2 && status.error ? "❌" : status.step === 2 ? "⏳" : "○"} Step 2: Deposit to Volt Contract
            </div>
            <div className={`text-sm ${getStatusColor(3)}`}>
                {status.step > 3 ? "✅" : status.step === 3 && status.error ? "❌" : status.step === 3 ? "⚙️" : "○"} Step 3: Relayer Processing (Withdrawal)
            </div>
            <div className={`text-sm font-medium ${status.error ? 'text-red-500' : status.step === 4 ? 'text-green-500' : 'text-white'}`}>
                {status.message}
            </div>
            {status.txHash && status.txHash !== "N/A" && status.txHash !== "pending" && (
                <p className="text-xs text-gray-500 truncate">
                    TX Hash: {status.txHash}
                </p>
            )}
            {status.error && (
                   <p className="text-xs text-red-400">
                    Error: {status.error}
                </p>
            )}
        </div>
    );
}


// ----------------------------------------------------------------------
// --- BRIDGE FORM COMPONENT ---
// ----------------------------------------------------------------------

export default function BridgeForm() {
    // --- WAGMI HOOKS ---
    const { address: evmAddress, isConnected: evmConnected } = useAccount();
    const currentChainId = useChainId();
    const { switchChain } = useSwitchChain();
    const { writeContract } = useWriteContract();

    // --- HEDERA HOOKS ---
    const { connected: hederaConnected, accountId: hederaAccount, connectWallet: hederaConnect } = useHederaWallet();
    
    // --- STATE ---
    const [fromNetwork, setFromNetwork] = useState<NetworkOption>("ethereum");
    const [toNetwork, setToNetwork] = useState<NetworkOption>("hedera");
    const [fromToken, setFromToken] = useState<string>("ETH");
    const [toToken, setToToken] = useState<string>("HBAR");
    const [amount, setAmount] = useState<string>("");
    const [prices, setPrices] = useState<TokenPrices>({});
    const [isPriceLoading, setIsPriceLoading] = useState(false);
    const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);

    // --- NEW STATES FOR APPROVAL FLOW ---
    const [isApproving, setIsApproving] = useState(false);
    const [approvalTxHash, setApprovalTxHash] = useState<Address | undefined>(undefined);

    // --- CONSTANTS DERIVED FROM STATE ---
    const isNative = fromToken === "ETH" || fromToken === "BNB" || fromToken === "HBAR";
    const tokenAddress = TOKEN_ADDRESSES[fromToken] as Address;
    const voltContractAddress = CONTRACT_ADDRESSES[fromNetwork] as Address;
    const units = getTokenDecimals(fromToken);

    const value = useMemo(() => {
        return parseUnits(amount || '0', units);
    }, [amount, units]);

    const receivingAddress = toNetwork === 'hedera' ? hederaAccount : evmAddress;


    // --- WAGMI HOOKS FOR MONITORING ---

    // 1. Monitor the deposit transaction confirmation
    const { isLoading: isConfirming, isSuccess: isConfirmed, data: txReceipt } = useWaitForTransactionReceipt({
        hash: bridgeStatus?.txHash as Address,
        query: { enabled: !!bridgeStatus?.txHash && bridgeStatus.step === 2 && bridgeStatus.txHash !== "pending" && !bridgeStatus.error }
    }); 
    
    // 2. Monitor the approval transaction confirmation
    const { isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({
          hash: approvalTxHash,
          query: {
              enabled: !!approvalTxHash && bridgeStatus?.step === 1 && !isApproving,
          }
    });

    // 3. Read the current allowance the contract has over the user's tokens
    const { data: allowance, refetch: refetchAllowance, isLoading: isLoadingAllowance } = useReadContract({
        abi: ERC20_ABI,
        address: evmConnected && !isNative ? tokenAddress : undefined,
        functionName: 'allowance',
        args: evmConnected && evmAddress ? [evmAddress as Address, voltContractAddress] : undefined,
        chainId: CHAIN_IDS[fromNetwork],
        query: {
            // Only enabled if EVM connected, it's an ERC20, and we have the necessary addresses
            enabled: evmConnected && !isNative && !!evmAddress && fromNetwork !== 'hedera',
            refetchInterval: 10000, // Refetch allowance every 10 seconds
        }
    });
      
    const fromPrice = prices[fromToken] || 0;
    const toPrice = prices[toToken] || 0;
    const inputAmount = Number(amount);

    const { feeAmount, finalToAmount } = useMemo(() => {
        let rawToAmount = 0;
        let fee = 0;
        let finalAmount = 0;

        if (inputAmount > 0 && fromPrice > 0 && toPrice > 0) {
            const usdValue = inputAmount * fromPrice;
            rawToAmount = usdValue / toPrice; 
            fee = rawToAmount * PROTOCOL_FEE_RATE;
            finalAmount = rawToAmount * DEDUCE_FEE_RATE;
        }
        
        return {
            feeAmount: fee.toFixed(4),
            finalToAmount: finalAmount.toFixed(4),
        };
    }, [inputAmount, fromPrice, toPrice]);


    const notifyBackend = async (txHash: string, fromNetwork: NetworkOption, toNetwork: NetworkOption, fromToken: string, toToken: string, amount: string, expectedReceiveAmount: string) => {
        console.log("Backend notification sent:", { txHash, fromNetwork, toNetwork, fromToken, toToken, amount, expectedReceiveAmount });
        
        try {
            // MOCK: Replace with your actual backend fetch
            await new Promise(resolve => setTimeout(resolve, 3000));
            const data = { success: true, withdrawalTxHash: "0xMockWithdrawalTxHash" }; 

            if (data.success) {
                 setBridgeStatus({ step: 4, message: `✅ Bridge complete!` });
            } else {
                 setBridgeStatus({ step: 4, message: `❌ Bridge failed on relay. Contact support.`, txHash, error: "Relay Failed" });
            }
        } catch (error) {
            setBridgeStatus({ step: 4, message: `❌ Bridge failed: Could not reach relayer service.`, txHash, error: String(error) });
        }
    };

    // --- CORE DEPOSIT FUNCTION (Extracted for sequential flow) ---
    const handleDepositTx = useCallback((depositValue: bigint) => {
        
        if (!receivingAddress) {
            setBridgeStatus({ step: 2, message: "❌ Receiving wallet address not available.", error: "Destination Address Missing" });
            setApprovalTxHash(undefined);
            return;
        }

        setBridgeStatus({ step: 2, message: "Step 2/3: Awaiting wallet signature for deposit...", txHash: "pending" });

        writeContract({
            address: voltContractAddress,
            abi: BRIDGE_VOLT_ABI,
            functionName: isNative ? 'depositNative' : 'depositERC20',
            args: isNative 
                ? [] 
                : [tokenAddress, depositValue],
            // Use 0n (BigInt zero) for ERC20 value field, or the token amount for native
            value: isNative ? depositValue : parseUnits('0', units), 
        }, {
            onSuccess: (hash) => {
                setBridgeStatus({ step: 2, message: "Step 2/3: Transaction sent. Waiting for confirmation...", txHash: hash });
                setApprovalTxHash(undefined); // Reset approval hash
            },
            onError: (e: any) => {
                setApprovalTxHash(undefined); // Reset hash on failure
                const errMsg = e?.shortMessage || e.message;
                setBridgeStatus({ 
                    step: 2, 
                    message: "❌ Transaction failed/rejected.", 
                    error: errMsg 
                });
            }
        });
    }, [receivingAddress, voltContractAddress, isNative, tokenAddress, writeContract, BRIDGE_VOLT_ABI, units]);


    // Price Fetching
    useEffect(() => {
        const loadPrices = async () => {
            setIsPriceLoading(true);
            try {
                const fetchedPrices = await fetchTokenPrices();
                setPrices(fetchedPrices);
            } catch (error) {
                console.error("Failed to fetch token prices:", error);
            } finally {
                setIsPriceLoading(false);
            }
        };
        loadPrices();
    }, []);



    // 1. Monitor Approval Confirmation and trigger Deposit
    useEffect(() => {
        // Triggers deposit ONLY if approval is confirmed and we are still in step 1 (waiting state)
        if (isApprovalConfirmed && bridgeStatus?.step === 1 && approvalTxHash) {
            setBridgeStatus(prev => ({ 
                ...prev!, 
                message: "Step 1/3: Approval confirmed. Preparing deposit...", 
                txHash: approvalTxHash 
            }));
            
            // Refetch allowance immediately to update hook status
            refetchAllowance();
            
            // Trigger the deposit transaction
            handleDepositTx(value);
        }
    }, [isApprovalConfirmed, approvalTxHash, handleDepositTx, refetchAllowance, value]);

    // 2. Deposit Confirmation Effect (Relayer call)
    const notifiedRef = useRef(false);

    useEffect(() => {
      if (isConfirming) {
          setBridgeStatus(prev => {
            if (prev?.message?.includes("confirming")) return prev; // prevent repeat
            return { ...prev!, message: "Step 2/3: Transaction is confirming on the From Network..." };
          });
      }

      if (isConfirmed &&  
        !notifiedRef.current &&
        bridgeStatus?.step === 2 && 
        bridgeStatus.txHash &&
        bridgeStatus.txHash !== "pending"
      ) {
          notifiedRef.current = true;
          setBridgeStatus({
              step: 3, 
              message: "Step 3/3: Deposit confirmed. Notifying relayer to complete bridge...",
              txHash: bridgeStatus.txHash 
          });
          notifyBackend(bridgeStatus.txHash, fromNetwork, toNetwork, fromToken, toToken, amount, finalToAmount);
      }
    }, [isConfirming, isConfirmed, fromNetwork, toNetwork, fromToken, toToken, amount, finalToAmount, notifyBackend]);


    // --- HANDLER FUNCTIONS ---
    const toNetworks = useMemo(() => {
        return NETWORKS.filter(net => net !== fromNetwork);
    }, [fromNetwork]);

    const handleFromNetworkChange = useCallback((newFromNetwork: NetworkOption) => {
        setFromNetwork(newFromNetwork);
        setFromToken(TOKENS[newFromNetwork][0]);
        if (newFromNetwork === toNetwork) {
            const newToNetwork = toNetworks.find(net => net !== newFromNetwork);
            if (newToNetwork) {
                setToNetwork(newToNetwork);
                setToToken(TOKENS[newToNetwork][0]);
            }
        }
        setAmount("");
        setBridgeStatus(null);
        setApprovalTxHash(undefined);
    }, [toNetwork, toNetworks]);

    const handleToNetworkChange = useCallback((newToNetwork: NetworkOption) => {
        setToNetwork(newToNetwork);
        setToToken(TOKENS[newToNetwork][0]);
        setAmount("");
        setBridgeStatus(null);
        setApprovalTxHash(undefined);
    }, []);

    const handleFromTokenChange = (newToken: string) => {
        setFromToken(newToken);
        setAmount("");
        setBridgeStatus(null);
        setApprovalTxHash(undefined);
    }

    const handleToTokenChange = (newToken: string) => {
        setToToken(newToken);
        setAmount("");
        setBridgeStatus(null);
    }

    const handleSwapNetworks = () => {
        const prevFrom = fromNetwork;
        const prevTo = toNetwork;
        const prevFromToken = fromToken;
        const prevToToken = toToken;
        
        setFromNetwork(prevTo);
        setToNetwork(prevFrom);
        
        setFromToken(TOKENS[prevTo].includes(prevToToken) ? prevToToken : TOKENS[prevTo][0]);
        setToToken(TOKENS[prevFrom].includes(prevFromToken) ? prevFromToken : TOKENS[prevFrom][0]);
        setAmount("");
        setBridgeStatus(null);
        setApprovalTxHash(undefined);
    };


    // --- MAIN BRIDGE LOGIC ---
    const handleBridge = async () => {
        setBridgeStatus(null); // Reset status

        if (!amount || Number(amount) <= 0) {
            setBridgeStatus({ step: 1, message: "❌ Enter a valid amount.", error: "Invalid Amount" });
            return;
        }

        // 1. Connection and Chain Enforcement
        if (fromNetwork !== "hedera") {
            const requiredChainId = CHAIN_IDS[fromNetwork];
            if (currentChainId !== requiredChainId) {
                setBridgeStatus({ step: 1, message: `Step 1/3: Switching to ${fromNetwork.toUpperCase()}...`, txHash: "N/A" });
                try {
                    switchChain({ chainId: requiredChainId });
                    return; // Return and wait for chain change to trigger re-render
                } catch (e) {
                    setBridgeStatus({ step: 1, message: `❌ Failed to switch to ${fromNetwork.toUpperCase()}.`, error: String(e) });
                    return;
                }
            }
        }

        // 2. Wallet Connection Check (If not connected, prompt to connect)
        if (fromNetwork === "hedera" && !hederaConnected) {
             setBridgeStatus({ step: 1, message: "Step 1/3: Connecting Hedera wallet...", txHash: "N/A" });
             try {
                 await hederaConnect(); 
                 return; 
             } catch (e) {
                 setBridgeStatus({ step: 1, message: "❌ Hedera connection failed.", error: String(e) });
                 return;
             }
        }

        
        // 3. Hedera Deposit Logic (MOCK)
        if (fromNetwork === "hedera") {
            setBridgeStatus({ step: 2, message: `Step 2/3: Initiating Hedera deposit of ${amount} ${fromToken}...`, txHash: "HEDERA_TX_MOCK_PENDING" });
            await new Promise(resolve => setTimeout(resolve, 3000)); 
            
            setBridgeStatus({ 
                step: 3, 
                message: "Step 3/3: Hedera deposit confirmed. Notifying relayer...",
                txHash: "HEDERA_TX_MOCK_CONFIRMED"
            });
            notifyBackend("HEDERA_TX_MOCK_CONFIRMED", fromNetwork, toNetwork, fromToken, toToken, amount, finalToAmount);
            return;
        }

        // --- 4. EVM ERC-20 APPROVAL CHECK (START) ---
        try {
            if (!isNative) {
                if (isLoadingAllowance) {
                    setBridgeStatus({ step: 1, message: "Step 1/3: Checking token allowance...", txHash: "N/A" });
                    return; 
                }

                // Check if allowance is insufficient (safely checking for bigint type)
                if (typeof allowance !== 'bigint' || allowance < value) {
                    setBridgeStatus({ step: 1, message: `Step 1/3: Awaiting wallet signature for ${fromToken} approval...`, txHash: "pending" });
                    setIsApproving(true);
                    
                    try {
                        // Call the ERC-20 approve function on the TOKEN ADDRESS
                        writeContract({
                            address: tokenAddress, // Token contract address
                            abi: ERC20_ABI,
                            functionName: 'approve',
                            args: [voltContractAddress, value], // Approve bridge contract to spend this amount
                            value: parseUnits('0', units), // ERC-20 approve does not send native currency
                        }, {
                            onSuccess: (hash) => {
                                setIsApproving(false);
                                setBridgeStatus({ 
                                    step: 1, 
                                    message: "Step 1/3: Approval transaction sent. Waiting for confirmation...", 
                                    txHash: hash 
                                });
                                setApprovalTxHash(hash); // Save hash to monitor confirmation
                            },
                            onError: (e: any) => {
                                setIsApproving(false);
                                const errMsg = e?.shortMessage || e.message;
                                setBridgeStatus({ 
                                    step: 1, 
                                    message: "❌ Approval failed/rejected.", 
                                    error: errMsg 
                                });
                            }
                        });
                        return; // Stop here, waiting for approval TX
                    } catch (e: any) {
                        setIsApproving(false);
                        const errMsg = e?.shortMessage || e.message;
                        setBridgeStatus({ step: 1, message: "❌ Prepare approval failed.", error: errMsg });
                        return;
                    }
                }
                setIsApproving(false); // Allowance is sufficient, proceed to deposit
            }
            
            // --- 5. EVM DEPOSIT (Called if native OR ERC20 approval is sufficient/completed) ---
            handleDepositTx(value);

        } catch (e: any) {
            const errMsg = e?.shortMessage || e.message;
            setBridgeStatus({ 
                step: 2, 
                message: "❌ Prepare transaction failed.", 
                error: errMsg 
            });
        }
    };


    // --- RENDER HELPERS: UPDATED getButtonText ---
    const getButtonText = () => {
        // --- 1. HANDLE BRIDGE STATUS CHECKS (Priority on active transaction state) ---
        if (bridgeStatus?.step === 1 && (bridgeStatus.txHash === "pending" || isApproving)) return "Waiting for Approval Signature...";
        if (bridgeStatus?.step === 1 && approvalTxHash) return "Waiting for Approval Confirmation...";
        if (bridgeStatus?.step === 2 && bridgeStatus.txHash === "pending") return "Waiting for Deposit Signature...";
        if (isConfirming) return "Confirming Deposit...";
        if (bridgeStatus && (bridgeStatus.step === 3)) return "Relayer Processing...";
        if (bridgeStatus?.step === 4 && !bridgeStatus.error) return "Bridge Tokens";
        
        // Final check - prevent bridging to the same network
        if (fromNetwork === toNetwork) {
            return "Cannot Bridge to Same Network";
        }

        // --- 2. FROM NETWORK CONNECTION/CHAIN CHECKS ---
        if (fromNetwork === "hedera" && !hederaConnected) return "Connect Hedera Wallet (From)";
        if (fromNetwork !== "hedera" && !evmConnected) return "Connect EVM Wallet (From)";
        // Check if the connected EVM wallet is on the correct chain for the "From" side
        if (fromNetwork !== "hedera" && evmConnected && currentChainId !== CHAIN_IDS[fromNetwork]) {
            return `Switch to ${fromNetwork.toUpperCase()} (From)`;
        }

        // --- 3. TO NETWORK CONNECTION CHECKS (Symmetrical Logic) ---
        // If the 'To Network' is Hedera, ensure the Hedera wallet is connected.
        if (toNetwork === "hedera" && !hederaConnected) {
            return "Connect Hedera Wallet (To receive)";
        }

        // If the 'To Network' is EVM (and the 'From Network' is Hedera), ensure EVM wallet is connected.
        if (toNetwork !== "hedera" && !evmConnected && fromNetwork === "hedera") {
            return "Connect EVM Wallet (To receive)";
        }
        
        // 4. ERC20 Check
        if (!isNative && evmConnected && typeof allowance !== 'bigint') {
             // Show checking status if allowance is actively being loaded
             if (isLoadingAllowance) return "Checking Token Allowance...";
             // If allowance read failed or is undefined, prompt for approval
             return "Approve " + fromToken;
        }
        if (!isNative && evmConnected && typeof allowance === 'bigint' && allowance < value) {
            return "Approve " + fromToken;
        }

        // --- 5. DEFAULT ACTION ---
        return "Bridge Tokens";
    }

    // Helper to check if receiving wallet is connected
    const isReceivingWalletConnected = useMemo(() => {
        if (toNetwork === 'hedera') return hederaConnected;
        return evmConnected; // Covers all other EVM networks (ethereum, bsc)
    }, [toNetwork, hederaConnected, evmConnected]);
    
    const isPriceInvalid = fromPrice <= 0 || toPrice <= 0;
    
    // Updated isButtonDisabled to include checks for both wallets and the same network
    const isButtonDisabled = isPriceLoading || Number(amount) <= 0 || isPriceInvalid || (fromNetwork === toNetwork) 
        // Checks for the From Network connection/chain
        || (fromNetwork === "hedera" && !hederaConnected) 
        || (fromNetwork !== "hedera" && !evmConnected)
        || (fromNetwork !== "hedera" && evmConnected && currentChainId !== CHAIN_IDS[fromNetwork])
        // Checks for the To Network connection
        || !isReceivingWalletConnected 
        // Checks for active bridge state (now includes step 1 which is approval)
        || (bridgeStatus && (bridgeStatus.step === 1 || bridgeStatus.step === 2 || bridgeStatus.step === 3));


    // Display a loading state if prices are not ready
    if (isPriceLoading || Object.keys(prices).length === 0) {
      return (
      <Card className="max-w-md mx-auto mt-10 bg-zinc-900 border-zinc-800 text-white">
        <CardContent className="p-6 text-center">
        <p>Loading Bridge data....</p>
        </CardContent>
      </Card>
      );
    }


return (
<Card className="max-w-md mx-auto mt-10 bg-zinc-900 border-zinc-800 text-white">
<CardHeader>
<CardTitle className="text-center text-xl font-semibold">🌉 MultiChain Bridge <span className="text-red-400">(TESTNET)</span></CardTitle>
</CardHeader>

<CardContent>
             <div className="space-y-4"> 
                  {/* Network Selectors (Unchanged) */}
                  <div className="flex justify-between items-center gap-2">
                      {/* From Network... */}
                      <div className="w-1/2">
                          <label className="block text-sm text-gray-400 mb-1">From Network</label>
                          <select
                              value={fromNetwork}
                              onChange={(e) => handleFromNetworkChange(e.target.value as NetworkOption)}
                              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
                          >
                              {NETWORKS.map((net) => (
                                   <option key={net} value={net}>
                                      {net.toUpperCase()}
                                   </option>
                              ))}
                          </select>
                      </div>
                      <button
                          onClick={handleSwapNetworks}
                          className="mt-6 bg-zinc-800 hover:bg-zinc-700 p-2 rounded-full"
                          title="Swap networks"
                      >
                          🔁
                      </button>
                      {/* To Network... */}
                      <div className="w-1/2">
                          <label className="block text-sm text-gray-400 mb-1">To Network</label>
                          <select
                              value={toNetwork}
                              onChange={(e) => handleToNetworkChange(e.target.value as NetworkOption)}
                              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
                          >
                              {toNetworks.map((net) => (
                                   <option key={net} value={net}>
                                      {net.toUpperCase()}
                                   </option>
                              ))}
                          </select>
                      </div>
                  </div>

                  {/* Token Selectors (Unchanged) */}
                  <div className="flex justify-between items-center gap-2">
                      <div className="w-1/2">
                          <label className="block text-sm text-gray-400 mb-1">From Token</label>
                          <select
                              value={fromToken}
                              onChange={(e) => handleFromTokenChange(e.target.value)}
                              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
                          >
                              {TOKENS[fromNetwork].map((token) => (
                                   <option key={token} value={token}>
                                      {token}
                                   </option>
                              ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Price: ${fromPrice.toFixed(2)}</p>
                      </div>

                      <div className="w-1/2">
                          <label className="block text-sm text-gray-400 mb-1">To Token</label>
                          <select
                              value={toToken}
                              onChange={(e) => handleToTokenChange(e.target.value)}
                              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
                          >
                              {TOKENS[toNetwork].map((token) => (
                                   <option key={token} value={token}>
                                      {token}
                                   </option>
                              ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Price: ${toPrice.toFixed(2)}</p>
                      </div>
                  </div>

                  {/* Amount Input (Unchanged) */}
                  <div className="space-y-3">
                      <div>
                          <label className="block text-sm text-gray-400 mb-1">Amount to send ({fromToken})</label>
                          <input
                              type="number"
                              min="0"
                              step="any"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
                              placeholder="0.00"
                          />
                      </div>
                      
                      {/* Estimated Receive Amount Display (Unchanged) */}
                      <div className="relative">
                          <label className="block text-sm text-gray-400 mb-1">Estimated amount to receive ({toToken})</label>
                          <input
                              type="text"
                              readOnly
                              value={Number(amount) > 0 ? finalToAmount : "0.00"}
                              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white read-only:bg-zinc-700"
                              placeholder="0.00"
                          />
                          {isPriceInvalid && (
                              <p className="text-sm text-yellow-400 mt-2">
                                  ⚠️ Price data unavailable for conversion.
                              </p>
                          )}
                      </div>
                  </div>

                  {/* Fee and Conversion Details (Unchanged) */}
                  <div className="pt-2 border-t border-zinc-700 space-y-1 text-sm">
                      <div className="flex justify-between">
                          <span className="text-gray-400">Conversion Rate:</span>
                          <span className="text-white">
                              1 {fromToken} ≈ {(fromPrice / toPrice).toFixed(4)} {toToken}
                          </span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-gray-400">Protocol Fee:</span>
                          <span className="text-white">
                              {PROTOCOL_FEE_PERCENT}% ({Number(feeAmount) > 0 ? feeAmount : "0.00"} {toToken})
                          </span>
                      </div>
                      <div className="flex justify-between font-semibold text-base mt-2">
                          <span className="text-gray-300">Total Received:</span>
                          <span className="text-green-400">
                              {Number(amount) > 0 ? finalToAmount : "0.00"} {toToken}
                          </span>
                      </div>
                  </div>
                  
                  {/* Action Button */}
                  <Button
                      onClick={handleBridge}
                      className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                      disabled={isButtonDisabled ? true : false}
                  >
                      {getButtonText()}
                  </Button>

                  {/* Status Summary (Updated) */}
                  {bridgeStatus && <BridgeStatusTracker status={bridgeStatus} />}

                  <div className="text-sm text-gray-400 mt-4 text-center border-t border-zinc-700 pt-4">
                      <p>
                          EVM Wallet:{" "}
                          <span className={evmConnected ? "text-green-400" : "text-red-400"}>
                              {evmConnected ? evmAddress?.slice(0, 6) + '...' + evmAddress?.slice(-4) : 'Disconnected'}
                          </span>
                          {evmConnected && fromNetwork !== 'hedera' && currentChainId !== CHAIN_IDS[fromNetwork] && (
                              <span className="text-yellow-400 ml-2"> (Wrong Chain!)</span>
                          )}
                      </p>
                      <p>
                          Hedera Wallet:{" "}
                          <span className={hederaConnected ? "text-green-400" : "text-red-400"}>
                              {hederaConnected ? hederaAccount : 'Disconnected'}
                          </span>
                      </p>
                      <p>
                          Receiving Address:{" "}
                          <span className="text-indigo-400">
                              {receivingAddress ? receivingAddress : 'None'}
                          </span>
                      </p>
                  </div>
             </div>
</CardContent>
</Card>
);
}