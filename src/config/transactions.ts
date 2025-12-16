import { CHAIN_IDS, NETWORKS_INFO, type NetworkOption } from "@/config/networks"
import { TOKENS } from "@/config/tokens"
import { getExplorerLink } from "@/helpers/token"
import { randomDurationSeconds } from "@/lib/utils"

export const TRANSACTION_API_URL = process.env.TRANSACTION_API_BASE_URL

type CurrencyRole = "from" | "to"

type CurrencyEntry = {
  chain_id: number
  chain_name: string
  chain_symbol: string
  chain_logo_uri?: string
  currency_role: CurrencyRole
  currency_address: string
  currency_symbol: string
  currency_name: string
  currency_logo_uri?: string
  decimals: number
  is_native: boolean
  amount: string
  amount_formatted: string
  amount_usd?: string
}

type FeeEntry = {
  fee_type: string
  fee_amount: string
  fee_amount_formatted: string
  fee_amount_usd?: string
  fee_currency_symbol: string
  fee_currency_address: string
  fee_currency_name: string
  fee_currency_logo_uri?: string
}

export type BridgeTransactionPayload = {
  transaction_type: "bridge"
  user_address: string
  from_amount: string
  to_amount: string
  from_amount_usd?: string
  to_amount_usd?: string
  external_transaction_id?: string | null
  sender_address?: string | null
  recipient_address?: string | null
  input_hash_explorer_url?: string | null
  output_hash_explorer_url?: string | null
  input_tx_hash?: string | null
  output_tx_hash?: string | null
  bridge_nonce?: string | null
  currencies: CurrencyEntry[]
  time_estimate?: string | null
  fees?: FeeEntry[]
  metadata?: Record<string, unknown>
  protocol?: {
    protocol_name: string
    order_id: string | null
    request_id: string | null
  }[]
}

export type BridgeTransactionBuildArgs = {
  fromNetwork: NetworkOption
  toNetwork: NetworkOption
  fromToken: string
  toToken: string
  fromAmount: number
  toAmount: number
  fromPrice?: number
  toPrice?: number
  userAddress?: string | null
  senderAddress?: string | null
  recipientAddress?: string | null
  nonce?: string | null
  feePercent?: number
  depositTxHash?: string | null
  withdrawTxHash?: string | null
}

const getNetworkMeta = (network: NetworkOption) => {
  const meta = NETWORKS_INFO.find((info) => info.name.toLowerCase() === network.toLowerCase()) as
    | (typeof NETWORKS_INFO)[number]
    | undefined

  if (meta) return meta

  return {
    id: CHAIN_IDS[network],
    name: network,
    symbol: network.toUpperCase(),
    metadata: { logoUrl: undefined },
    address: "",
    decimals: 0,
    native: true,
  }
}

const buildCurrencyEntry = (
  role: CurrencyRole,
  network: NetworkOption,
  tokenSymbol: string,
  amount: number,
  amountUsd?: number
): CurrencyEntry => {
  const networkMeta = getNetworkMeta(network)
  const tokenMeta = TOKENS[network]?.[tokenSymbol] ?? {
    symbol: tokenSymbol,
    address: "",
    decimals: 0,
    native: false,
    metadata: {},
  }

  return {
    chain_id: networkMeta.id,
    chain_name: networkMeta.name,
    chain_symbol: networkMeta.symbol,
    chain_logo_uri: networkMeta.metadata?.logoUrl,
    currency_role: role,
    currency_address: String(tokenMeta.address ?? ""),
    currency_symbol: tokenMeta.symbol ?? tokenSymbol,
    currency_name: tokenMeta.symbol ?? tokenSymbol,
    currency_logo_uri: tokenMeta.metadata?.logoUrl,
    decimals: tokenMeta.decimals ?? 0,
    is_native: Boolean(tokenMeta.native),
    amount: amount.toString(),
    amount_formatted: amount.toString(),
    amount_usd: amountUsd !== undefined ? amountUsd.toString() : undefined,
  }
}

const buildFeeEntry = (
  amount: number,
  amountUsd: number | undefined,
  network: NetworkOption,
  tokenSymbol: string
): FeeEntry => {
  const tokenMeta = TOKENS[network]?.[tokenSymbol]
  return {
    fee_type: "protocol",
    fee_amount: amount.toString(),
    fee_amount_formatted: amount.toString(),
    fee_amount_usd: amountUsd !== undefined ? amountUsd.toString() : undefined,
    fee_currency_symbol: tokenMeta?.symbol ?? tokenSymbol,
    fee_currency_address: tokenMeta?.address ? String(tokenMeta.address) : "",
    fee_currency_name: tokenMeta?.symbol ?? tokenSymbol,
    fee_currency_logo_uri: tokenMeta?.metadata?.logoUrl,
  }
}

export const buildTransactionPayload = (
  args: BridgeTransactionBuildArgs
): BridgeTransactionPayload | null => {
  const {
    userAddress,
    fromNetwork,
    toNetwork,
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    fromPrice,
    toPrice,
    nonce,
    feePercent,
    senderAddress,
    recipientAddress,
    depositTxHash,
    withdrawTxHash,
  } = args

  if (!userAddress) return null

  const fromAmountUsd = fromPrice ? Number((fromAmount * fromPrice).toFixed(6)) : undefined
  const toAmountUsd = toPrice ? Number((toAmount * toPrice).toFixed(6)) : undefined
  const feeAmount = feePercent ? fromAmount * feePercent : undefined
  const feeAmountUsd = feeAmount && fromPrice ? feeAmount * fromPrice : undefined

  const currencies: CurrencyEntry[] = [
    buildCurrencyEntry("from", fromNetwork, fromToken, fromAmount, fromAmountUsd),
    buildCurrencyEntry("to", toNetwork, toToken, toAmount, toAmountUsd),
  ]

  const fees =
    feeAmount && feePercent
      ? [buildFeeEntry(feeAmount, feeAmountUsd, fromNetwork, fromToken)]
      : undefined

  return {
    transaction_type: "bridge",
    user_address: userAddress,
    from_amount: fromAmount.toString(),
    to_amount: toAmount.toString(),
    from_amount_usd: fromAmountUsd ? fromAmountUsd.toString() : undefined,
    to_amount_usd: toAmountUsd ? toAmountUsd.toString() : undefined,
    external_transaction_id: nonce ?? undefined,
    sender_address: senderAddress ?? undefined,
    recipient_address: recipientAddress ?? undefined,
    input_hash_explorer_url: getExplorerLink(depositTxHash ?? "", fromNetwork),
    output_hash_explorer_url: getExplorerLink(withdrawTxHash ?? "", toNetwork),
    input_tx_hash: depositTxHash ?? undefined,
    output_tx_hash: withdrawTxHash ?? undefined,
    bridge_nonce: nonce ?? undefined,
    time_estimate: randomDurationSeconds().toString(),
    currencies,
    fees,
    metadata: {
      fee_percent: feePercent,
    },
    protocol: [
      {
        protocol_name: process.env.NEXT_PUBLIC_APP_NAME!,
        order_id: nonce ?? null,
        request_id: nonce ?? null,
      },
    ],
  }
}
