
import { useMemo } from "react";
import { erc20Abi, formatUnits } from "viem";
import {type NetworkOption } from "@/config/networks";
import { useReadContract, useBalance } from "wagmi"

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