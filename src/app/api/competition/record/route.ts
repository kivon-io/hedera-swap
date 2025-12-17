import { COMPETITION_API_URL } from "@/config/competition"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { id, userAddress, volume } = await request.json()

    const response = await fetch(`${COMPETITION_API_URL}/competitions/${id}/update-volume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userAddress, volume }),
    })

    if (!response.ok) {
      throw new Error(`Failed to update user trading volume: ${response.status}`)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
