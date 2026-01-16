import crypto from "crypto"
import fs from "fs"

const contract = process.argv[2]
if (!contract) {
  console.error("Usage: node unique-wallets.mjs <contractId>")
  process.exit(1)
}

const MIRROR_BASE = "https://mainnet-public.mirrornode.hedera.com"
const START = "1766016000.000000000" // 18 Dec 2025 00:00:00 UTC

const PAGE_LIMIT = 100
const PAGE_DELAY_MS = 800
const MAX_RETRIES = 8

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchWithRetry(url) {
  let attempt = 0
  while (true) {
    const res = await fetch(url)
    if (res.ok) return res

    if ([429, 502, 503, 504].includes(res.status) && attempt < MAX_RETRIES) {
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

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex")
}

let url =
  `${MIRROR_BASE}/api/v1/contracts/${contract}/results` +
  `?limit=${PAGE_LIMIT}&order=asc&timestamp=gte:${START}`

const callers = new Set()
let pagesFetched = 0
let totalCallsSeen = 0

while (url) {
  const res = await fetchWithRetry(url)
  const data = await res.json()

  const results = data.results || []
  totalCallsSeen += results.length

  for (const r of results) {
    if (r.from) callers.add(String(r.from).toLowerCase())
  }

  pagesFetched++
  const next = data.links?.next
  url = next ? (next.startsWith("http") ? next : `${MIRROR_BASE}${next}`) : null

  if (url) await sleep(PAGE_DELAY_MS)
}

// Write hashed list
const rows = ["hashed_wallet"]
for (const addr of callers) rows.push(sha256Hex(addr))
fs.writeFileSync("output/unique_wallets_hashed.csv", rows.join("\n"), "utf8")

// Write summary + method
const summary = {
  contract,
  milestone_start: START,
  unique_wallets: callers.size,
  total_contract_calls_seen: totalCallsSeen,
  pagesFetched,
  method: {
    endpoint: `/api/v1/contracts/${contract}/results`,
    filter: `timestamp=gte:${START}`,
    unique_definition: "unique(from) where from is the EVM caller address in contract results",
    export: "sha256(from) list in unique_wallets_hashed.csv",
  },
}

fs.writeFileSync("output/summary.json", JSON.stringify(summary, null, 2), "utf8")

console.log(summary)
console.log("Wrote output/unique_wallets_hashed.csv and output/summary.json")
