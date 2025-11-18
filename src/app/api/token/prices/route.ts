import { NextResponse } from 'next/server';
import { API_URL } from "@/config/bridge";

const REMOTE = `${API_URL}/api/token-prices`;

export async function GET() {
  try {

        if (!API_URL) {
      return NextResponse.json(
        { success: false, message: "API URL not configured" },
        { status: 500 }
      );
    }
    
    const response = await fetch(REMOTE, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error('Failed to fetch from  API.');
    }
     
    const prices = await response.json();
    return NextResponse.json(prices, { status: 200 });

  } catch (error) {
    console.error('Error fetching token prices from  backend:', error);
    // Return a safe fallback
    const safeZeroPrices = {
      ETH: 0, BNB: 0, HBAR: 0, CLXY: 0, SAUCE: 0, DAI: 0, USDCt: 0,
    };
    return NextResponse.json(
      { message: 'Failed to fetch token prices.', prices: safeZeroPrices },
      { status: 500 }
    );
  }
}
