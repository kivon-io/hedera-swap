// evm-bridge-evm.mjs
// Usage:
//   node evm-bridge-evm.mjs 2025-12-18T00:00:00Z
//   node evm-bridge-evm.mjs 2025-12-18T00:00:00Z arbitrum,base,binance
//
// Outputs (all under ./output):
// - evm-bridge-events-evm.csv
// - evm-bridge-volume-evm.csv
// - evm-bridge-summary-evm.json

import dotenv from "dotenv"
import fs, { existsSync } from "fs"
import { fileURLToPath } from "url"
import { createPublicClient, decodeEventLog, formatUnits, http, keccak256, toHex } from "viem"
import { arbitrum, base, bsc } from "viem/chains"

// Load env from repo root regardless of where `node` is executed from.
const ENV_PATHS = [fileURLToPath(new URL("../.env", import.meta.url))]
for (const p of ENV_PATHS) {
  if (existsSync(p)) dotenv.config({ path: p })
}

const OUT_DIR = fileURLToPath(new URL("./output", import.meta.url))

// Only the active EVM networks you mentioned
const DEFAULT_CHAINS = ["arbitrum", "base", "binance"]

const CONTRACTS = {
  arbitrum: "0x119d249246160028fcCCc8C3DF4a5a3C11dc9a6B",
  base: "0xe179c49A5006EB738A242813A6C5BDe46a54Fc5C",
  binance: "0x119d249246160028fcCCc8C3DF4a5a3C11dc9a6B",
}

// Explorer bases (tx link = `${base}/tx/${hash}`)
const EXPLORER_TX_BASE = {
  arbitrum: "https://arbiscan.io/tx",
  base: "https://basescan.org/tx",
  binance: "https://bscscan.com/tx",
}

const KNOWN_DECIMALS = {
  arbitrum: {
    "0x0000000000000000000000000000000000000000": { symbol: "ETH", decimals: 18 },
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831": { symbol: "USDC", decimals: 6 },
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": { symbol: "USDT", decimals: 6 },
    "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f": { symbol: "WBTC", decimals: 8 },
  },
  base: {
    "0x0000000000000000000000000000000000000000": { symbol: "ETH", decimals: 18 },
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { symbol: "USDC", decimals: 6 },
    "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": { symbol: "USDT", decimals: 6 },
    "0x0555e30da8f98308edb960aa94c0db47230d2b9c": { symbol: "WBTC", decimals: 8 },
  },
  binance: {
    "0x0000000000000000000000000000000000000000": { symbol: "BNB", decimals: 18 },
    "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": { symbol: "USDC", decimals: 18 },
    "0x55d398326f99059ff775485246999027b3197955": { symbol: "USDT", decimals: 18 },
    "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c": { symbol: "BTCB", decimals: 18 },
  },
}

const BridgeDepositEvent = {
  type: "event",
  name: "BridgeDeposit",
  inputs: [
    { name: "nonce", type: "string", indexed: true },
    { name: "from", type: "address", indexed: true },
    { name: "tokenFrom", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
    { name: "to", type: "address", indexed: false },
    { name: "tokenTo", type: "address", indexed: false },
    { name: "poolAddress", type: "address", indexed: false },
    { name: "desChain", type: "uint64", indexed: false },
  ],
}

const topic0 = keccak256(
  toHex("BridgeDeposit(string,address,address,uint256,address,address,address,uint64)"),
)

const normAddr = (a) => String(a ?? "").toLowerCase()

function ensureDir(path) {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
}

function csvEscape(v) {
  const s = String(v ?? "")
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function explorerUrl(chainKey, txHash) {
  const base = EXPLORER_TX_BASE[chainKey]
  if (!base || !txHash) return ""
  return `${base}/${txHash}`
}

function chainClient(chainKey) {
  const key = process.env.ALCHEMY_KEY
  if (!key) throw new Error("Missing env var ALCHEMY_KEY")

  if (chainKey === "arbitrum") {
    return createPublicClient({
      chain: arbitrum,
      transport: http(`https://arb-mainnet.g.alchemy.com/v2/${key}`),
    })
  }
  if (chainKey === "base") {
    return createPublicClient({
      chain: base,
      transport: http(`https://base-mainnet.g.alchemy.com/v2/${key}`),
    })
  }
  if (chainKey === "binance") {
    return createPublicClient({
      chain: bsc,
      transport: http(`https://bnb-mainnet.g.alchemy.com/v2/${key}`),
    })
  }
  throw new Error(`Unknown chainKey ${chainKey}`)
}

const blockTimeCache = new Map()

async function getBlockTime(client, blockNumber) {
  const k = blockNumber.toString()
  if (blockTimeCache.has(k)) return blockTimeCache.get(k)

  const b = await client.getBlock({ blockNumber })
  const tsSec = Number(b.timestamp)
  const iso = new Date(tsSec * 1000).toISOString()
  const v = { tsSec, iso }
  blockTimeCache.set(k, v)
  return v
}

async function getBlockAtOrAfter(client, targetIso) {
  const targetMs = new Date(targetIso).getTime()
  if (Number.isNaN(targetMs)) throw new Error(`Invalid ISO date: ${targetIso}`)

  const latestBlock = await client.getBlock({ blockTag: "latest" })
  let lo = 1n
  let hi = latestBlock.number

  while (lo < hi) {
    const mid = (lo + hi) / 2n
    const b = await client.getBlock({ blockNumber: mid })
    const tsMs = Number(b.timestamp) * 1000
    if (tsMs >= targetMs) hi = mid
    else lo = mid + 1n
  }
  return lo
}

async function fetchLogsInRanges({ client, address, fromBlock, toBlock, chunkSize }) {
  const CHUNK = chunkSize
  let start = fromBlock
  const out = []

  while (start <= toBlock) {
    const end = start + CHUNK - 1n <= toBlock ? start + CHUNK - 1n : toBlock
    const logs = await client.getLogs({
      address,
      fromBlock: start,
      toBlock: end,
      topics: [topic0],
    })
    out.push(...logs)
    start = end + 1n
  }

  return out
}

async function main() {
  ensureDir(OUT_DIR)

  const startIso = process.argv[2] || "2025-12-18T00:00:00Z"
  const chainsArg = process.argv[3] // optional: "arbitrum,base,binance"
  const chains = chainsArg
    ? chainsArg
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_CHAINS

  for (const c of chains) {
    if (!CONTRACTS[c]) {
      console.error(`Unknown chain "${c}". Allowed: ${Object.keys(CONTRACTS).join(", ")}`)
      process.exit(1)
    }
  }

  // Combined outputs
  const allEventRows = []
  const totalsByChainToken = new Map() // key = `${chain}|${tokenFrom}` -> BigInt

  const summary = {
    startIso,
    chains: {},
    output_files: {
      events_csv: "evm-bridge-events-evm.csv",
      totals_csv: "evm-bridge-volume-evm.csv",
      summary_json: "evm-bridge-summary-evm.json",
    },
    note: "EVM volume computed from on-chain BridgeDeposit logs on Arbitrum/Base/BSC since startIso. events_csv is event-level with explorer links; totals_csv aggregates by chain+tokenFrom.",
  }

  for (const chainKey of chains) {
    const contract = CONTRACTS[chainKey]
    const client = chainClient(chainKey)

    const latest = await client.getBlock({ blockTag: "latest" })
    const fromBlock = await getBlockAtOrAfter(client, startIso)
    const toBlock = latest.number

    const chunkSize = chainKey === "binance" ? 10_000n : 25_000n
    const logs = await fetchLogsInRanges({
      client,
      address: contract,
      fromBlock,
      toBlock,
      chunkSize,
    })

    const known = KNOWN_DECIMALS[chainKey] || {}
    let decoded = 0

    for (const log of logs) {
      try {
        const ev = decodeEventLog({
          abi: [BridgeDepositEvent],
          topics: log.topics,
          data: log.data,
        })

        const depositor = normAddr(ev.args.from)
        const tokenFrom = normAddr(ev.args.tokenFrom)
        const to = normAddr(ev.args.to)
        const tokenTo = normAddr(ev.args.tokenTo)
        const poolAddress = normAddr(ev.args.poolAddress)
        const desChain = ev.args.desChain != null ? String(ev.args.desChain) : ""
        const nonce = ev.args.nonce != null ? String(ev.args.nonce) : ""

        const amount = BigInt(ev.args.amount)

        const meta = known[tokenFrom]
        const symbol = meta?.symbol || "UNKNOWN"
        const decimals = meta?.decimals ?? null
        const amountHuman = decimals != null ? formatUnits(amount, decimals) : ""

        const txHash = log.transactionHash ? String(log.transactionHash) : ""

        const bn = log.blockNumber
        const { tsSec, iso } = bn ? await getBlockTime(client, bn) : { tsSec: "", iso: "" }

        const row = {
          chain: chainKey,
          bridge_contract: contract,
          explorer_url: explorerUrl(chainKey, txHash),
          tx_hash: txHash,
          block_number: log.blockNumber != null ? String(log.blockNumber) : "",
          block_timestamp: tsSec === "" ? "" : String(tsSec),
          block_time_iso: iso || "",
          log_index: log.logIndex != null ? String(log.logIndex) : "",
          depositor,
          to,
          poolAddress,
          tokenFrom,
          tokenTo,
          desChain,
          nonce,
          symbol,
          decimals: decimals == null ? "" : String(decimals),
          amount_raw: amount.toString(),
          amount_human: amountHuman,
        }

        allEventRows.push(row)

        // totals key
        const k = `${chainKey}|${tokenFrom}`
        totalsByChainToken.set(k, (totalsByChainToken.get(k) || 0n) + amount)

        decoded++
      } catch {
        // ignore
      }
    }

    summary.chains[chainKey] = {
      bridge_contract: contract,
      fromBlock: fromBlock.toString(),
      toBlock: toBlock.toString(),
      logsFetched: logs.length,
      eventsDecoded: decoded,
      explorer_tx_base: EXPLORER_TX_BASE[chainKey],
    }
  }

  // Sort events for readability (chain then block then log index)
  allEventRows.sort((a, b) => {
    if (a.chain !== b.chain) return a.chain.localeCompare(b.chain)
    const ab = BigInt(a.block_number || "0")
    const bb = BigInt(b.block_number || "0")
    if (ab !== bb) return ab < bb ? -1 : 1
    const ai = Number(a.log_index || 0)
    const bi = Number(b.log_index || 0)
    return ai - bi
  })

  // Write combined events CSV
  const eventsHeader =
    "chain,bridge_contract,explorer_url,tx_hash,block_number,block_timestamp,block_time_iso,log_index,depositor,to,poolAddress,tokenFrom,tokenTo,desChain,nonce,symbol,decimals,amount_raw,amount_human"
  const eventsLines = [eventsHeader]
  for (const r of allEventRows) {
    eventsLines.push(
      [
        r.chain,
        r.bridge_contract,
        r.explorer_url,
        r.tx_hash,
        r.block_number,
        r.block_timestamp,
        r.block_time_iso,
        r.log_index,
        r.depositor,
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
  fs.writeFileSync(`${OUT_DIR}/evm-bridge-events-evm.csv`, eventsLines.join("\n") + "\n", "utf8")

  // Build + write combined totals CSV (by chain + tokenFrom)
  const totalsHeader = "chain,bridge_contract,tokenFrom,symbol,decimals,total_raw,total_human"
  const totalsRows = []

  for (const [k, totalRaw] of totalsByChainToken.entries()) {
    const [chainKey, tokenFrom] = k.split("|")
    const contract = CONTRACTS[chainKey]
    const known = KNOWN_DECIMALS[chainKey] || {}
    const meta = known[tokenFrom]
    const symbol = meta?.symbol || "UNKNOWN"
    const decimals = meta?.decimals ?? null
    const totalHuman = decimals != null ? formatUnits(totalRaw, decimals) : ""

    totalsRows.push({
      chain: chainKey,
      bridge_contract: contract,
      tokenFrom,
      symbol,
      decimals: decimals == null ? "" : String(decimals),
      total_raw: totalRaw.toString(),
      total_human: totalHuman,
    })
  }

  totalsRows.sort((a, b) => {
    if (a.chain !== b.chain) return a.chain.localeCompare(b.chain)
    if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol)
    return a.tokenFrom.localeCompare(b.tokenFrom)
  })

  const totalsLines = [totalsHeader]
  for (const r of totalsRows) {
    totalsLines.push(
      [r.chain, r.bridge_contract, r.tokenFrom, r.symbol, r.decimals, r.total_raw, r.total_human]
        .map(csvEscape)
        .join(","),
    )
  }
  fs.writeFileSync(`${OUT_DIR}/evm-bridge-volume-evm.csv`, totalsLines.join("\n") + "\n", "utf8")

  // Summary JSON includes totals + small samples
  summary.events_total = allEventRows.length
  summary.totals_rows = totalsRows.length
  summary.volume_by_chain_token = totalsRows
  summary.events_sample = allEventRows.slice(0, 5)

  fs.writeFileSync(
    `${OUT_DIR}/evm-bridge-summary-evm.json`,
    JSON.stringify(summary, null, 2),
    "utf8",
  )

  console.log(summary)
  console.log("Wrote:")
  console.log("-", `${OUT_DIR}/evm-bridge-events-evm.csv`)
  console.log("-", `${OUT_DIR}/evm-bridge-volume-evm.csv`)
  console.log("-", `${OUT_DIR}/evm-bridge-summary-evm.json`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
