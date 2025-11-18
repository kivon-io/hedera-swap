export const TRANSACTION_TYPE = {
  FROM: "from",
  TO: "to",
} as const

export type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE]

export const API_URL = process.env.API_URL
   