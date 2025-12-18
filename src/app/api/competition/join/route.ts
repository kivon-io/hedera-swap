import { COMPETITION_API_URL } from "@/config/competition"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  if (!COMPETITION_API_URL) {
    return NextResponse.json({ error: "Competition API URL is not configured" }, { status: 500 })
  }

  try {
    const { id, address } = await request.json()
    if (!id || !address) {
      return NextResponse.json(
        { error: "Competition ID and address are required" },
        { status: 400 }
      )
    }

    const response = await fetch(`${COMPETITION_API_URL}/competitions/${id}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userAddress: address }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error(error)
      throw new Error(`Failed to join competition: ${response.status}`)
    }
    return NextResponse.json(
      { success: true, message: "Competition joined successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to join competition" }, { status: 500 })
  }
}
