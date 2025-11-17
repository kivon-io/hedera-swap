import { NextRequest, NextResponse } from "next/server"; 
import { API_URL } from "@/config/bridge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nonce } = body;

    if (!nonce) {
      return NextResponse.json(
        { success: false, message: "Missing nonce" },
        { status: 400 }
      );
    }

    if (!API_URL) {
      return NextResponse.json(
        { success: false, message: "API URL not configured" },
        { status: 500 }
      );
    }

    // Laravel endpoint expects: nonce
    const laravelResponse = await fetch(`${API_URL}/api/get-bridge-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nonce: nonce }),
    });

    const data = await laravelResponse.json();

    if (!laravelResponse.ok) {
      return NextResponse.json(
        { success: false, message: "Laravel returned an error", details: data },
        { status: laravelResponse.status }
      );
    }

    // Laravel returns:
    // { status: "...", withdrawHash: "0x123..." }
    return NextResponse.json({
      success: true,
      status: data.status,
      withdrawHash: data.withdrawHash,
    });

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("Bridge status route error:", error);
    return NextResponse.json(
      { success: false, message: "Server error", error: error.message },
      { status: 500 }
    );
  }
}
