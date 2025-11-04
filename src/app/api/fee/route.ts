import { NextResponse } from "next/server";

const REMOTE = 'http://104.248.47.146/api'

export async function GET() {
  const res = await fetch(REMOTE+"/get-fee");
  const data = await res.json();
  return NextResponse.json(data);
}


export async function POST(request: Request) {
  try {
    const body = await request.json();

    const res = await fetch(`${REMOTE}/set-fee`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Backend responded with ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    // Safely handle all possible error types
    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Failed to update fee", details: error.message },
        { status: 500 }
      );
    }

    // fallback for unexpected error shapes
    return NextResponse.json(
      { error: "Failed to update fee", details: String(error) },
      { status: 500 }
    );
  }
}