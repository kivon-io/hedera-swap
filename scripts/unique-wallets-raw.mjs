// unique-wallets-raw.mjs
// Usage:
//   node unique-wallets-raw.mjs 0.0.10115692
//
// Optional env vars:
//   EXCLUDE_ADDRS="0xabc...,0xdef..."    (comma-separated, lowercase or mixed case ok)
//
// Outputs (under ./output):
// - hedera_unique_wallets.csv
// - hedera_unique_wallets_summary.json

import fs from "fs"
import { fileURLToPath } from "url"

const contract = process.argv[2]
if (!contract) {
  console.error("Usage: node unique-wallets-raw.mjs <contractId>")
  process.exit(1)
}

const MIRROR_BASE = "https://mainnet-public.mirrornode.hedera.com"
const START = "1766016000.000000000" // 18 Dec 2025 00:00:00 UTC

const PAGE_LIMIT = 100
const PAGE_DELAY_MS = 800
const MAX_RETRIES = 8

const OUT_DIR = fileURLToPath(new URL("./output", import.meta.url))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function ensureDir(path) {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
}

function normAddr(a) {
  return String(a).trim().toLowerCase()
}

function parseExcludeEnv() {
  const raw = process.env.EXCLUDE_ADDRS || ""
  if (!raw.trim()) return new Set()
  return new Set(
    raw
      .split(",")
      .map((x) => normAddr(x))
      .filter(Boolean),
  )
}

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

async function main() {
  ensureDir(OUT_DIR)

  const exclude = parseExcludeEnv()

  let url =
    `${MIRROR_BASE}/api/v1/contracts/${contract}/results` +
    `?limit=${PAGE_LIMIT}&order=asc&timestamp=gte:${START}`

  const callers = new Set()
  let pagesFetched = 0
  let totalCallsSeen = 0
  let excludedHits = 0

  while (url) {
    const res = await fetchWithRetry(url)
    const data = await res.json()

    const results = data.results || []
    totalCallsSeen += results.length

    for (const r of results) {
      if (!r.from) continue
      const from = normAddr(r.from)

      if (exclude.has(from)) {
        excludedHits++
        continue
      }

      callers.add(from)
    }

    pagesFetched++
    const next = data.links?.next
    url = next ? (next.startsWith("http") ? next : `${MIRROR_BASE}${next}`) : null

    if (url) await sleep(PAGE_DELAY_MS)
  }

  // Write raw address list
  const csvLines = ["wallet_address"]
  for (const addr of callers) csvLines.push(addr)

  const csvPath = `${OUT_DIR}/hedera_unique_wallets.csv`
  fs.writeFileSync(csvPath, csvLines.join("\n") + "\n", "utf8")

  // Summary + method (what Thrive wants)
  const summary = {
    contract,
    milestone_start: START,
    unique_wallets: callers.size,
    total_contract_calls_seen: totalCallsSeen,
    pagesFetched,
    excluded: {
      exclude_env_used: Boolean(process.env.EXCLUDE_ADDRS),
      excluded_wallets: Array.from(exclude),
      excluded_hits: excludedHits,
    },
    method: {
      endpoint: `${MIRROR_BASE}/api/v1/contracts/${contract}/results`,
      filter: `timestamp=gte:${START}`,
      unique_definition:
        "unique(from) from Hedera Mirror Node contract results (EVM caller address) after excluding operator wallets",
      export: "raw addresses in hedera_unique_wallets.csv",
    },
  }

  const summaryPath = `${OUT_DIR}/hedera_unique_wallets_summary.json`
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8")

  console.log(summary)
  console.log(`Wrote ${csvPath} and ${summaryPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
