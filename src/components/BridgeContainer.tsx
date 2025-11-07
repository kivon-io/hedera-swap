import React from "react"

const BridgeContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className='max-w-lg w-full mx-auto mt-10 bg-zinc-50 border border-zinc-300 text-zinc-800 p-4 rounded-2xl flex flex-col gap-4'>
      {children}
    </div>
  )
}

export default BridgeContainer
