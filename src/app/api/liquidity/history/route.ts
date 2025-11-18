import { NextResponse } from "next/server";

import { API_URL } from "@/config/bridge";

const REMOTE = `${API_URL}/api`

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet_address = searchParams.get("wallet_address");

    if (!wallet_address) {
      return NextResponse.json(
        { error: "wallet_address is required" },
        { status: 400 }
      );
    }

    // Proxy request to Laravel
    const remoteRes = await fetch(
      `${REMOTE}/user-liquidity?wallet_address=${encodeURIComponent(
        wallet_address
      )}`
    );

    if (!remoteRes.ok) {
      throw new Error(`API responded with ${remoteRes.status}`);
    }

    const data = await remoteRes.json();

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
