// bridge-all-events.mjs
// Usage:
//   node bridge-all-events.mjs
//   --prices ./prices.json
//   --evm ./output/evm-bridge-events-evm.csv
//   --hedera ./output/hedera-bridge-events.csv
//   --outDir ./output
//
// Notes:
// - This normalizes both EVM and Hedera CSV headers into a unified schema and computes usd_value using prices.json.

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------------- CLI ----------------
function parseArgs(argv) {
  const out = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const k = a.slice(2)
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true
      out[k] = v
    }
  }
  return out
}

const args = parseArgs(process.argv)

const PRICES_PATH = args.prices || "./prices.json"
const EVM_LIST = (args.evm || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

const HEDERA_LIST = (args.hedera || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

const OUT_DIR = args.outDir || "./output"

// ---------------- Helpers ----------------
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

function stripBOM(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

function parseCSV(text) {
  // Simple CSV parser (handles quoted fields, commas inside quotes).
  // Assumes no embedded newlines inside quoted fields (true for your generated exports).
  const lines = stripBOM(text)
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
  if (!lines.length) return { header: [], rows: [] }

  const header = parseCSVLine(lines[0]).map((h) => h.trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (!cols.length) continue
    const obj = {}
    for (let c = 0; c < header.length; c++) obj[header[c]] = cols[c] ?? ""
    rows.push(obj)
  }
  return { header, rows }
}

function parseCSVLine(line) {
  const out = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQ = !inQ
      }
    } else if (ch === "," && !inQ) {
      out.push(cur)
      cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function csvEscape(val) {
  const s = String(val ?? "")
  if (s.includes('"')) {
    const q = s.replace(/"/g, '""')
    return `"${q}"`
  }
  if (s.includes(",") || s.includes("\n") || s.includes("\r")) return `"${s}"`
  return s
}

function toNum(s) {
  if (s == null || s === "") return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function safeLower(s) {
  return String(s ?? "").toLowerCase()
}

function isoOrEmpty(s) {
  return String(s ?? "").trim()
}

function usdValueFor(symbol, amountHuman, prices) {
  const sym = String(symbol || "").trim()
  if (!sym) return { usd_price: "", usd_value: "" }
  const p = prices?.prices_usd?.[sym]
  if (p == null) return { usd_price: "", usd_value: "" }
  const amt = toNum(amountHuman)
  if (amt == null) return { usd_price: String(p), usd_value: "" }
  const v = amt * Number(p)
  // keep 2dp for USD value
  return { usd_price: String(p), usd_value: v.toFixed(2) }
}

// ---------------- Normalize schemas ----------------
function normalizeEvmRow(r) {
  return {
    chain: r.chain || "",
    bridge_contract: r.bridge_contract || "",
    explorer_url: r.explorer_url || "",
    tx_id: r.tx_hash || "",
    time_iso: r.block_time_iso || "",
    from: r.depositor || "",
    to: r.to || "",
    poolAddress: r.poolAddress || "",
    tokenFrom: r.tokenFrom || "",
    tokenTo: r.tokenTo || "",
    symbol: r.symbol || "",
    decimals: r.decimals || "",
    amount_raw: r.amount_raw || "",
    amount_human: r.amount_human || "",
    desChain: r.desChain || "",
    nonce: r.nonce || "",
    // provenance fields (optional)
    _source_kind: "evm",
  }
}

function normalizeHederaRow(r) {
  return {
    chain: r.chain || "hedera",
    bridge_contract: r.bridge_contract || "",
    explorer_url: r.explorer_url || "",
    tx_id: r.transaction_id || "",
    time_iso: r.consensus_time_iso || "",
    from: r.from || "",
    to: r.to || "",
    poolAddress: r.poolAddress || "",
    tokenFrom: r.tokenFrom || "",
    tokenTo: r.tokenTo || "",
    symbol: r.symbol || "",
    decimals: r.decimals || "",
    amount_raw: r.amount_raw || "",
    amount_human: r.amount_human || "",
    desChain: r.desChain || "",
    nonce: r.nonce || "",
    _source_kind: "hedera",
  }
}

// ---------------- Main ----------------
async function main() {
  ensureDir(OUT_DIR)

  if (!fs.existsSync(PRICES_PATH)) {
    throw new Error(`prices.json not found at: ${PRICES_PATH}`)
  }
  const prices = JSON.parse(fs.readFileSync(PRICES_PATH, "utf8"))

  const all = []

  // Load EVM CSVs
  for (const p of EVM_LIST) {
    if (!fs.existsSync(p)) throw new Error(`EVM CSV not found: ${p}`)
    const txt = fs.readFileSync(p, "utf8")
    const { rows } = parseCSV(txt)
    for (const r of rows) all.push(normalizeEvmRow(r))
  }

  // Load Hedera CSVs
  for (const p of HEDERA_LIST) {
    if (!fs.existsSync(p)) throw new Error(`Hedera CSV not found: ${p}`)
    const txt = fs.readFileSync(p, "utf8")
    const { rows } = parseCSV(txt)
    for (const r of rows) all.push(normalizeHederaRow(r))
  }

  // Basic sanity: drop empties
  const normalized = all.filter((r) => r.tx_id && r.amount_raw)

  // Sort by time (ISO), fallback chain+tx_id
  normalized.sort((a, b) => {
    const ta = Date.parse(a.time_iso || "")
    const tb = Date.parse(b.time_iso || "")
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb
    if (a.chain !== b.chain) return a.chain.localeCompare(b.chain)
    return a.tx_id.localeCompare(b.tx_id)
  })

  // Write master CSV
  const MASTER_HEADER = [
    "chain",
    "bridge_contract",
    "explorer_url",
    "tx_id",
    "time_iso",
    "from",
    "to",
    "poolAddress",
    "tokenFrom",
    "tokenTo",
    "symbol",
    "decimals",
    "amount_raw",
    "amount_human",
    "desChain",
    "nonce",
  ]

  const masterLines = [MASTER_HEADER.join(",")]
  for (const r of normalized) {
    masterLines.push(MASTER_HEADER.map((k) => csvEscape(r[k])).join(","))
  }

  const masterPath = path.join(OUT_DIR, "bridge-events-all.csv")
  fs.writeFileSync(masterPath, masterLines.join("\n") + "\n", "utf8")

  // Write USD CSV
  const USD_HEADER = [...MASTER_HEADER, "usd_price", "usd_value"]
  const usdLines = [USD_HEADER.join(",")]

  const totalsByChain = new Map()
  const totalsBySymbol = new Map()
  let totalUsd = 0

  const usdRows = normalized.map((r) => {
    const { usd_price, usd_value } = usdValueFor(r.symbol, r.amount_human, prices)

    const vNum = toNum(usd_value)
    if (vNum != null) {
      totalUsd += vNum
      totalsByChain.set(r.chain, (totalsByChain.get(r.chain) || 0) + vNum)
      totalsBySymbol.set(r.symbol, (totalsBySymbol.get(r.symbol) || 0) + vNum)
    }

    const outRow = { ...r, usd_price, usd_value }
    usdLines.push(USD_HEADER.map((k) => csvEscape(outRow[k])).join(","))
    return outRow
  })

  const usdPath = path.join(OUT_DIR, "bridge-events-all-usd.csv")
  fs.writeFileSync(usdPath, usdLines.join("\n") + "\n", "utf8")

  // Summary JSON
  const summary = {
    pricing_source: prices.pricing_source,
    pricing_timestamp_utc: prices.pricing_timestamp_utc,
    prices_usd: prices.prices_usd,
    input: {
      evm_csvs: EVM_LIST,
      hedera_csvs: HEDERA_LIST,
      prices_json: PRICES_PATH,
    },
    outputs: {
      master_csv: "bridge-events-all.csv",
      usd_csv: "bridge-events-all-usd.csv",
      summary_json: "bridge-volume-summary-usd.json",
    },
    counts: {
      events: usdRows.length,
      events_with_price: usdRows.filter((r) => r.usd_value !== "").length,
    },
    totals_usd: {
      total_usd: Number(totalUsd.toFixed(2)),
      by_chain: Object.fromEntries(
        Array.from(totalsByChain.entries()).map(([k, v]) => [k, Number(v.toFixed(2))]),
      ),
      by_symbol: Object.fromEntries(
        Array.from(totalsBySymbol.entries()).map(([k, v]) => [k, Number(v.toFixed(2))]),
      ),
    },
    note: "USD totals are computed from bridge-events-all.csv by multiplying amount_human by prices_usd[symbol] from prices.json at pricing_timestamp_utc. Events without a known price are included but contribute no USD value.",
  }

  const summaryPath = path.join(OUT_DIR, "bridge-volume-summary-usd.json")
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8")

  console.log("Wrote:")
  console.log("-", masterPath)
  console.log("-", usdPath)
  console.log("-", summaryPath)
  console.log("Total USD:", summary.totals_usd.total_usd)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
