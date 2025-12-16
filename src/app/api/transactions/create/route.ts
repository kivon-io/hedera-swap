import { TRANSACTION_API_URL } from "@/config/transactions"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    if (!TRANSACTION_API_URL) {
      return NextResponse.json({ error: "Transaction API not configured" }, { status: 500 })
    }

    const payload = await request.json()

    const remoteRes = await fetch(`${TRANSACTION_API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!remoteRes.ok) {
      const errorText = await remoteRes.text()
      return NextResponse.json(
        { error: "Failed to save transaction", details: errorText },
        { status: remoteRes.status }
      )
    }

    const data = await remoteRes.json()
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
