"use client"

import "@rainbow-me/rainbowkit/styles.css"
import "../styles/globals.css"

import Header from "@/components/header"
import type { ReactNode } from "react"
import { Toaster } from "sonner"
import Providers from "./providers"


type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang='en'>
      <body>
        <Providers>
          <Header />
          <main className='2xl:max-w-7xl w-full mx-auto mt-10 lg:px-6'>{children}</main>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
