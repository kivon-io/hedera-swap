export const TRANSACTION_TYPE = {
  FROM: "from",
  TO: "to",
} as const

export type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE]

export const API_URL = "http://104.248.47.146"

export const TX_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
} as const

export type TxStatus = (typeof TX_STATUS)[keyof typeof TX_STATUS]

export const TX_MESSAGES = {
  TRANSACTION_PENDING: "Transaction pending",
  DEPOSIT_PENDING: "Deposit pending",
  DEPOSIT_SUCCESS: "Deposit successful",
  DEPOSIT_FAILED: "Deposit failed",
  WITHDRAW_PENDING: "Withdraw pending",
  WITHDRAW_SUCCESS: "Withdraw successful",
  WITHDRAW_FAILED: "Withdraw failed",
  TRANSACTION_FAILED: "Transaction failed",
  TRANSACTION_SUCCESS: "Transaction Completed",
  APPROVAL_PENDING: "Approval pending",
  APPROVAL_SUCCESS: "Approval successful",
  APPROVAL_FAILED: "Approval failed",
  TOKEN_NOT_ASSOCIATED: "Token not associated",
  TOKEN_ASSOCIATING: "Token associating",
  TOKEN_ASSOCIATED: "Token associated",
} as const

export type TxMessage = (typeof TX_MESSAGES)[keyof typeof TX_MESSAGES]
