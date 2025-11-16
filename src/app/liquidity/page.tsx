"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import VaultList from "@/components/vault/VaultList"
import { useAccountId, useWallet } from "@buidlerlabs/hashgraph-react-wallets"
import { Hbar, TransferTransaction } from "@hashgraph/sdk"
import { useEffect, useState } from "react"



export default function LiquidityDashboard() {
  const [amount, setAmount] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [txStatus, setTxStatus] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [profit, setProfit] = useState(0)
  return (
    <>
      <VaultList />
    </>
  )
}
