"use client"

import "@rainbow-me/rainbowkit/styles.css"
import "../styles/globals.css"

import Header from "@/components/header"
import type { ReactNode } from "react"
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
          <main className='max-w-4xl mx-auto mt-10 lg:px-6'>{children}</main>
        </Providers>
      </body>
    </html>
  )
}
