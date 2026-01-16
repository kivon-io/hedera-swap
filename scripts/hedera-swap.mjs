// hedera-swap.mjs
// Usage: node hedera-swap.mjs
//
// Outputs (all under ./output):
// - hedera-swap-volume-by-token.csv     (raw + human)
// - hedera-swap-unique-wallets-hashed.csv
// - hedera-swap-events.csv              (per-event with hashscan_url)
// - hedera-swap-summary.json
//
// Counts "bridged volume" as sum of BridgeDeposit events emitted by the Hedera contract.

import crypto from "crypto"
import fs from "fs"
import { fileURLToPath } from "url"
import { decodeEventLog, formatUnits, keccak256, toHex } from "viem"

const MIRROR_BASE = "https://mainnet-public.mirrornode.hedera.com"
const CONTRACT_ID = "0.0.10115692"
const START = "1766016000.000000000" // 18 Dec 2025 00:00:00 UTC

const PAGE_LIMIT = 100
const PAGE_DELAY_MS = 800
const MAX_RETRIES = 8

// Extra calls to resolve timestamp -> transaction_id (rate-limit safe)
const TX_LOOKUP_DELAY_MS = 120 // small pacing
const TX_LOOKUP_MAX_RETRIES = 8

const OUT_DIR = fileURLToPath(new URL("./output", import.meta.url))

const HEDERA_TOKEN_DECIMALS = {
  "0x0000000000000000000000000000000000000000": { symbol: "HBAR", decimals: 8 }, // native
  "0x00000000000000000000000000000000000b2ad5": { symbol: "SAUCE", decimals: 6 }, // 0.0.731861
  "0x0000000000000000000000000000000000492a28": { symbol: "PACK", decimals: 6 }, // 0.0.4794920
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function ensureDir(path) {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex")
}

function normalizeAddress(addr) {
  return String(addr).toLowerCase()
}

function safeBigInt(x) {
  try {
    return BigInt(x)
  } catch {
    return null
  }
}

function humanizeAmount(tokenFrom, totalRaw) {
  const meta = HEDERA_TOKEN_DECIMALS[normalizeAddress(tokenFrom)]
  if (!meta) {
    return { symbol: "UNKNOWN", decimals: null, total_human: "" }
  }
  return {
    symbol: meta.symbol,
    decimals: meta.decimals,
    total_human: formatUnits(totalRaw, meta.decimals),
  }
}

async function fetchWithRetry(url, maxRetries = MAX_RETRIES) {
  let attempt = 0
  while (true) {
    const res = await fetch(url)
    if (res.ok) return res

    if ([429, 502, 503, 504].includes(res.status) && attempt < maxRetries) {
      attempt++
      const ra = res.headers.get("retry-after")
      const retryAfterMs = ra ? Number(ra) * 1000 : 0
      const backoffMs = Math.min(30_000, 500 * 2 ** (attempt - 1))
      const jitterMs = Math.floor(Math.random() * 250)
      await sleep(Math.max(retryAfterMs, backoffMs + jitterMs))
      continue
    }

    const body = await res.text().catch(() => "")
    throw new Error(`HTTP ${res.status} on ${url}\n${body.slice(0, 300)}`)
  }
}

// BridgeDeposit event ABI (Hedera version uses int64 amount)
const eventAbi = {
  type: "event",
  name: "BridgeDeposit",
  inputs: [
    { name: "nonce", type: "string", indexed: true },
    { name: "from", type: "address", indexed: true },
    { name: "tokenFrom", type: "address", indexed: true },
    { name: "amount", type: "int64", indexed: false },
    { name: "to", type: "address", indexed: false },
    { name: "tokenTo", type: "address", indexed: false },
    { name: "poolAddress", type: "address", indexed: false },
    { name: "desChain", type: "uint64", indexed: false },
  ],
}

const topic0 = keccak256(
  toHex("BridgeDeposit(string,address,address,int64,address,address,address,uint64)")
)

// --- HashScan helpers ---
// Cache: consensusTimestamp -> transaction_id
const txIdCache = new Map()

async function resolveTransactionId(consensusTimestamp) {
  const ts = String(consensusTimestamp || "").trim()
  if (!ts) return ""

  if (txIdCache.has(ts)) return txIdCache.get(ts)

  // Mirror node: find transaction(s) exactly at this consensus timestamp
  const url = `${MIRROR_BASE}/api/v1/transactions?timestamp=${encodeURIComponent(
    ts
  )}&limit=1&order=asc`

  // Small pacing to avoid rate limits
  await sleep(TX_LOOKUP_DELAY_MS)

  try {
    const res = await fetchWithRetry(url, TX_LOOKUP_MAX_RETRIES)
    const data = await res.json()
    const tx = (data.transactions && data.transactions[0]) || null
    const txId = tx?.transaction_id || ""
    txIdCache.set(ts, txId)
    return txId
  } catch {
    txIdCache.set(ts, "")
    return ""
  }
}

function hashscanUrlFromTransactionId(txId) {
  // txId already looks like: "0.0.xxxxxx@seconds.nanos"
  return txId ? `https://hashscan.io/mainnet/transaction/${txId}` : ""
}

function hashscanSearchUrl(consensusTimestamp) {
  // fallback if txId cannot be resolved
  const ts = String(consensusTimestamp || "").trim()
  return ts ? `https://hashscan.io/mainnet/search?query=${encodeURIComponent(ts)}` : ""
}

async function main() {
  ensureDir(OUT_DIR)

  let url =
    `${MIRROR_BASE}/api/v1/contracts/${CONTRACT_ID}/results/logs` +
    `?limit=${PAGE_LIMIT}&order=asc&timestamp=gte:${encodeURIComponent(START)}`

  const totalsByTokenFrom = new Map()
  const uniqueFrom = new Set()

  const eventRows = []

  let pagesFetched = 0
  let logsSeen = 0
  let eventsDecoded = 0

  while (url) {
    const res = await fetchWithRetry(url)
    const data = await res.json()

    const logs = data.logs || []
    logsSeen += logs.length

    for (const log of logs) {
      const topics = log.topics || []
      if (!topics.length) continue
      if (normalizeAddress(topics[0]) !== normalizeAddress(topic0)) continue

      try {
        const decoded = decodeEventLog({
          abi: [eventAbi],
          topics,
          data: log.data,
        })

        const args = decoded.args

        const from = normalizeAddress(args.from)
        const tokenFrom = normalizeAddress(args.tokenFrom)
        const amount = safeBigInt(args.amount)
        if (amount === null) continue

        const absAmount = amount < 0n ? -amount : amount

        uniqueFrom.add(from)
        totalsByTokenFrom.set(tokenFrom, (totalsByTokenFrom.get(tokenFrom) || 0n) + absAmount)
        eventsDecoded += 1

        // Build explorer url for this event
        // Mirror log usually contains `timestamp` (consensus timestamp)
        const consensusTs = log.timestamp || log.consensus_timestamp || ""
        const txId = await resolveTransactionId(consensusTs)
        const explorerUrl = txId
          ? hashscanUrlFromTransactionId(txId)
          : hashscanSearchUrl(consensusTs)

        const meta = humanizeAmount(tokenFrom, absAmount)

        eventRows.push({
          explorer_url: explorerUrl,
          transaction_id: txId,
          consensus_timestamp: consensusTs,
          from,
          tokenFrom,
          symbol: meta.symbol,
          decimals: meta.decimals ?? "",
          amount_raw: absAmount.toString(),
          amount_human: meta.total_human,
        })
      } catch {
        // ignore
      }
    }

    pagesFetched += 1
    const next = data.links?.next
    url = next ? (next.startsWith("http") ? next : `${MIRROR_BASE}${next}`) : null
    if (url) await sleep(PAGE_DELAY_MS)
  }

  // Totals rows
  const rows = []
  for (const [tokenFrom, totalRaw] of totalsByTokenFrom.entries()) {
    const meta = humanizeAmount(tokenFrom, totalRaw)
    rows.push({
      tokenFrom,
      symbol: meta.symbol,
      decimals: meta.decimals,
      total_raw: totalRaw.toString(),
      total_human: meta.total_human,
    })
  }
  rows.sort((a, b) => (a.symbol || "").localeCompare(b.symbol || ""))

  // Totals CSV
  const volLines = ["tokenFrom,symbol,decimals,total_raw,total_human"]
  for (const r of rows) {
    volLines.push(`${r.tokenFrom},${r.symbol},${r.decimals ?? ""},${r.total_raw},${r.total_human}`)
  }
  const totalsCsv = `${OUT_DIR}/hedera-bridge-volume-by-token.csv`
  fs.writeFileSync(totalsCsv, volLines.join("\n") + "\n", "utf8")

  // Unique wallets hashed
  const uniqLines = ["hashed_wallet"]
  for (const a of uniqueFrom) uniqLines.push(sha256Hex(a))
  const uniqCsv = `${OUT_DIR}/hedera-unique-wallets-hashed.csv`
  fs.writeFileSync(uniqCsv, uniqLines.join("\n") + "\n", "utf8")

  // Events CSV (clickable explorer_url)
  const eventsHeader =
    "explorer_url,transaction_id,consensus_timestamp,from,tokenFrom,symbol,decimals,amount_raw,amount_human"
  const eventsLines = [
    eventsHeader,
    ...eventRows.map(
      (r) =>
        `${r.explorer_url},${r.transaction_id},${r.consensus_timestamp},${r.from},${r.tokenFrom},${r.symbol},${r.decimals},${r.amount_raw},${r.amount_human}`
    ),
  ]
  const eventsCsv = `${OUT_DIR}/hedera-bridge-events.csv`
  fs.writeFileSync(eventsCsv, eventsLines.join("\n") + "\n", "utf8")

  const summary = {
    contract_id: CONTRACT_ID,
    milestone_start: START,
    endpoint_used: `${MIRROR_BASE}/api/v1/contracts/${CONTRACT_ID}/results/logs?timestamp=gte:${START}&limit=${PAGE_LIMIT}&order=asc`,
    tx_lookup_endpoint_used: `${MIRROR_BASE}/api/v1/transactions?timestamp=<consensus_timestamp>&limit=1&order=asc`,
    explorer: "HashScan (mainnet)",
    pagesFetched,
    logsSeen,
    eventsDecoded,
    unique_wallets: uniqueFrom.size,

    volume_by_token: rows.map((r) => ({
      tokenFrom: r.tokenFrom,
      symbol: r.symbol,
      decimals: r.decimals,
      total_raw: r.total_raw,
      total_human: r.total_human,
    })),

    note: "Hedera bridged volume computed as sum of BridgeDeposit event amounts emitted by the Hedera bridge contract, grouped by tokenFrom. events_csv includes per-event rows with HashScan explorer_url for verification.",
    events_sample: eventRows.slice(0, 5),
  }

  fs.writeFileSync(
    `${OUT_DIR}/hedera-volume-summary.json`,
    JSON.stringify(summary, null, 2),
    "utf8"
  )

  console.log(summary)
  console.log(`Wrote ${totalsCsv}, ${uniqCsv}, ${eventsCsv}, ${OUT_DIR}/hedera-volume-summary.json`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
