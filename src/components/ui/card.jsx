"use client"

import { cn } from "@/lib/utils"

export const Card = ({ children, className = "" }) => (
  <div className={cn("rounded-xl p-4 ", className)}>{children}</div>
)

export const CardHeader = ({ children, className = "" }) => (
  <div className={cn("mb-4 border-b border-zinc-300 pb-2", className)}>{children}</div>
)

export const CardTitle = ({ children, className = "" }) => (
  <h2 className={cn("text-lg font-semibold text-zinc-800", className)}>{children}</h2>
)

export const CardContent = ({ children, className = "" }) => (
  <div className={className}>{children}</div>
)

export const CardFooter = ({ children, className = "" }) => (
  <div className={cn("mt-4 border-t border-zinc-300 pt-2 text-sm text-zinc-460 ", className)}>
    {children}
  </div>
)
