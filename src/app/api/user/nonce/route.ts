import { randomBytes } from "crypto"
import { NextResponse } from "next/server"

const NONCE_COOKIE_NAME = "wallet-auth-nonce"
const NONCE_TTL_SECONDS = 5 * 60 // 5 minutes

export async function GET() {
  try {
    const nonce = randomBytes(32).toString("hex")
    const response = NextResponse.json({ nonce })

    response.cookies.set(NONCE_COOKIE_NAME, nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: NONCE_TTL_SECONDS,
      path: "/",
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate nonce"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
