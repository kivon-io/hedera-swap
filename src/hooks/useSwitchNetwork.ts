import { useCallback } from "react"
import { useSwitchChain } from "wagmi"

export function useSwitchNetwork(chainId: number) {
  const { switchChain } = useSwitchChain()

  return useCallback(() => {
    switchChain({ chainId })
  }, [switchChain, chainId])
}
