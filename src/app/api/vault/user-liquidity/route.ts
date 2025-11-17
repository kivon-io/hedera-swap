import { NextResponse } from "next/server"

const LARAVEL_API_URL = "http://104.248.47.146"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const wallet = searchParams.get("wallet")
  const vault = searchParams.get("vault") // vault ID or slug

  if (!wallet || !vault) {
    return NextResponse.json({ error: "Missing wallet or vault" }, { status: 400 })
  }

  try {
    const res = await fetch(`${LARAVEL_API_URL}/api/user-liquidity?wallet_address=${wallet}&network=${vault}`)

    if (!res.ok) throw new Error("Failed to fetch")

    const data = await res.json()

    return NextResponse.json(data)
  } catch (err) {
    console.error("Error fetching user liquidity:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
