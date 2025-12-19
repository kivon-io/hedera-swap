"use client"

import { COMPETITION_ID } from "@/config/competition"
import { useAccountId, useWallet } from "@buidlerlabs/hashgraph-react-wallets"
import { HWCConnector } from "@buidlerlabs/hashgraph-react-wallets/connectors"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useCallback, useState } from "react"
import { Button } from "../ui/button"

const JoinCompetition = () => {
  const { isConnected } = useWallet(HWCConnector)
  const { data: hederaAccount, isLoading: isFetchingAccount } = useAccountId({
    autoFetch: isConnected,
  })
  const queryClient = useQueryClient()

  const [isJoining, setIsJoining] = useState(false)

  const { data: isJoined, isLoading: isVerifying } = useQuery({
    queryKey: ["competition", COMPETITION_ID, hederaAccount],
    queryFn: async () => {
      const response = await fetch(
        `/api/competition/verify?id=${COMPETITION_ID}&address=${hederaAccount}`
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? "Unable to verify competition status")
      }

      const data = await response.json()

      return data
    },
    enabled: Boolean(hederaAccount),
    retry: false,
  })

  const handleJoin = useCallback(async () => {
    if (!hederaAccount) {
      return
    }

    setIsJoining(true)

    try {
      const response = await fetch("/api/competition/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: COMPETITION_ID,
          address: hederaAccount,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? "Failed to join competition")
      }

      queryClient.invalidateQueries({ queryKey: ["competition", COMPETITION_ID, hederaAccount] })
    } catch (error) {
      console.error(error)
    } finally {
      setIsJoining(false)
    }
  }, [hederaAccount, isJoined])

  return (
    <div className='flex flex-col gap-2'>
      {!isJoined && !isFetchingAccount && !isVerifying ? (
        <p className='text-sm text-zinc-500'>
          Join the competition to earn rewards and compete for the top spot.
        </p>
      ) : (
        <p className='text-sm text-zinc-900'>Multichain swap</p>
      )}

      {isConnected &&
        !isFetchingAccount &&
        !isVerifying &&
        (!isJoined ? (
          <Button onClick={handleJoin} disabled={isJoining} size={"sm"}>
            {isJoining ? "Joining..." : "Join Competition"}
          </Button>
        ) : (
          <Link href={`https://kivon.io/trading-competition/${COMPETITION_ID}`}>
            <Button size={"sm"}>View Leaderboard</Button>
          </Link>
        ))}
    </div>
  )
}

export default JoinCompetition
