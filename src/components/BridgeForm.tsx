"use client"

import { useEffect, useState } from "react"
import { ArrowUpDown, Loader2 } from "lucide-react"
import { BridgeProvider, useBridge } from "@/providers/BridgeProvider"
import BridgeAsset from "./bridge-form/BridgeAsset"
import FeeAndRate from "./bridge-form/FeeAndRate"
import BridgeAction from "./bridge-form/BridgeAction"
import BridgeContainer from "./BridgeContainer"
import { TRANSACTION_TYPE } from "@/config/bridge"
import { fetchTokenPrices } from "@/helpers"

const BridgeContent = () => {
  const { selected, setSelectedNetwork, setSelectedToken } = useBridge()

  const [isSwapping, setIsSwapping] = useState(false)
  const [rotated, setRotated] = useState(false)
  const [isPriceLoading, setIsPriceLoading] = useState(true)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [protocolFee, setProtocolFee] = useState<number>(0)


    async function fetchFees() {
    try {
      const res = await fetch("/api/fee")
      const data = await res.json()
      return data.data.fee_pct ?? 0
    } catch (err) {
      console.error("Error fetching fees:", err)
    }
  }

  useEffect(() => {
    const loadPrices = async () => {
      setIsPriceLoading(true)
      try {
        const fetchedPrices = await fetchTokenPrices()
        const fee = await fetchFees?.() // optional if you have a fee endpoint
        setPrices(fetchedPrices)
        if (fee) setProtocolFee(fee)
      } catch (error) {
        console.error("❌ Failed to fetch token prices:", error)
      } finally {
        setIsPriceLoading(false)
      }
    }

    loadPrices()
  }, [])

  // 🔁 Swap handler
  const handleSwap = () => {
    setIsSwapping(true)
    setRotated((prev) => !prev)

    const fromCopy = { ...selected.from }
    const toCopy = { ...selected.to }

    setSelectedNetwork(TRANSACTION_TYPE.FROM, toCopy.network)
    setSelectedToken(TRANSACTION_TYPE.FROM, toCopy.token)

    setSelectedNetwork(TRANSACTION_TYPE.TO, fromCopy.network)
    setSelectedToken(TRANSACTION_TYPE.TO, fromCopy.token)

    setTimeout(() => setIsSwapping(false), 400)
  }

  // 🎛️ Price info
  const fromSymbol = selected.from.token
  const toSymbol = selected.to.token
  const fromPrice = prices[fromSymbol] ?? 0
  const toPrice = prices[toSymbol] ?? 0


  useEffect(()=>{
    console.log("fromSymbol:", fromSymbol, "toSymbol:", toSymbol)
    console.log("From Price:", fromPrice, "To Price:", toPrice)
    console.log("protocal fee ", protocolFee)
  }, [prices, protocolFee])


  return (
    <div className="flex flex-col gap-4">
      {/* Loader state */}
      {isPriceLoading ? (
        <div className="flex flex-col items-center justify-center py-10 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <p className="text-sm">Fetching bridge parameters...</p>
        </div>
      ) : (
        <>
          {/* FROM asset */}
          <BridgeAsset type={TRANSACTION_TYPE.FROM} fromPrice={fromPrice} toPrice={toPrice}/>

          {/* Switch direction Button */}
          <div className="flex justify-center">
            <button
              onClick={handleSwap}
              disabled={isSwapping}
              className="p-2 rounded-full bg-white border border-zinc-200 hover:bg-zinc-100 transition-all duration-200"
            >
              <ArrowUpDown
                className={`h-5 w-5 text-zinc-600 transform transition-transform duration-300 ease-in-out ${
                  rotated ? "rotate-180" : "rotate-0"
                }`}
              />
            </button>
          </div>

          {/* TO asset */}
          <BridgeAsset type={TRANSACTION_TYPE.TO} fromPrice={fromPrice} toPrice={toPrice}/>

          {/* Fee & Rate */}
          <FeeAndRate fromPrice={fromPrice} toPrice={toPrice} fee={protocolFee} />

          {/* Bridge Action */}
          <BridgeAction />
        </>
      )}
    </div>
  )
}

const BridgeForm = () => {
  return (
    <BridgeProvider>
      <div className="max-w-md mx-auto flex flex-col gap-4 w-full">
        <BridgeContainer>
          <BridgeContent />
        </BridgeContainer>
      </div>
    </BridgeProvider>
  )
}

export default BridgeForm
