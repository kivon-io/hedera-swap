import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/config/bridge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const { fromNetwork, toNetwork, fromToken, toToken, amount, fromAddress, toAddress } = body;
    if (!fromNetwork || !toNetwork || !fromToken || !toToken || !amount || !fromAddress) {
      return NextResponse.json(
        { success: false, message: "Missing required payload fields" },
        { status: 400 }
      );
    }

    if (!API_URL) {
      return NextResponse.json(
        { success: false, message: "API URL not configured" },
        { status: 500 }
      );
    }

    // Send request to precheck endpoint
    const bridgeResponse = await fetch(`${API_URL}/api/precheck`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fromAddress,
        fromNetwork,
        toNetwork,
        fromToken,
        toToken,
        amount,
        toAddress,
      }),
    });

    const data = await bridgeResponse.json();

    if (!bridgeResponse.ok) {
      return NextResponse.json(
        { success: false, message: "API returned an error", details: data },
        { status: bridgeResponse.status }
      );
    }

    // Return API response to frontend
    return NextResponse.json({
      success: true,
      message: "Precheck completed",
      Data: data,
    });
  } catch (err) {
    // Properly type the error
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("Next.js bridge route error:", error);
    return NextResponse.json(
      { success: false, message: "Server error", error: error.message },
      { status: 500 }
    );
  }
}
