import { useReadContract, useBalance as wUseBalance } from "wagmi";
import { formatUnits, erc20Abi } from "viem";
import { useMemo } from "react";

export function useEthBalance(address?: `0x${string}`) {
  const { data } = wUseBalance({ address, unit: "ether" });
  return data?.formatted ?? "0";
}

export function useErc20TokenBalance(tokenAddress?: `0x${string}`, walletAddress?: `0x${string}`) {
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

  return useMemo(() => {
    if (!rawBalance || decimals === undefined) return "0";
    return formatUnits(rawBalance as bigint, decimals as number);
  }, [rawBalance, decimals]);
}
