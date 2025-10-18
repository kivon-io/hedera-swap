type TokenPrices = Record<string, number>;
export const fetchTokenPrices = async (): Promise<TokenPrices> => {
  // 🎯 FRONTEND CALL: Call your OWN local backend API route
  const response = await fetch('/api/token/prices'); 
  
  // Define a safe fallback object for errors
  const safeZeroPrices: TokenPrices = { 
    ETH: 0, 
    BNB: 0, 
    HBAR: 0, 
    USDC: 0, 
    bUSDC: 0, 
    hUSDC: 0,
  };

  try {
    const data = await response.json();

    if (!response.ok) {
      // If the backend returned a 500 status, it sent an error message and 
      // the zeroed prices under the 'prices' key.
      console.error('Backend price error:', data.message);
      // Return the zeroed prices provided by the backend, or the local safe fallback
      return data.prices || safeZeroPrices;
    }

    // If response.ok is true (status 200), the data is the clean TokenPrices object
    // { "ETH": 3850.12, "BNB": 580.45, ... }
    return data as TokenPrices;

  } catch (error) {
    // This catches network connection issues to your own backend (e.g., server not running)
    console.error('Failed to connect to local API route or parse response:', error);
    // Return zero prices to force the "Bridging Unavailable" state
    return safeZeroPrices; 
  }
};