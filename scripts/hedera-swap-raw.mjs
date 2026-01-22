// hedera-swap-raw.mjs
// Usage: node hedera-swap-raw.mjs
//
// Outputs (all under ./output):
// - hedera-bridge-volume-by-token.csv
// - hedera-bridge-events.csv
// - hedera-unique-wallets.csv              (RAW addresses)
// - hedera-volume-summary.json
//
// What this proves (reviewer-friendly):
// - Event-level CSV of ALL BridgeDeposit logs since START, with tx link + raw addresses + route fields.
// - Volume totals by tokenFrom (raw + human).
// - Unique wallet count computed as unique(from) over BridgeDeposit events.

import fs from "fs"
import { fileURLToPath } from "url"
import { decodeEventLog, formatUnits, keccak256, toHex } from "viem"

const MIRROR_BASE = "https://mainnet-public.mirrornode.hedera.com"
const CONTRACT_ID = "0.0.10115692"
const START = "1766016000.000000000" // 18 Dec 2025 00:00:00 UTC

const PAGE_LIMIT = 100
const PAGE_DELAY_MS = 800
const MAX_RETRIES = 8

// Extra calls to resolve consensus_timestamp -> transaction_id (rate-limit safe)
const TX_LOOKUP_DELAY_MS = 120
const TX_LOOKUP_MAX_RETRIES = 8

// Where to write outputs (always under scripts/output, regardless of where you run `node` from)
const OUT_DIR = fileURLToPath(new URL("./output", import.meta.url))

// Hedera tokenFrom values appear as 0x... "solidity addresses".
const HEDERA_TOKEN_DECIMALS = {
  "0x0000000000000000000000000000000000000000": { symbol: "HBAR", decimals: 8 }, // native
  "0x00000000000000000000000000000000000b2ad5": { symbol: "SAUCE", decimals: 6 }, // 0.0.731861
  "0x0000000000000000000000000000000000492a28": { symbol: "PACK", decimals: 6 }, // 0.0.4794920
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function ensureDir(path) {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
}

function normalizeAddress(addr) {
  return String(addr ?? "").toLowerCase()
}

function safeBigInt(x) {
  try {
    return BigInt(x)
  } catch {
    return null
  }
}

function humanizeAmount(tokenFrom, raw) {
  const meta = HEDERA_TOKEN_DECIMALS[normalizeAddress(tokenFrom)]
  if (!meta) return { symbol: "UNKNOWN", decimals: null, human: "" }
  return { symbol: meta.symbol, decimals: meta.decimals, human: formatUnits(raw, meta.decimals) }
}

function csvEscape(v) {
  const s = String(v ?? "")
  // If contains comma, quote, or newline -> wrap in quotes and escape quotes
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function consensusToIso(consensusTs) {
  const s = String(consensusTs || "")
  const secStr = s.split(".")[0]
  const sec = Number(secStr)
  if (!Number.isFinite(sec)) return ""
  return new Date(sec * 1000).toISOString()
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

// topic0 = keccak256("BridgeDeposit(string,address,address,int64,address,address,address,uint64)")
const topic0 = keccak256(
  toHex("BridgeDeposit(string,address,address,int64,address,address,address,uint64)"),
)

// --- HashScan helpers ---
// Cache: consensusTimestamp -> transaction_id
const txIdCache = new Map()

async function resolveTransactionId(consensusTimestamp) {
  const ts = String(consensusTimestamp || "").trim()
  if (!ts) return ""

  if (txIdCache.has(ts)) return txIdCache.get(ts)

  const url = `${MIRROR_BASE}/api/v1/transactions?timestamp=${encodeURIComponent(ts)}&limit=1&order=asc`

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
  return txId ? `https://hashscan.io/mainnet/transaction/${txId}` : ""
}

function hashscanSearchUrl(consensusTimestamp) {
  const ts = String(consensusTimestamp || "").trim()
  return ts ? `https://hashscan.io/mainnet/search?query=${encodeURIComponent(ts)}` : ""
}

async function main() {
  ensureDir(OUT_DIR)

  let url =
    `${MIRROR_BASE}/api/v1/contracts/${CONTRACT_ID}/results/logs` +
    `?limit=${PAGE_LIMIT}&order=asc&timestamp=gte:${encodeURIComponent(START)}`

  const totalsByTokenFrom = new Map() // tokenFrom -> BigInt total (smallest units)
  const uniqueFrom = new Set() // unique depositors (raw addresses)
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
        const to = normalizeAddress(args.to)
        const tokenTo = normalizeAddress(args.tokenTo)
        const poolAddress = normalizeAddress(args.poolAddress)
        const desChain = args.desChain != null ? String(args.desChain) : ""
        const nonce = args.nonce != null ? String(args.nonce) : ""

        const amount = safeBigInt(args.amount)
        if (amount === null) continue

        // amount is int64; absolute value for volume
        const absAmount = amount < 0n ? -amount : amount

        uniqueFrom.add(from)
        totalsByTokenFrom.set(tokenFrom, (totalsByTokenFrom.get(tokenFrom) || 0n) + absAmount)
        eventsDecoded += 1

        const consensusTs = log.timestamp || log.consensus_timestamp || ""
        const txId = await resolveTransactionId(consensusTs)
        const explorerUrl = txId
          ? hashscanUrlFromTransactionId(txId)
          : hashscanSearchUrl(consensusTs)

          const meta = humanizeAmount(tokenFrom, absAmount)
          const consensusIso = consensusToIso(consensusTs)



        eventRows.push({
          chain: "hedera",
          bridge_contract: CONTRACT_ID,
          explorer_url: explorerUrl,
          transaction_id: txId,
          consensus_timestamp: consensusTs,
          consensus_time_iso: consensusIso,
          from,
          to,
          poolAddress,
          tokenFrom,
          tokenTo,
          desChain,
          nonce,
          symbol: meta.symbol,
          decimals: meta.decimals ?? "",
          amount_raw: absAmount.toString(),
          amount_human: meta.human,
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

  // -------- Totals by tokenFrom (raw + human) --------
  const totalRows = []
  for (const [tokenFrom, totalRaw] of totalsByTokenFrom.entries()) {
    const meta = humanizeAmount(tokenFrom, totalRaw)
    totalRows.push({
      tokenFrom,
      symbol: meta.symbol,
      decimals: meta.decimals,
      total_raw: totalRaw.toString(),
      total_human: meta.human,
    })
  }
  totalRows.sort((a, b) => (a.symbol || "").localeCompare(b.symbol || ""))

  const totalsCsvPath = `${OUT_DIR}/hedera-bridge-volume-by-token.csv`
  const totalsLines = ["tokenFrom,symbol,decimals,total_raw,total_human"]
  for (const r of totalRows) {
    totalsLines.push(
      `${csvEscape(r.tokenFrom)},${csvEscape(r.symbol)},${csvEscape(r.decimals ?? "")},${csvEscape(
        r.total_raw,
      )},${csvEscape(r.total_human)}`,
    )
  }
  fs.writeFileSync(totalsCsvPath, totalsLines.join("\n") + "\n", "utf8")

  // -------- Event-level CSV (what reviewers asked for) --------
  const eventsCsvPath = `${OUT_DIR}/hedera-bridge-events.csv`
  const eventsHeader =
    "chain,bridge_contract,explorer_url,transaction_id,consensus_timestamp,consensus_time_iso,from,to,poolAddress,tokenFrom,tokenTo,desChain,nonce,symbol,decimals,amount_raw,amount_human"
  const eventsLines = [eventsHeader]

  // stable ordering by timestamp (asc)
  eventRows.sort((a, b) =>
    String(a.consensus_timestamp).localeCompare(String(b.consensus_timestamp)),
  )

  for (const r of eventRows) {
    eventsLines.push(
      [
        r.chain,
        r.bridge_contract,
        r.explorer_url,
        r.transaction_id,
        r.consensus_timestamp,
        r.consensus_time_iso,
        r.from,
        r.to,
        r.poolAddress,
        r.tokenFrom,
        r.tokenTo,
        r.desChain,
        r.nonce,
        r.symbol,
        r.decimals,
        r.amount_raw,
        r.amount_human,
      ]
        .map(csvEscape)
        .join(","),
    )
  }
  fs.writeFileSync(eventsCsvPath, eventsLines.join("\n") + "\n", "utf8")

  // -------- Unique wallets (RAW addresses) --------
  const uniqueWalletsPath = `${OUT_DIR}/hedera-unique-wallets.csv`

  const uniqList = Array.from(uniqueFrom).sort()
  fs.writeFileSync(
    uniqueWalletsPath,
    ["wallet_address", ...uniqList.map(csvEscape)].join("\n") + "\n",
    "utf8",
  )

  // -------- Summary JSON (includes totals + files) --------
  const summaryPath = `${OUT_DIR}/hedera-volume-summary.json`
  const summary = {
    chain: "hedera",
    bridge_contract: CONTRACT_ID,
    milestone_start: START,
    endpoints_used: {
      logs: `${MIRROR_BASE}/api/v1/contracts/${CONTRACT_ID}/results/logs?timestamp=gte:${START}&limit=${PAGE_LIMIT}&order=asc`,
      tx_lookup: `${MIRROR_BASE}/api/v1/transactions?timestamp=<consensus_timestamp>&limit=1&order=asc`,
    },
    event_signature: "BridgeDeposit(string,address,address,int64,address,address,address,uint64)",
    explorer: "HashScan (mainnet)",
    pagesFetched,
    logsSeen,
    eventsDecoded,
    unique_wallets_definition: "unique(from) over BridgeDeposit events",
    unique_wallets: uniqList.length,
    output_files: {
      events_csv: "hedera-bridge-events.csv",
      totals_csv: "hedera-bridge-volume-by-token.csv",
      unique_wallets_csv: "hedera-unique-wallets.csv",
    },
    volume_by_token: totalRows,
    note: "This is event-level, on-chain proof: BridgeDeposit logs emitted by the Hedera bridge contract since milestone_start. events_csv includes tx explorer links and raw addresses for third-party verification. totals_csv aggregates volume by tokenFrom with human-readable amounts.",
    events_sample: eventRows.slice(0, 5),
  }

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8")

  console.log(summary)
  console.log("Wrote:")
  console.log("-", totalsCsvPath)
  console.log("-", eventsCsvPath)
  console.log("-", uniqueWalletsPath)
  console.log("-", summaryPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
