// exclude-operational.mjs
// Usage:
//   node exclude-operational.mjs ./output/bridge-events-all-usd.csv ./output/operational-wallets.txt
//
// Outputs:
//   ./output/bridge-events-all-usd-excluding-operational.csv
//   ./output/bridge-metrics-excluding-operational.json
//
// Exclusion rule (simple + matches Thrive ask):
// - exclude any event where `from` OR `to` is in operational wallet set.
// - unique wallets = unique(from) on remaining events.

import fs from "fs"
import path from "path"

const inputCsv = process.argv[2]
const operationalFile = process.argv[3]

if (!inputCsv || !operationalFile) {
  console.error(
    "Usage: node exclude-operational.mjs <bridge-events-all-usd.csv> <operational-wallets.txt>",
  )
  process.exit(1)
}

function norm(x) {
  return String(x || "")
    .trim()
    .toLowerCase()
}

function ensureDir(p) {
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
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
  return { header, rows }
}

function toCsv(header, rows) {
  const out = [header.join(",")]
  for (const r of rows) {
    out.push(header.map((h) => r[h] ?? "").join(","))
  }
  return out.join("\n") + "\n"
}

const operational = new Set(
  fs
    .readFileSync(operationalFile, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(norm),
)

const csvText = fs.readFileSync(inputCsv, "utf8")
const { header, rows } = parseCsv(csvText)

// Metrics before
let totalUsdBefore = 0
const uniqueBefore = new Set()

for (const r of rows) {
  totalUsdBefore += Number(r.usd_value || 0) || 0
  if (r.from) uniqueBefore.add(norm(r.from))
}

// Filtered rows
const kept = []
let totalUsdAfter = 0
const uniqueAfter = new Set()
let excludedRows = 0

for (const r of rows) {
  const from = norm(r.from)
  const to = norm(r.to)

  const isOperational = operational.has(from) || operational.has(to)
  if (isOperational) {
    excludedRows++
    continue
  }

  kept.push(r)
  totalUsdAfter += Number(r.usd_value || 0) || 0
  if (from) uniqueAfter.add(from)
}

const outCsv = path.join(path.dirname(inputCsv), "bridge-events-all-usd-excluding-operational.csv")
const outJson = path.join(path.dirname(inputCsv), "bridge-metrics-excluding-operational.json")

ensureDir(outCsv)

fs.writeFileSync(outCsv, toCsv(header, kept), "utf8")

const summary = {
  input_csv: inputCsv,
  operational_wallets_file: operationalFile,
  exclusion_rule: "Excluded rows where from OR to is in operational set",
  counts: {
    events_before: rows.length,
    events_after: kept.length,
    excluded_events: excludedRows,
  },
  unique_wallets: {
    definition: "unique(from) on included rows",
    before: uniqueBefore.size,
    after: uniqueAfter.size,
  },
  usd_volume: {
    before: Number(totalUsdBefore.toFixed(2)),
    after: Number(totalUsdAfter.toFixed(2)),
  },
  operational_wallets_count: operational.size,
  operational_wallets: [...operational],
}

fs.writeFileSync(outJson, JSON.stringify(summary, null, 2), "utf8")

console.log(`Wrote: ${outCsv}`)
console.log(`Wrote: ${outJson}`)
console.log(summary)
