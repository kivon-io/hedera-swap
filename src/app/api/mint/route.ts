import { NextRequest, NextResponse } from "next/server";
import axios, { AxiosError } from "axios";
import { API_URL } from "@/config/bridge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const nonce = searchParams.get("nonce");

    if (!nonce) {
      return NextResponse.json(
        { error: "Missing nonce query parameter" },
        { status: 400 }
      );
    }

    // Build Express URL
    const expressUrl = `${API_URL}/api/mint/${nonce}`;

    // Make POST request
    const expressResponse = await axios.get(expressUrl);

    return NextResponse.json(
      {
        success: true,
        data: expressResponse.data,
      },
      { status: 200 }
    );

  } catch (error) {
    const err = error as AxiosError;

    return NextResponse.json(
      {
        error: "Mint relay failed",
        details: err.response?.data ?? err.message,
      },
      { status: 500 }
    );
  }
}
