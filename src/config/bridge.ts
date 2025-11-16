export const TRANSACTION_TYPE = {
  FROM: "from",
  TO: "to",
} as const

export type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE]

export const API_URL = "http://127.0.0.1:8000";
