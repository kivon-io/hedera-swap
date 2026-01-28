// Usage:
//   node top-wallets.mjs ./output/bridge-events-all-usd.csv ./output/top-10-wallets.csv 10 from
//   node top-wallets.mjs ./output/bridge-events-all-usd.csv ./output/top-10-wallets.csv 10 both ./output/operational-wallets.txt
//
// where mode = "from" (depositors only) OR "both" (from + to)

import fs from "fs"
import path from "path"

const inputCsv = process.argv[2]
const outCsv = process.argv[3] || "./output/top-10-wallets.csv"
const TOP_N = Number(process.argv[4] || "10")
const mode = (process.argv[5] || "from").toLowerCase() // "from" or "both"
const operationalFile = process.argv[6] // optional: text file, one address per line

if (!inputCsv) {
  console.error(
    "Usage: node top-wallets.mjs <inputCsv> <outCsv> <topN> <mode: from|both> [operationalWallets.txt]",
  )
  process.exit(1)
}

function norm(a) {
  return String(a || "")
    .trim()
    .toLowerCase()
}

function ensureDir(p) {
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function loadOperationalSet(file) {
  const set = new Set()
  if (!file) return set
  if (!fs.existsSync(file)) return set
  const lines = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
  for (const l of lines) set.add(norm(l))
  return set
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const header = lines.shift().split(",")
  const rows = []

  for (const line of lines) {
    const parts = line.split(",")
    const obj = {}
    for (let i = 0; i < header.length; i++) obj[header[i]] = parts[i] ?? ""
    rows.push(obj)
  }
  return rows
}

const operational = loadOperationalSet(operationalFile)

const csvText = fs.readFileSync(inputCsv, "utf8")
const rows = parseCsv(csvText)

// wallet -> { usd, txSet, attribution }
const agg = new Map()

function add(wallet, txId, usdValue) {
  const w = norm(wallet)
  if (!w) return
  if (operational.has(w)) return

  const tx = String(txId || "").trim()
  const usd = Number(usdValue || 0) || 0

  if (!agg.has(w)) agg.set(w, { usd: 0, txSet: new Set(), attribution: "user" })
  const rec = agg.get(w)
  rec.usd += usd
  if (tx) rec.txSet.add(tx)
}

for (const r of rows) {
  const txId = r.tx_id
  const usdValue = r.usd_value

  if (mode === "both") {
    add(r.from, txId, usdValue)
    add(r.to, txId, usdValue)
  } else {
    // default: depositor only
    add(r.from, txId, usdValue)
  }
}

// Build ranked list
const ranked = [...agg.entries()]
  .map(([wallet, v]) => ({
    wallet,
    usd_vol: Number(v.usd.toFixed(2)),
    tx_count: v.txSet.size,
    attribution: v.attribution,
  }))
  .sort((a, b) => b.usd_vol - a.usd_vol)

// Output top N
ensureDir(outCsv)

const outLines = ["rank,wallet,usd_vol,tx_count,attribution"]
ranked.slice(0, TOP_N).forEach((r, idx) => {
  outLines.push(`${idx + 1},${r.wallet},${r.usd_vol},${r.tx_count},${r.attribution}`)
})

fs.writeFileSync(outCsv, outLines.join("\n") + "\n", "utf8")
console.log(
  `Wrote ${outCsv} (${Math.min(TOP_N, ranked.length)} rows). mode=${mode}. excluded_operational=${operational.size}`,
)
