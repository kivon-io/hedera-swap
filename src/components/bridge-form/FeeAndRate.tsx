"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion"
import { Loader2, ArrowRightLeft } from "lucide-react"
import { useBridge } from "@/providers/BridgeProvider"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

type FeeAndRateProps = {
  fromPrice: number
  toPrice: number
  fee: number
}

const FeeAndRate = ({ fromPrice, toPrice, fee }: FeeAndRateProps) => {
  const { selected } = useBridge()
  const fromAmount = selected.from.amount
  const isLoading = !fromPrice || !toPrice || !fee

  const [open, setOpen] = useState(false)

  // Automatically open accordion when fromAmount > 0
  useEffect(() => {
    setOpen(fromAmount > 0)
  }, [fromAmount])

  // Conversion rate per token
  const conversionRate = toPrice > 0 ? fromPrice / toPrice : 0

  // Fee percentage (0-1)
  const protocolFeePct = fee > 1 ? fee / 100 : fee

  // Fee in "to" token
  const feeValueInToToken = fromAmount * conversionRate * protocolFeePct

  // Total received after fee in "to" token
  const totalAfterFee = fromAmount * conversionRate - feeValueInToToken

  return (
    <Accordion
      type="single"
      collapsible
      value={open ? "fee-and-rate" : undefined}
      onValueChange={(val) => setOpen(val === "fee-and-rate")}
      className="w-full"
    >
      <AccordionItem
        value="fee-and-rate"
        className="border-none bg-white/70 backdrop-blur-md shadow-md rounded-2xl transition-all duration-300"
      >
        <AccordionTrigger className="hover:no-underline py-4 px-5 flex items-center justify-between">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Fetching conversion rates...
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <ArrowRightLeft className="h-4 w-4 text-zinc-500" />
              1&nbsp;
              <span className="text-zinc-800 font-semibold">
                {selected.from.token}
              </span>
              &nbsp;=&nbsp;
              <span className="text-zinc-800 font-semibold">
                {conversionRate.toLocaleString(undefined, { maximumFractionDigits: 5 })}
              </span>
              &nbsp;{selected.to.token}
            </div>
          )}
        </AccordionTrigger>

        <AccordionContent className="overflow-hidden">
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-3 bg-white rounded-2xl p-5 border-t border-zinc-100"
              >
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
                      value={`1 ${selected.from.token} = ${conversionRate.toLocaleString(undefined, {
                        maximumFractionDigits: 5,
                      })} ${selected.to.token}`}
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
              </motion.div>
            )}
          </AnimatePresence>
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
      <p className="text-sm font-semibold text-zinc-900">{value}</p>
    </div>
  )
}
