import { TRANSACTION_API_URL } from "@/config/transactions"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { address, addresses } = body ?? {}

    const collectedAddresses: string[] = [
      ...(Array.isArray(addresses)
        ? addresses.filter((addr): addr is string => typeof addr === "string")
        : []),
      ...(address && typeof address === "string" ? [address] : []),
    ]

    const uniqueAddresses = Array.from(
      new Set(collectedAddresses.map((addr) => addr.trim()).filter(Boolean))
    )

    if (!uniqueAddresses.length) {
      return NextResponse.json({ error: "At least one address is required" }, { status: 400 })
    }

    const payload = {
      name: uniqueAddresses[0],
      wallet_addresses: uniqueAddresses,
    }

    const remoteRes = await fetch(`${TRANSACTION_API_URL}/user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!remoteRes.ok) {
      return NextResponse.json({ error: "Failed to create user" }, { status: remoteRes.status })
    }

    const data = await remoteRes.json()
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
