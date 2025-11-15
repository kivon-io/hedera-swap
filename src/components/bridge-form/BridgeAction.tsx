"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "../ui/button";
import { useBridge } from "@/providers/BridgeProvider";
// 🛠️ FIX: Use useWriteContract directly to get both sync and async versions
import { useAccount, useReadContract, useWriteContract, useChainId } from "wagmi";
import { erc20Abi as ERC20_ABI, type Address, parseUnits } from "viem";
import { ContractId, AccountId } from "@hashgraph/sdk";
import {
  useWallet,
  useAccountId,
  useAssociateTokens,
  useWriteContract as UseHederaWriteContract,
  useApproveTokenAllowance, 
  useAccountInfo 
} from "@buidlerlabs/hashgraph-react-wallets";
import { HashpackConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors";
import { getExplorerLink } from "@/helpers/token";
import { TOKENS } from "@/config/tokens";
import { CONTRACT_ADDRESSES, CHAIN_IDS } from "@/config/networks";
import { checkTokenAssociation } from "@/helpers/token";
import BRIDGE_ABI from "@/Abi/bridge.json";
import HEDERA_BRIDGE_ABI from "@/Abi/hedera_abi.json";
import {NetworkOption} from "@/config/networks";
import {convertHederaIdToEVMAddress, getEvmAddressFromAccountId} from "@/helpers";

const POLL_INTERVAL = 1000;

const BridgeAction = () => {
  const { selected } = useBridge();
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { isConnected: hederaConnected } = useWallet(HashpackConnector);
  const { data: hederaAccount } = useAccountId({ autoFetch: hederaConnected });

  // 🛠️ FIX: Destructure both sync and async functions from wagmi's useWriteContract
  const { writeContract: evmWriteContract, writeContractAsync: evmWriteContractAsync } = useWriteContract();
  const { writeContract: hederaWriteContract } = UseHederaWriteContract(); // from Hashgraph hook

  const fromAmount = Number(selected.from.amount);
  const [depositTx, setDepositTx] = useState<string | null>(null);
  const [withdrawTx, setWithdrawTx] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [step, setStep] = useState<number>(0);
  const [isBridging, setIsBridging] = useState(false);
  const [nonce, setNonce] = useState<string>("");

  const { associateTokens } = useAssociateTokens();
  const { approve } = useApproveTokenAllowance();
  const chainId = useChainId();

  const { data: accountInfo } = useAccountInfo()

  const fromNetwork = selected.from.network;
  const toNetwork = selected.to.network;
  const fromToken = selected.from.token;
  const toToken = selected.to.token;
  const bridgeContractAddress = CONTRACT_ADDRESSES[fromNetwork] as Address | string;

  const isFromNetworkConnected = fromNetwork === "hedera" ? hederaConnected : evmConnected && chainId === CHAIN_IDS[fromNetwork];
  const isToNetworkConnected = toNetwork === "hedera" ? hederaConnected : evmConnected && chainId === CHAIN_IDS[toNetwork];
  const isDisabled = !fromAmount || !isFromNetworkConnected || !isToNetworkConnected || isBridging;

  useEffect(()=>{
    console.log("Account Info Updated: ", accountInfo);
  }, [accountInfo])

  const getButtonText = () => {
    if (!fromAmount) return "Enter amount";
    if (!isFromNetworkConnected) return `Connect ${fromNetwork} wallet`;
    if (!isToNetworkConnected) return `Connect ${toNetwork} wallet`;
    if (isBridging) return `Bridging...`;
    return `Bridge ${fromAmount} ${selected.from.token} → ${selected.to.token}`;
  };

  const units = TOKENS[fromNetwork][fromToken].decimals;
  const value = useMemo(() => parseUnits(fromAmount.toString() || "0", units), [fromAmount, units]);

  // Check allowance (EVM)
  const { data: allowance } = useReadContract({
    abi: ERC20_ABI,
    address: evmConnected && !TOKENS[fromNetwork][fromToken].native ? TOKENS[fromNetwork][fromToken].address as Address : undefined,
    functionName: "allowance",
    args: evmConnected && evmAddress ? [evmAddress as Address, bridgeContractAddress as Address] : undefined,
    chainId: CHAIN_IDS[fromNetwork],
    query: {
      enabled: evmConnected && !TOKENS[fromNetwork][fromToken].native && !!evmAddress && fromNetwork !== "hedera",
      refetchInterval: 10000,
    },
  });

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
      console.log("Hedera deposit tx hash:", txHash);
      setStatusMessage(`Step 2/3: Deposit TX sent! Waiting for confirmation on ${fromNetwork}...`)
      setDepositTx(txHash as string );
      return txHash;
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
      setStatusMessage(`❌ Deposit failed/rejected. ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  const handleBridge = useCallback(async () => {
    if (isDisabled) return;
    setIsBridging(true);
    setDepositTx(null);
    setWithdrawTx(null);
    setStep(0);
    setStatusMessage("Checking bridge preconditions...");

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

    try {
      const preCheckRes = await fetch("/api/bridge/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bridgeData),
      });
      const preCheck = await preCheckRes.json();

      console.log("Precheck result:", preCheck);

      if (!preCheck?.Data?.node_precheck?.canBridge) {
        setStatusMessage(preCheck.message || "Cannot perform bridge");
        setIsBridging(false);
        return;
      }
      console.log("nonce from precheck",  preCheck?.Data?.nonce)

      const freshNonce = preCheck?.Data?.nonce;
      setNonce(freshNonce);
      bridgeData.nonce = freshNonce

      setStep(1);
      setStatusMessage("Step 1/3: Preparing wallet...");

      if (toNetwork === "hedera" && !TOKENS[toNetwork][toToken].native) {
        const tokenAddr = TOKENS[toNetwork][toToken].address;
        const isAssociated = await checkTokenAssociation(hederaAccount, tokenAddr);
        if (!isAssociated) {
          setStatusMessage("Step 1/3: Associating HTS token...");
          await associateTokens([tokenAddr]);
        }
      }

      if(fromNetwork === "hedera" && !TOKENS[fromNetwork][fromToken].native) {
        const tokenAddr = TOKENS[fromNetwork][fromToken].address;
        const isAssociated = await checkTokenAssociation(hederaAccount, tokenAddr); 
        if (!isAssociated) {
          setStatusMessage("Step 1/3: Associating HTS token...");
          await associateTokens([tokenAddr]);
        }

        const contractIsAssociated = await checkTokenAssociation(bridgeContractAddress, tokenAddr); 

        if(!contractIsAssociated){
            alert('contract not associated')
        }
      }

      if (fromNetwork === "hedera" && !TOKENS[fromNetwork][fromToken].native) {
        const tokenAddr = TOKENS[fromNetwork][fromToken].address;
        setStatusMessage(`Step 1/3: Approving ${fromToken}...`);
        await approve([{ tokenId: tokenAddr, amount: Number(value) }], bridgeContractAddress);
        setStatusMessage(`Step 1/3: ${fromToken} approved.`);
      }

      if (fromNetwork !== "hedera" && !TOKENS[fromNetwork][fromToken].native) {
        const tokenAddr = TOKENS[fromNetwork][fromToken].address;
        if (typeof allowance !== "bigint" || allowance < value) {
          setStatusMessage(`Step 1/3: Confirming approval for ${fromToken} in wallet...`);
          await evmWriteContractAsync({ 
            address: tokenAddr as Address,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [bridgeContractAddress as Address, value],
          });
          setStatusMessage(`Step 1/3: ${fromToken} approved. Waiting for transaction confirmation...`);
        }
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
        setStatusMessage(`❌ Bridge flow failed. ${errMsg}`);
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
    allowance, 
    value, 
    nonce, 
    evmWriteContractAsync, 
    associateTokens, 
    approve, 
    hederaWriteContract
  ]);




  return (
    <div className="space-y-3">
      {statusMessage && (
        <div className={`text-sm font-medium text-center ${statusMessage.startsWith("❌") ? "text-red-400" : statusMessage.startsWith("✅") ? "text-green-400" : "text-blue-400"}`}>
          {statusMessage}
        </div>
      )}

      {depositTx && (
        <div className="text-xs text-blue-400 text-center">
          Deposit TX:{" "}
          <a href={getExplorerLink(depositTx, fromNetwork)} target="_blank" rel="noopener noreferrer" className="underline">
            {depositTx}
          </a>
        </div>
      )}

      {withdrawTx && (
        <div className="text-xs text-green-400 text-center">
          Withdrawal TX:{" "}
          <a href={getExplorerLink(withdrawTx, toNetwork)} target="_blank" rel="noopener noreferrer" className="underline">
            {withdrawTx}
          </a>{" "}
          ✅
        </div>
      )}

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
