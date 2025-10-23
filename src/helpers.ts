import { Client, AccountId, AccountInfoQuery, PrivateKey  } from "@hashgraph/sdk"

/* eslint-disable @typescript-eslint/no-explicit-any */

type TokenPrices = Record<string, number>
export const fetchTokenPrices = async (): Promise<TokenPrices> => {
  // 🎯 FRONTEND CALL: Call your OWN local backend API route
  const response = await fetch("/api/token/prices")

  // Define a safe fallback object for errors
  const safeZeroPrices: TokenPrices = {
    ETH: 0,
    BNB: 0,
    HBAR: 0,
    USDC: 0,
    bUSDC: 0,
    hUSDC: 0,
  }

  try {
    const data = await response.json()

    if (!response.ok) {
      // If the backend returned a 500 status, it sent an error message and
      // the zeroed prices under the 'prices' key.
      console.error("Backend price error:", data.message)
      // Return the zeroed prices provided by the backend, or the local safe fallback
      return data.prices || safeZeroPrices
    }

    // If response.ok is true (status 200), the data is the clean TokenPrices object
    // { "ETH": 3850.12, "BNB": 580.45, ... }
    return data as TokenPrices
  } catch (error) {
    // This catches network connection issues to your own backend (e.g., server not running)
    console.error("Failed to connect to local API route or parse response:", error)
    // Return zero prices to force the "Bridging Unavailable" state
    return safeZeroPrices
  }
}

export const convertHederaIdToEVMAddress = (address: string): string => {
  try {
    const accountId = AccountId.fromString(address)
    const solidityAddress = accountId.toEvmAddress()
    const evmAddress = `0x${solidityAddress}`
    return evmAddress
  } catch (e: any) {
    throw new Error(`Invalid Hedera address format: ${address}. Details: ${e.message || e}`)
  }
}

export async function getEvmAddressFromAccountId(accountIdString, client) {
    const accountId = AccountId.fromString(accountIdString);

    try {
        // 1. Query the network for the account's information
        const info = await new AccountInfoQuery()
            .setAccountId(accountId)
            .execute(client);

        // 2. Extract the EVM Address
        let evmAddressBytes = info.contractAccountId;

        // The contractAccountId property holds the EVM address as a hex string (Solidity address)
        if (evmAddressBytes) {
            // Check if the address starts with '0x' or if it's the 20-byte hex string
            // For key-derived accounts, it usually returns the 20-byte alias.
            
            // Clean up the string to ensure it's a valid 20-byte hex string
            // If it's the 40-character hex string, ensure it has the '0x' prefix
            if (evmAddressBytes.length === 40) {
                 evmAddressBytes = "0x" + evmAddressBytes;
            }
            
            // NOTE: For accounts with key-derived aliases (like 0x74...), this property
            // is the most reliable source for the alias once the account has been used.
            return evmAddressBytes.toLowerCase(); 
            
        } else {
            return convertHederaIdToEVMAddress(accountIdString); 
        }

    } catch (error) {
        console.error("Error fetching account info:", error);
        throw new Error(`Failed to resolve EVM address for ${accountIdString}.`);
    }
}




