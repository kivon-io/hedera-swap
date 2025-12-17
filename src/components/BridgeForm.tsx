"use client"

import { TRANSACTION_TYPE } from "@/config/bridge"
import { fetchTokenPrices } from "@/helpers"
import { BridgeProvider, useBridge } from "@/providers/BridgeProvider"
import { ArrowUpDown, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import BridgeAction from "./bridge-form/BridgeAction"
import BridgeAsset from "./bridge-form/BridgeAsset"
import FeeAndRate from "./bridge-form/FeeAndRate"
import BridgeContainer from "./BridgeContainer"
// import { calculateToAmount } from "./bridge-form/BridgeAsset"

const BridgeContent = () => {
  const { selected, setSelectedNetwork, setSelectedToken, setAmount } = useBridge()

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

  // 🎛️ Price info
  const fromSymbol = selected.from.token
  const toSymbol = selected.to.token
  const fromPrice = prices[fromSymbol] ?? 0
  const toPrice = prices[toSymbol] ?? 0

  const handleFlip = () => {
    setIsSwapping(true)
    setRotated((prev) => !prev)
    const fromCopy = { ...selected.from }
    const toCopy = { ...selected.to }
    // Swap networks and tokens
    setSelectedNetwork(TRANSACTION_TYPE.FROM, toCopy.network)
    setSelectedToken(TRANSACTION_TYPE.FROM, toCopy.token)

    setSelectedNetwork(TRANSACTION_TYPE.TO, fromCopy.network)
    setSelectedToken(TRANSACTION_TYPE.TO, fromCopy.token)
    setAmount(TRANSACTION_TYPE.TO, 0)
    setAmount(TRANSACTION_TYPE.FROM, 0)
    setTimeout(() => setIsSwapping(false), 400)
  }

  return (
    <div className='flex flex-col gap-4'>
      {isPriceLoading ? (
        <div className='flex flex-col items-center justify-center py-10 text-zinc-500'>
          <Loader2 className='h-6 w-6 animate-spin mb-2' />
          <p className='text-sm'>Fetching bridge parameters...</p>
        </div>
      ) : (
        <>
          <div className='flex flex-col -space-y-3'>
            <BridgeAsset type={TRANSACTION_TYPE.FROM} fromPrice={fromPrice} toPrice={toPrice} />

            <div className='flex justify-center relative z-10'>
              <button
                onClick={handleFlip}
                disabled={isSwapping}
                className='p-2 rounded-full bg-white border border-zinc-200 hover:bg-zinc-100 transition-all duration-200'
              >
                <ArrowUpDown
                  className={`h-5 w-5 text-zinc-600 transform transition-transform duration-300 ease-in-out ${
                    rotated ? "rotate-180" : "rotate-0"
                  }`}
                />
              </button>
            </div>

            <BridgeAsset type={TRANSACTION_TYPE.TO} fromPrice={fromPrice} toPrice={toPrice} />
          </div>

          <FeeAndRate fromPrice={fromPrice} toPrice={toPrice} fee={protocolFee} />

          <BridgeAction fromPrice={fromPrice} toPrice={toPrice} />
        </>
      )}
    </div>
  )
}

const BridgeForm = () => {
  return (
    <BridgeProvider>
      {/* <div className='max-w-md mx-auto flex flex-col gap-4 w-full '> */}
      <BridgeContainer>
        <BridgeContent />
      </BridgeContainer>
      {/* </div> */}
    </BridgeProvider>
  )
}

export default BridgeForm
