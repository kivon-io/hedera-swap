import { NextResponse } from 'next/server';

// 🎯 Token symbols mapped to their CoinGecko IDs
const COINGECKO_IDS = {
  ETH: 'ethereum',
  BNB: 'binancecoin', // CoinGecko ID for BNB
  HBAR: 'hedera-hashgraph', // CoinGecko ID for HBAR
};
// All symbols whose prices we need to return
const ALL_SYMBOLS = ['ETH', 'BNB', 'HBAR', 'USDC', 'bUSDC', 'hUSDC'];

export async function GET(request: Request) {

  const idsToFetch = Object.values(COINGECKO_IDS).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idsToFetch}&vs_currencies=usd`;

  // Define a default safe (zeroed) response in case of error
  const safeZeroPrices = ALL_SYMBOLS.reduce((acc, symbol) => ({ ...acc, [symbol]: 0 }), {});

  try {
    // 1. BACKEND CALL: Fetch data from CoinGecko
    const cgResponse = await fetch(url);
    
    if (!cgResponse.ok) {
      console.error(`CoinGecko API returned status: ${cgResponse.status}`);
      throw new Error('Failed to fetch from external price API.');
    }
    
    const data = await cgResponse.json();

    // 2. BACKEND PROCESSING: Structure the data
    const prices = {
      // Map the dynamic CoinGecko data
      ETH: data['ethereum']?.usd || 0,
      BNB: data['binancecoin']?.usd || 0,
      HBAR: data['hedera-hashgraph']?.usd || 0,
      
      // Hardcode stablecoins to 1.00 for testing
      USDC: 1.00, 
      bUSDC: 1.00,
      hUSDC: 1.00,
    };

    // 3. BACKEND RESPONSE: Send the final structured data to the frontend
    return NextResponse.json(prices, { status: 200 });
    
  } catch (error) {
    console.error('Price data processing error:', error);
    // On error, return a 500 status and the safe zero prices
    return NextResponse.json(
      { 
        message: 'Internal server error while fetching prices.', 
        prices: safeZeroPrices 
      }, 
      { status: 500 }
    );
  }
}