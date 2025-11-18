import { NextResponse } from "next/server";


import { API_URL } from "@/config/bridge";

const REMOTE = `${API_URL}/api`

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    if (!body.wallet_address || typeof body.amount !== "number") {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    // Proxy request to Laravel API
    const remoteRes = await fetch(
      `${REMOTE}/add-liquidity`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!remoteRes.ok) {
      throw new Error(`Laravel API responded with ${remoteRes.status}`);
    }

    const data = await remoteRes.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
