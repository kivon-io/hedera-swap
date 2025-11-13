"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "../ui/button";
import { useBridge } from "@/providers/BridgeProvider";
import { useAccount, useReadContract, useWriteContract as UseWriteContract } from "wagmi";
import { erc20Abi as ERC20_ABI, type Address, parseUnits } from "viem";
import { ContractId, AccountId } from "@hashgraph/sdk";
import { 
  useWallet, 
  useAccountId, 
  useAssociateTokens, 
  useWriteContract,
  useApproveTokenAllowance 
} from "@buidlerlabs/hashgraph-react-wallets";
import { HashpackConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors";
import { getExplorerLink } from "@/helpers/token";
import { TOKENS } from "@/config/tokens";
import { CONTRACT_ADDRESSES, CHAIN_IDS } from "@/config/networks";
import { checkTokenAssociation } from "@/helpers/token";
import { BRIDGE_VOLT_ABI } from "@/config/abi/BridgeVolt";

const POLL_INTERVAL = 1000; // 1 second

const BridgeAction = () => {
  const { selected } = useBridge();
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { isConnected: hederaConnected } = useWallet(HashpackConnector);
  const { data: hederaAccount } = useAccountId({ autoFetch: hederaConnected });

  const { writeContract: evmWriteContract } = UseWriteContract(); 
  const { writeContract: hederaWriteContract } = useWriteContract();

  const fromAmount = Number(selected.from.amount);
  const [depositTx, setDepositTx] = useState<string | null>(null);
  const [withdrawTx, setWithdrawTx] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [step, setStep] = useState<number>(0);
  const [isBridging, setIsBridging] = useState(false);

  const fromNetwork = selected.from.network;
  const toNetwork = selected.to.network;
  const fromToken = selected.from.token; 
  const toToken = selected.to.token; 
  const bridgeContractAddress = CONTRACT_ADDRESSES[fromNetwork] as Address | string;
  
  const isFromNetworkConnected = fromNetwork === "hedera" ? hederaConnected : evmConnected;
  const isToNetworkConnected = toNetwork === "hedera" ? hederaConnected : evmConnected;
  const isDisabled = !fromAmount || !isFromNetworkConnected || !isToNetworkConnected || isBridging;

  const { associateTokens } = useAssociateTokens();
  const { approve } = useApproveTokenAllowance();

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

  // ✅ Helper: EVM deposit handler
  const evmDeposit = async (bridgeData) => {
    const { fromNetwork, fromToken, toNetwork, toToken, amount } = bridgeData;
    const tokenInfo = TOKENS[fromNetwork][fromToken];
    const isNative = tokenInfo.native;
    const args = [
      CHAIN_IDS[toNetwork],
      tokenInfo.address,
      TOKENS[toNetwork][toToken].address,
      parseUnits(amount.toString(), tokenInfo.decimals),
    ];

    const fn = isNative ? "depositNative" : "depositERC20";
    const tx = await evmWriteContract({
      address: bridgeContractAddress,
      abi: BRIDGE_VOLT_ABI,
      functionName: fn,
      args,
      ...(isNative ? { value: parseUnits(amount.toString(), tokenInfo.decimals) } : {}),
    });
    return tx;
  };

  // ✅ Handle main bridge flow
  const handleBridge = useCallback(async () => {
    if (isDisabled) return;
    setIsBridging(true);
    setDepositTx(null);
    setWithdrawTx(null);
    setStep(0);
    setStatusMessage("Checking bridge preconditions...");

    const bridgeData = {
      fromNetwork,
      toNetwork,
      fromToken,
      toToken,
      amount: fromAmount,
      fromAddress: fromNetwork == "hedera" ? hederaAccount : evmAddress,
      toAddress: toNetwork == "hedera" ? hederaAccount : evmAddress,
    };

    try {
      // Step 0: Precheck
      const preCheckRes = await fetch("/api/bridge/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bridgeData),
      });
      const preCheck = await preCheckRes.json();
      if (!preCheck.canBridge) {
        setStatusMessage(preCheck.message || "Cannot perform bridge");
        setIsBridging(false);
        return;
      }

      // Step 1: Preparation
      setStep(1);
      setStatusMessage("Step 1/3: Preparing wallet...");

      // Hedera association
      if (toNetwork === "hedera" && !TOKENS[toNetwork][toToken].native) {
        const tokenAddr = TOKENS[toNetwork][toToken].address;
        const isAssociated = await checkTokenAssociation(hederaAccount, tokenAddr);
        if (!isAssociated) {
          setStatusMessage("Step 1/3: Associating HTS token...");
          await associateTokens([tokenAddr]);
        }
      }

      // Hedera approval
      if (fromNetwork === "hedera" && !TOKENS[fromNetwork][fromToken].native) {
        const tokenAddr = TOKENS[fromNetwork][fromToken].address;
        setStatusMessage(`Step 1/3: Approving ${fromToken}...`);
        await approve([{ tokenId: tokenAddr, amount: fromAmount }], bridgeContractAddress);
      }

      // EVM approval
      if (fromNetwork !== "hedera" && !TOKENS[fromNetwork][fromToken].native) {
        const tokenAddr = TOKENS[fromNetwork][fromToken].address;
        if (typeof allowance !== "bigint" || allowance < value) {
          setStatusMessage(`Step 1/3: Approving ${fromToken}...`);
          await evmWriteContract({
            address: tokenAddr as Address,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [bridgeContractAddress as Address, value],
          });
        }
      }

      // Step 2: Deposit
      setStep(2);
      setStatusMessage("Step 2/3: Depositing to bridge contract...");

      let txHash: string;

      if (fromNetwork === "hedera") {
        const tokenInfo = TOKENS[fromNetwork][fromToken];
        const contractId = ContractId.fromString(CONTRACT_ADDRESSES[fromNetwork]);
        const fn = tokenInfo.native ? "depositNative" : "depositERC20";

        txHash = await hederaWriteContract({
          contractId,
          abi: BRIDGE_VOLT_ABI,
          functionName: fn,
          args: [
            CHAIN_IDS[toNetwork],
            tokenInfo.address,
            TOKENS[toNetwork][toToken].address,
            parseUnits(fromAmount.toString(), tokenInfo.decimals),
          ],
          metaArgs: {
            gas: 120_000,
            amount: tokenInfo.native ? Number(parseUnits(fromAmount.toString(), tokenInfo.decimals)) : 0,
          },
        });
      } else {
        txHash = await evmDeposit(bridgeData);
      }

      setDepositTx(txHash);

      // Step 3: Notify backend
      await fetch("/api/bridge/notify-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bridgeData, txHash }),
      });

      // Poll backend for withdrawal completion
      setStep(3);
      setStatusMessage("Step 3/3: Waiting for bridge completion...");
      const polling = setInterval(async () => {
        try {
          const res = await fetch(`/api/bridge/status?fromTx=${txHash}`);
          const status = await res.json();
          if (status.destinationTx) setWithdrawTx(status.destinationTx);
          if (status.completed) {
            setStatusMessage("✅ Bridge completed!");
            clearInterval(polling);
            setIsBridging(false);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, POLL_INTERVAL);
    } catch (err: any) {
      console.error("Bridge error:", err);
      setStatusMessage("❌ Bridge failed: " + (err.message || "Unknown error"));
      setIsBridging(false);
    }
  }, [selected, fromAmount, evmAddress, hederaAccount, fromNetwork, toNetwork, isDisabled]);

  return (
    <div className="space-y-3">
      {statusMessage && (
        <div className="text-sm text-red-400 font-medium text-center">{statusMessage}</div>
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
