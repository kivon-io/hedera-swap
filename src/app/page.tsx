"use client"

import BridgeForm from "@/components/BridgeForm"
import { Grid } from "@/components/decorations/grid"

export default function Page() {
  return (
    <main className='flex flex-col items-center justify-center p-4 lg:p-8 space-y-8'>
      <Grid
        size={60}
        className='left-0 right-0 bottom-0 opacity-70 h-[calc(100vh-100px)] w-full top-0'
      />
      <BridgeForm />
    </main>
  )
}
