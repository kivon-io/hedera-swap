import { API_URL } from "@/config/bridge"
import { NextResponse } from "next/server"


export async function GET(request: Request) {

  if (!API_URL) {
    return NextResponse.json({ error: "API URL not configured" }, { status: 500 })
  }

  try {
    const res = await fetch(`${API_URL}/api/valts/`, {
      headers: { Accept: "application/json" },
      cache: "no-cache",
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Volts not set" }, { status: res.status })
    }

    const data = await res.json()

    // Simply return Laravel result to your frontend
    return NextResponse.json({
        data
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: "Failed to valts",
        detail,
      },
      { status: 500 }
    )
  }
}
