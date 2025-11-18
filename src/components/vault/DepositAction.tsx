"use client"

import { useState, useEffect } from "react"
import { useVault } from "@/providers/VaultProvider"
import { Button } from "../ui/button"
import { parseEther } from "viem"
import { useSendTransaction } from "wagmi"
import { useEvmWallet } from "@/hooks/useEvmWallet"
import { useWallet, useAccountId } from "@buidlerlabs/hashgraph-react-wallets"
import { Hbar, TransferTransaction, type Signer } from "@hashgraph/sdk"


const DepositAction = () => {
  const { vault, depositAmount: amount } = useVault()
  const [txStatus, setTxStatus] = useState<string>("")

  //  EVM wallet
  const { address: evmAddress, isConnected: evmConnected } = useEvmWallet()

  //  Hedera wallet
  const { signer, isConnected: hederaConnected } = useWallet()
  const { data: hederaAccount } = useAccountId({ autoFetch: hederaConnected })

  //  Wagmi EVM transaction
  const { sendTransaction, data: evmTx, isPending, error } = useSendTransaction()
  const [hederaPending, setPending] = useState<boolean>(false)

  const handleDeposit = async () => {
    if (!amount || Number(amount) <= 0) {
      setTxStatus("Enter a valid amount")
      return
    }

    // -----------------------------
    //  CASE 1: EVM Deposit
    // -----------------------------
    if (vault.network.slug !== "hedera") {
      if (!evmConnected || !evmAddress) {
        setTxStatus("Connect an EVM wallet")
        return
      }

      try {
        sendTransaction({
          to: vault.network.address as `0x${string}`,
          value: parseEther(amount.toString()),
        })
        setTxStatus("Sending EVM transaction...")
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setTxStatus("EVM deposit failed: " + message)
      }

      return
    }

    // -----------------------------
    // CASE 2: Hedera Deposit
    // -----------------------------
    if (!hederaConnected || !signer || !hederaAccount) {
      setTxStatus("Connect a Hedera wallet")
      return
    }

    try {
      setTxStatus("Preparing Hedera transaction...")
      const hbarAmount = new Hbar(Number(amount))
      const tx = new TransferTransaction()
        .addHbarTransfer(hederaAccount, hbarAmount.negated())
        .addHbarTransfer(vault.network.address, hbarAmount)

      const frozen = await tx.freezeWithSigner(signer as Signer)
      const result = await frozen.executeWithSigner(signer as Signer)
      setTxStatus("Transaction sent! Saving...")
      // Notify backend
      await fetch("/api/liquidity/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network: "hedera",
          wallet_address: hederaAccount.toString(),
          amount: Number(amount),
          txId: result.transactionId.toString(),
          vault: vault.id,
        }),
      }).then(() => {
        setTxStatus("Deposit successful!")
        setPending(false)
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setPending(false)
      setTxStatus("Hedera deposit failed: " + message)
    }
  }

  // ---------------------------
  //Detect successful EVM tx
  // ---------------------------
  useEffect(() => {
    if (!evmTx) return
    // evmTx from useSendTransaction may be a tx hash string (`0x...`) or an object with a `hash` prop,
    // so normalize to a string txHash before sending to the backend.
    const txHash =
      typeof evmTx === "string"
        ? evmTx
        : (evmTx as { hash?: string }).hash ?? String(evmTx)

    fetch("/api/liquidity/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        network: vault.network.slug,
        wallet_address: evmAddress,
        amount: Number(amount),
        txId: txHash,
        vault: vault.id,
      }),
    }).then(() => {
      setTxStatus("Deposit successful!")
    })
    .catch((err) => {
      console.error("Failed to notify backend of EVM deposit", err)
    })
  }, [evmTx, evmAddress, amount, vault.network.slug, vault.id])

  return (
    <div className="flex flex-col gap-3">
      <Button
        className="w-full rounded-xl h-12"
        onClick={handleDeposit}
        disabled={isPending || hederaPending}
      >
        {isPending || hederaPending ? "Processing..." : "Deposit"}
      </Button>

      {txStatus && <p className="text-xs text-center">{txStatus}</p>}

      {error && (
        <p className="text-xs text-center">
          {error instanceof Error ? error.message : String(error)}
        </p>
      )}
    </div>
  )
}

export default DepositAction
