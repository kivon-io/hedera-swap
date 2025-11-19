import React from "react"
import { CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "./ui/badge"

const BridgeContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className='max-w-lg w-full mx-auto mt-10 bg-zinc-50 border border-zinc-300 text-zinc-800  rounded-2xl flex flex-col gap-4 p-4'>
      <CardHeader>
        <CardTitle className='text-center text-xl font-semibold text-zinc-800'>
          Kivon Hedera Bridge
        </CardTitle>
      </CardHeader>
      {children}
    </div>
  )
}
export default BridgeContainer
