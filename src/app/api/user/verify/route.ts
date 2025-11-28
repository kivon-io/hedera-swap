import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { recoverMessageAddress } from "viem"

const NONCE_COOKIE_NAME = "wallet-auth-nonce"

export async function POST(request: Request) {
  try {
    const { message, signature } = await request.json()

    if (!message || !signature) {
      return NextResponse.json({ error: "Message and signature are required" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const storedNonce = cookieStore.get(NONCE_COOKIE_NAME)?.value

    if (!storedNonce) {
      return NextResponse.json({ error: "Nonce expired" }, { status: 401 })
    }

    if (!message.includes(storedNonce)) {
      return NextResponse.json({ error: "Nonce mismatch" }, { status: 401 })
    }

    const recoveredAddress = await recoverMessageAddress({ message, signature })

    const response = NextResponse.json({ address: recoveredAddress })
    response.cookies.delete(NONCE_COOKIE_NAME)

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify signature"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
