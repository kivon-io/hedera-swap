import { API_URL } from "@/config/bridge"
import { NextResponse } from "next/server"


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const network = searchParams.get("network") // e.g. "Ethereum"

  if (!network) {
    return NextResponse.json({ error: "Network is required" }, { status: 400 })
  }

  if (!API_URL) {
    return NextResponse.json({ error: "API URL not configured" }, { status: 500 })
  }

  try {
    const res = await fetch(`${API_URL}/api/valt/${network}`, {
      headers: { Accept: "application/json" },
      cache: "no-cache",
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Volt not found" }, { status: res.status })
    }

    const data = await res.json()

    // Simply return Laravel result to your frontend
    return NextResponse.json({
      feesGenerated: data.feesGenerated,
      tvl: data.totalDeposits,
      apy: data.apy,
      total: data.total,
      profit: data.profit,
      totalWithdrawn: data.totalWithdrawn,
      logo: data.logo,
      token_logo: data.token_logo,
      token_symbol: data.token_symbol, 
      network_slug: network,
      native_token_symbol: data.native_token_symbol,
      native_token_price: data.native_token_price
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: "Failed to connect to backend",
        detail,
      },
      { status: 500 }
    )
  }
}
