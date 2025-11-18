"use client";

import { useState, useCallback, useMemo, useEffect, useRef} from "react";
import { Button } from "../ui/button";
import { useBridge } from "@/providers/BridgeProvider";

import { 
  useAccount, 
  useReadContract,   
  useWriteContract, 
  useChainId, 
  useBalance as evmUseBalance, 
  useWaitForTransactionReceipt 
} from "wagmi";
import { erc20Abi as ERC20_ABI, type Address, parseUnits,  formatUnits} from "viem";
import { ContractId, AccountId } from "@hashgraph/sdk";
import {
  useWallet,
  useAccountId,
  useAssociateTokens,
  useWriteContract as UseHederaWriteContract,
  useApproveTokenAllowance, 
  useAccountInfo, 
  useTokensBalance, 
  useWatchTransactionReceipt as useWatchHederaTransaction
} from "@buidlerlabs/hashgraph-react-wallets";
import { HashpackConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors";
import { getExplorerLink } from "@/helpers/token";
import { TOKENS } from "@/config/tokens";
import { CONTRACT_ADDRESSES, CHAIN_IDS } from "@/config/networks";
import { checkTokenAssociation } from "@/helpers/token";
import BRIDGE_ABI from "@/Abi/bridge.json";
import HEDERA_BRIDGE_ABI from "@/Abi/hedera_abi.json";
import {NetworkOption} from "@/config/networks";
import {convertHederaIdToEVMAddress} from "@/helpers";
import {formatTrxHash, formatAddress} from "@/lib/utils"

const POLL_INTERVAL = 1000;

const BridgeAction = () => {
  const { selected } = useBridge();
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { isConnected: hederaConnected } = useWallet(HashpackConnector);
  const { data: hederaAccount } = useAccountId({ autoFetch: hederaConnected });

  
  const { writeContract: evmWriteContract, writeContractAsync: evmWriteContractAsync } = useWriteContract();
  const { writeContract: hederaWriteContract } = UseHederaWriteContract(); 

  const fromAmount = Number(selected.from.amount);
  const [depositTx, setDepositTx] = useState<string | null>(null);
  const [uDepositTx, setUdepositTx] = useState<string | null>(null);
  const [evmAprovalTx, setEvmAprovalTx] = useState<string | null>(null);
  const [withdrawTx, setWithdrawTx] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [step, setStep] = useState<number>(0);
  const [isBridging, setIsBridging] = useState(false);
  const [nonce, setNonce] = useState<string>("");

  const { associateTokens } = useAssociateTokens();
  const { approve } = useApproveTokenAllowance();
  const chainId = useChainId();


  const fromNetwork = selected.from.network;
  const toNetwork = selected.to.network;
  const fromToken = selected.from.token;
  const toToken = selected.to.token;
  const bridgeContractAddress = CONTRACT_ADDRESSES[fromNetwork] as Address | string;

  const fromTokenInfo = TOKENS[fromNetwork][fromToken];
  const toTokenInfo = TOKENS[toNetwork][toToken];

  const units = TOKENS[fromNetwork][fromToken].decimals;
  const value = useMemo(() => parseUnits(fromAmount.toString() || "0", units), [fromAmount, units]);

  const { data: accountInfo } = useAccountInfo({autoFetch: hederaConnected})
  const { data: tokensBalance } = useTokensBalance({ tokens: [ fromNetwork == 'hedera' ?  fromTokenInfo.address : '' ] ,  autoFetch: hederaConnected})


  const hederaHTSTokenBalance = useMemo(() => {
    if (fromNetwork === 'hedera' && tokensBalance) {
      const tokenBal = tokensBalance[0]?.balance ?? 0;
      return tokenBal ? Number(formatUnits(tokenBal.toString(), units)) : 0;
    }
    return 0;
  }, [fromAmount, units, fromNetwork, tokensBalance, fromTokenInfo]);

  const hbarBalance = useMemo(() => {
    if (fromNetwork === 'hedera' && hederaConnected && fromTokenInfo.native) {
      const balance = accountInfo?.balance?.balance ?? 0;
      return balance ? Number(formatUnits(balance.toString(), 8)) : 0;
    }
    return 0;
  }, [fromAmount, units, fromNetwork, tokensBalance, fromTokenInfo, hederaConnected, accountInfo]);


  const {data: Erc20TokenBalance}  = evmUseBalance({
    address: evmAddress,
    token: fromTokenInfo.address as Address, 
  })
  

  const {data: EthBalance}  = evmUseBalance({address: evmAddress})

  const ethBalance = useMemo(() => {
    if (fromNetwork != 'hedera' && evmConnected && fromTokenInfo.native) {
        return EthBalance?.formatted ?? 0; 
    }
    return 0;
  }, [fromAmount, units, fromNetwork, fromTokenInfo, accountInfo]);

  const erc20TokenBalance = useMemo(() => {
    if (fromNetwork != 'hedera' && evmConnected && !fromTokenInfo.native) {
        return Erc20TokenBalance?.formatted ?? 0; 
    }
    return 0;
  }, [fromAmount, units, fromNetwork, fromTokenInfo, accountInfo]);


  const userBalance = useMemo(() => {
  if (fromNetwork === "hedera") {
    if (fromTokenInfo.native) return hbarBalance;         // HBAR
    return hederaHTSTokenBalance;                         // HTS token
  } else {
    if (fromTokenInfo.native) return Number(ethBalance);   // ETH / BNB / etc
    return Number(erc20TokenBalance);                      // ERC20 token
  }
  }, [
    fromNetwork,
    fromTokenInfo,
    hbarBalance,
    hederaHTSTokenBalance,
    ethBalance,
    erc20TokenBalance
  ]);  

  const insufficientBalance = fromAmount > (userBalance || 0);
  const isFromNetworkConnected = fromNetwork === "hedera" ? hederaConnected : evmConnected && chainId === CHAIN_IDS[fromNetwork];
  const isToNetworkConnected = toNetwork === "hedera" ? hederaConnected : evmConnected;
  const isDisabled = !fromAmount  || insufficientBalance || !isFromNetworkConnected || !isToNetworkConnected || isBridging;

  // cosnt insufficientBalance = false; 
  // insufficientBalance

  const getButtonText = () => {
    if (!fromAmount) return "Enter amount";

    if (!isFromNetworkConnected) return `Connect ${fromNetwork} wallet`;
    if (!isToNetworkConnected) return `Connect ${toNetwork} wallet`;

      if (insufficientBalance)
      return `Insufficient ${fromToken} for bridge`;

    if (isBridging) return `Bridging...`;

    return `Bridge ${fromAmount} ${selected.from.token} → ${selected.to.token}`;
  };



  useEffect(()=>{
    console.log("Account Info Updated: ", accountInfo);
    console.log("Tokens Balance Updated: ", hederaHTSTokenBalance);
    console.log("The token balance: ", tokensBalance);
    console.log("The hbar balance: ", hbarBalance);

    console.log('eth balance', ethBalance); 
    console.log('erc20 balance', erc20TokenBalance); 

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
    fromNetwork: NetworkOption;
    toNetwork: NetworkOption;
    fromToken: string;
    toToken: string;
    amount: number;
    fromAddress: string | AccountId | Address;
    toAddress: string | AccountId | Address;
    nonce?: string;
  };

  const getRecipient = () => {
    if (toNetwork === "hedera") {
      return hederaAccount ? accountInfo.evm_address : evmAddress;
    } else {
      return evmAddress;
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
    const { fromNetwork, fromToken, toNetwork, toToken, nonce } = bridgeData;
    const tokenFromInfo = TOKENS[fromNetwork][fromToken];
    const tokenToInfo = TOKENS[toNetwork][toToken];
    const recipient = getRecipient();
    const args = [
      tokenFromInfo.address,
      ( toNetwork == 'hedera' ?  convertHederaIdToEVMAddress(tokenToInfo.address) :  tokenToInfo.address ),
      recipient,
      value,
      nonce,
      CHAIN_IDS[toNetwork]
    ];
    const isNative = TOKENS[fromNetwork][fromToken].native === true;

    console.log("EVM Deposit args:", args);

    evmWriteContract({
      address: bridgeContractAddress as Address,
      abi: BRIDGE_ABI,
      functionName: "bridgeDeposit",
      args,
      ...(isNative ? { value: value } : {value: BigInt(0)}),
    },
    {
      onSuccess: (hash) => {
        setStatusMessage(`Step 2/3: Deposit TX sent! Waiting for confirmation on ${fromNetwork}...`)
        setDepositTx(hash);
        setUdepositTx(hash);
        notifyRelayer();
      },
      onError: (e: unknown) => {
        setIsBridging(false);
        let errMsg: string;
        if (e instanceof Error) {
          errMsg = e.message;
        } else if (typeof e === "object" && e !== null && "shortMessage" in e) {
          errMsg = (e as { shortMessage?: string }).shortMessage || "Unknown error";
        } else {
          errMsg = "Unknown error";
        }
        setStatusMessage(`❌ Deposit failed/rejected. ${errMsg}`);
      }
    });
  };





     
  const { watch: watchHedera } = useWatchHederaTransaction()

  const hederaDeposit = async (bridgeData: BridgeData) => {
    const contractId = ContractId.fromString(bridgeContractAddress as string);
    const tokenFromInfo = TOKENS[fromNetwork][fromToken];
    const tokenToInfo = TOKENS[toNetwork][toToken];
    const recipient = getRecipient();
    const { nonce } = bridgeData;
    setStatusMessage(`Step 2/3: Confirming deposit in wallet...`);
    try {
      console.log('hbar value', value)
      console.log('hbar token from info', tokenFromInfo)
      console.log('hbar token to info', tokenToInfo)
      console.log('hbar nounc', nonce)
      console.log('hbar to chain id info', CHAIN_IDS[toNetwork])
      console.log('hbar recipient info', recipient)

      const txHash = await hederaWriteContract({
        contractId,
        abi: HEDERA_BRIDGE_ABI,
        functionName: 'bridgeDeposit',
        args: [
          ( !tokenFromInfo.native ? convertHederaIdToEVMAddress(tokenFromInfo.address) : tokenFromInfo.address),
          tokenToInfo.address,
          recipient,
          value,
          nonce,
          CHAIN_IDS[toNetwork]
        ],
        metaArgs: {
          gas: 220_000,
          amount: tokenFromInfo.native ? Number(fromAmount) : 0,
        },
      });

      console.log('hedera', txHash)
      setStatusMessage(`Step 2/3: Deposit TX sent! Waiting for confirmation on ${fromNetwork}...`)
      console.log("Hedera deposit tx hash:", txHash);

      watchHedera(txHash as string, {

        onSuccess: (transaction) => {
          console.log('succesfull')
          setUdepositTx(txHash as string);
          notifyRelayer(); 
          return transaction
        },
        onError: (transaction, error) => {
          console.log(error)
          setStatusMessage(`❌ Deposit failed/rejected. ${error}`);
          setIsBridging(false); 
          return transaction
        },
      })
    } catch(e: unknown) {
      setIsBridging(false);
      let errMsg: string;
      if (e instanceof Error) {
        errMsg = e.message;
      } else if (typeof e === "object" && e !== null && "shortMessage" in e) {
        errMsg = (e as { shortMessage?: string }).shortMessage || "Unknown error";
      } else {
        errMsg = "Unknown error";
      }
      setStatusMessage(`❌ Deposit failed/rejected.`);
      throw new Error(errMsg);
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
  };

  const notifyRelayer = async () => {
    const data = await fetch("/api/bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bridgeData),
    });

    const result = await data.json();
    console.log("Bridge result:", result);

    if (result?.success) {
      setStatusMessage("Relayer Processing Withdrawal...");
    }
    // --- Start Polling for Withdrawal Hash ---
    const poller = setInterval(async () => {
      try {
        const res = await fetch("/api/bridge/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nonce: bridgeData.nonce }),
        });
        const status = await res.json();
        console.log("Polling result:", status);
        //  Stop if no hash yet
        if (!status || !status.withdrawHash) return;
        // Withdrawal hash found
        clearInterval(poller);
        setWithdrawTx(status.withdrawHash);
        setStatusMessage("Bridge Completed ✅");
        setIsBridging(false); 
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000); // Poll every 2 seconds
};




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
    if (isDisabled) return;
    setIsBridging(true);
    setDepositTx(null);
    setUdepositTx(null)
    setWithdrawTx(null);
    // calledRef.current = false;
    // calledRef1.current = false;
    setStep(0);
    setStatusMessage("Checking bridge preconditions...");
    try {
      const preCheckRes = await fetch("/api/bridge/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bridgeData),
      });
      const preCheck = await preCheckRes.json();

      console.log("Precheck result:", preCheck);

      if (!preCheck?.Data?.node_precheck?.canBridge) {
        setStatusMessage(preCheck.Data.node_precheck.message || "Cannot perform bridge");
        setIsBridging(false);
        return;
      }

      let requireAllowance = false; 

      if(preCheck?.Data?.node_precheck?.requireAllowance){
        requireAllowance = preCheck.Data.node_precheck.requireAllowance
      }

      console.log("nonce from precheck",  preCheck?.Data?.nonce)

      const freshNonce = preCheck?.Data?.nonce;
      setNonce(freshNonce);
      bridgeData.nonce = freshNonce

      setStep(1);
      setStatusMessage("Step 1/3: Preparing wallet...");


      if(fromNetwork === "hedera" && !fromTokenInfo.native) {
        const tokenAddr = fromTokenInfo.address;
        const isAssociated = await checkTokenAssociation(hederaAccount, tokenAddr); 
        if (!isAssociated) {
          setStatusMessage(`${fromToken} is not associated to your account`);
          setStep(0);
          setIsBridging(false);
          return; 
        }
      }

      if (toNetwork === "hedera" && !toTokenInfo.native) {
        const tokenAddr = toTokenInfo.address;
        const isAssociated = await checkTokenAssociation(hederaAccount, tokenAddr);
        if (!isAssociated) {
          setStatusMessage(`Step 1/3: Associating ${toToken} token...`);
          await associateTokens([tokenAddr]);
        }
      }

      if (fromNetwork === "hedera" && !fromTokenInfo.native) {
        const tokenAddr = fromTokenInfo.address;
        if(requireAllowance){
            setStatusMessage(`Step 1/3: Approving ${fromToken}...`);
            await approve([{ tokenId: tokenAddr, amount: Number(value) }], bridgeContractAddress);
            setStatusMessage(`Step 1/3: ${fromToken} approved.`);
        }
      }

      if (fromNetwork !== "hedera" && !fromTokenInfo.native) {
        const tokenAddr = fromTokenInfo.address;

        // if (typeof allowance !== "bigint" || allowance < value) {
        if(requireAllowance){
          setStatusMessage(`Step 1/3: Confirming approval for ${fromToken} in wallet...`);
          const approvalTrx = await evmWriteContractAsync({ 
            address: tokenAddr as Address,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [bridgeContractAddress as Address, value],
          });
          setStatusMessage(`Step 1/3: ${fromToken} approved. Waiting for transaction confirmation...`);
          setEvmAprovalTx(approvalTrx); 
          // evmDeposit(bridgeData);
          // return; 
        }
        // }
      }


      setStep(2);
      setStatusMessage("Step 2/3: Initiating deposit to bridge contract...");
      if (fromNetwork === "hedera") {
        await hederaDeposit(bridgeData);
        console.log("Hedera Deposit initiated.");
      } else {
        evmDeposit(bridgeData);
        console.log("EVM Deposit initiated.");
      }
      setStep(3);
      setStatusMessage("Step 3/3: Monitoring bridge execution...");
    } catch (error: unknown) {
      setIsBridging(false);
      let errMsg: string;
      if (error instanceof Error) {
        errMsg = error.message;
      } else if (typeof error === "object" && error !== null && "shortMessage" in error) {
        errMsg = (error as { shortMessage?: string }).shortMessage || "Unknown error";
      } else {
        errMsg = "Unknown error";
      }
      if (!statusMessage?.startsWith("❌")) {
        setStatusMessage(`❌ Bridge flow failed`);
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
    value, 
    nonce, 
    evmWriteContractAsync, 
    associateTokens, 
    approve, 
    hederaWriteContract
  ]);




  return (
<div className="space-y-4">

  {/* STATUS MESSAGE */}
  {statusMessage && (
    <div
      className={`text-sm font-semibold text-center px-3 py-2 rounded-lg border 
        ${
          statusMessage.startsWith("❌")
            ? "bg-red-50 text-red-600 border-red-200"
            : statusMessage.startsWith("✅")
            ? "bg-green-50 text-green-600 border-green-200"
            : "bg-blue-50 text-blue-600 border-blue-200"
        }`}
    >
      {statusMessage}
    </div>
  )}

  {/* ADDRESS PANEL */}
  {(isFromNetworkConnected && isToNetworkConnected) && (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700">Bridge Details</h3>

      {/* Deposit Address */}
      <div className="flex flex-col text-xs">
        <span className="text-gray-500 font-medium">
          Deposit Address ({fromNetwork}):  {fromNetwork === "hedera" ? formatAddress(hederaAccount) : formatAddress(evmAddress as string)}
        </span>
        {/* <span className="text-gray-800 font-mono break-all">
         
        </span> */}
      </div>

      {/* Receiving Address */}
      <div className="flex flex-col text-xs">
        <span className="text-gray-500 font-medium">
          Receiving Address ({toNetwork}): {toNetwork === "hedera" ? formatAddress(hederaAccount) : formatAddress(evmAddress as string)}
        </span>
        {/* <span className="text-gray-800 font-mono break-all">
          
        </span> */}
      </div>
    </div>
  )}

  {/* DEPOSIT TX CARD */}
  {uDepositTx && (
    <div className="bg-white border border-blue-200 rounded-xl p-3 text-center shadow-sm">
      <div className="text-xs tracking-wide text-blue-600 font-semibold mb-1">
        Deposit Transaction
      </div>
      <a
        href={getExplorerLink(uDepositTx as string, fromNetwork)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline font-mono text-xs"
      >
        {formatTrxHash(uDepositTx as string)}
      </a>
    </div>
  )}

  {/* WITHDRAW TX CARD */}
  {withdrawTx && (
    <div className="bg-white border border-green-200 rounded-xl p-3 text-center shadow-sm">
      <div className="text-xs tracking-wide text-green-600 font-semibold mb-1">
        Withdrawal Transaction
      </div>
      <a
        href={getExplorerLink(withdrawTx, toNetwork)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-green-600 underline font-mono text-xs"
      >
        {formatTrxHash(withdrawTx)}
      </a>
      <span className="ml-1 text-green-600">✅</span>
    </div>
  )}

  {/* BUTTON (UNTOUCHED) */}
  <Button
    className="w-full rounded-xl h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all duration-300"
    size="lg"
    onClick={handleBridge}
    disabled={isDisabled}
  >
    {getButtonText()}
  </Button>
</div>

  );
};

export default BridgeAction;
