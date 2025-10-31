
import { useMemo } from "react";
import { erc20Abi, formatUnits } from "viem";
import {type NetworkOption } from "@/config/networks";
import { useReadContract, useBalance } from "wagmi"
import { Hbar } from "@hashgraph/sdk";

export const EXPLORER_URLS = {
  ethereum: "https://sepolia.etherscan.io/tx/",
  bsc: "https://testnet.bscscan.com/tx/",
  hedera: "https://hashscan.io/testnet/transaction/",
};

export const truncateHash = (hash: string  | null | undefined) =>
  !hash ? "" : `${hash.slice(0, 6)}...${hash.slice(-4)}`;

export const getExplorerLink = (txHash: string, network: NetworkOption) =>
  EXPLORER_URLS[network] + txHash;


export function useEthBalance(address?: `0x${string}`) {
  const { data } = useBalance({
    address, // user wallet address
    unit: 'ether'
  });
  return data?.formatted; 
}

export function useErc20TokenBalance(tokenAddress:any, walletAddress:any) {
  
  const { data: decimals } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !!tokenAddress },
  });

  const { data: rawBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!tokenAddress && !!walletAddress },
  });

  const balance = useMemo(() => {
    if (!rawBalance || decimals === undefined) return "0";
    return formatUnits(rawBalance as bigint, decimals as number);
  }, [rawBalance, decimals]);
  
  return balance;
}


/**
 * Convert an amount of token A into its equivalent amount of token B
 * using their USD prices.
 *
 * @param {number|string} amountA - The amount of token A to convert
 * @param {number} priceA - The USD price of token A (1 tokenA = priceA USD)
 * @param {number} priceB - The USD price of token B (1 tokenB = priceB USD)
 * @returns {number} - The equivalent amount of token B
 */
export function convertTokenByUSD(amountA:number | string, priceA:number, priceB:number): number {
  if (!amountA || priceA <= 0 || priceB <= 0) {
    return 0; 
  }

  const amountInUSD = Number(amountA) * priceA;
  const amountB = amountInUSD / priceB;
  return amountB;
}



// Assuming you have a function to fetch account data from the Mirror Node
// This function would be separate from the Buidler Labs wallet package, 
// but is a standard part of a Hedera dApp.

export const checkTokenAssociation = async (accountId: string, tokenId: string): Promise<boolean> => {
    // 1. Construct the Mirror Node URL
    const mirrorNodeUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens`; // Use mainnet URL for mainnet

    try {
        const response = await fetch(mirrorNodeUrl);
        const data = await response.json();

        // 2. Check the response for the specific token ID
        const isAssociated = data.tokens.some(
            (token: { token_id: string; }) => token.token_id === tokenId
        );

        return isAssociated;

    } catch (error) {
        console.error("Error checking token association:", error);
        // Best practice: Assume it's NOT associated or handle the error gracefully
        return false; 
    }
};

/**
 * Safely parse any numeric input into a valid Hbar instance.
 * 
 * Handles:
 * - numbers or strings
 * - commas, spaces, etc.
 * - rounding to 8 decimal places (tinybar precision)
 * - clear error messages for invalid input
 */
export function safeHbar(amount:number | string) {
  if (amount === null || amount === undefined)
    throw new Error("Amount is required.");

  // Convert to string, remove commas/spaces
  const clean = String(amount).replace(/,/g, "").trim();

  // Validate numeric
  const num = Number(clean);
  if (isNaN(num)) throw new Error(`Invalid numeric amount: "${amount}"`);

  // Clamp to 8 decimal places (tinybar precision)
  const rounded = num.toFixed(8);

  try {
    return Hbar.fromString(rounded);
  } catch (err:any) {
    throw new Error(`Invalid HBAR amount "${amount}": ${err.message}`);
  }
}