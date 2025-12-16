import { AccountId } from "@hashgraph/sdk"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Address } from "viem"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatAddress = (address: string) => {
  if (!address) return ""
  return address.slice(0, 6) + "..." + address.slice(-4)
}

export const formatTrxHash = (hash: string) => {
  if (!hash) return ""
  return hash.slice(0, 10) + "..." + hash.slice(-5)
}

export const normalizeAddress = (value: string | AccountId | Address | null | undefined) => {
  if (!value) return null
  if (typeof value === "string") return value
  if (typeof value === "object" && "toString" in value) {
    try {
      return (value as { toString: () => string }).toString()
    } catch {
      return null
    }
  }
  try {
    return String(value)
  } catch {
    return null
  }
}

export const randomDurationSeconds = () => Math.floor(Math.random() * 61) + 60
