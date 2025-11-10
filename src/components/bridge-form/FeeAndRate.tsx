"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion"
import { Loader2 } from "lucide-react"
import { useBridge } from "@/providers/BridgeProvider"

type FeeAndRateProps = {
  fromPrice: number
  toPrice: number
  fee: number
}

const FeeAndRate = ({ fromPrice, toPrice, fee }: FeeAndRateProps) => {
  const { selected } = useBridge()
  const fromAmount = selected.from.amount
  const isLoading = !fromPrice || !toPrice || !fee

  // Conversion rate per token
  const conversionRate = toPrice > 0 ? fromPrice / toPrice : 0

  // Fee percentage (0-1)
  const protocolFeePct = fee > 1 ? fee / 100 : fee

  // Fee in "to" token
  const feeValueInToToken = fromAmount * conversionRate * protocolFeePct

  // Total received after fee in "to" token
  const totalAfterFee = fromAmount * conversionRate - feeValueInToToken

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="fee-and-rate">
        <AccordionTrigger className="hover:no-underline">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Fetching conversion rates...
            </div>
          ) : (
            <p className="text-xs text-zinc-600">
              1 {selected.from.token} = {conversionRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {selected.to.token}
            </p>
          )}
        </AccordionTrigger>

        <AccordionContent className="flex flex-col gap-2 bg-white rounded-2xl p-4 border border-zinc-200">
          {isLoading ? (
            <div className="flex flex-col gap-2 animate-pulse">
              <div className="h-4 bg-zinc-200 rounded w-2/3" />
              <div className="h-4 bg-zinc-200 rounded w-1/2" />
              <div className="h-4 bg-zinc-200 rounded w-3/4" />
            </div>
          ) : (
            <>
              <FeeItem
                label="Conversion Rate"
                value={`1 ${selected.from.token} = ${conversionRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${selected.to.token}`}
              />
              <FeeItem
                label="Protocol Fee"
                value={`${(protocolFeePct * 100).toFixed(2)}% (${feeValueInToToken.toFixed(6)} ${selected.to.token})`}
              />
              <FeeItem
                label="Est. Total Received"
                value={`${totalAfterFee.toFixed(6)} ${selected.to.token} (after fees)`}
              />
            </>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export default FeeAndRate

const FeeItem = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="flex justify-between items-center">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="text-sm font-medium text-zinc-800">{value}</p>
    </div>
  )
}
