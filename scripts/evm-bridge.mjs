// Usage:
//   node evm-bridge.mjs arbitrum 2025-12-18T00:00:00Z
//   node evm-bridge.mjs ethereum 2025-12-18T00:00:00Z
//   node evm-bridge.mjs base 2025-12-18T00:00:00Z
//   node evm-bridge.mjs optimism 2025-12-18T00:00:00Z
//   node evm-bridge.mjs binance 2025-12-18T00:00:00Z

import dotenv from "dotenv"
import fs, { existsSync } from "fs"
import { fileURLToPath } from "url"
import { createPublicClient, decodeEventLog, formatUnits, http, keccak256, toHex } from "viem"
import { arbitrum, base, bsc, mainnet, optimism } from "viem/chains"

// Load env from repo root regardless of where `node` is executed from.
const ENV_PATHS = [fileURLToPath(new URL("../.env", import.meta.url))]
for (const p of ENV_PATHS) {
  if (existsSync(p)) dotenv.config({ path: p })
}

const OUT_DIR = fileURLToPath(new URL("./output", import.meta.url))

const CONTRACTS = {
  ethereum: "0xe179c49A5006EB738A242813A6C5BDe46a54Fc5C",
  arbitrum: "0x119d249246160028fcCCc8C3DF4a5a3C11dc9a6B",
  base: "0xe179c49A5006EB738A242813A6C5BDe46a54Fc5C",
  optimism: "0x119d249246160028fcCCc8C3DF4a5a3C11dc9a6B",
  binance: "0x119d249246160028fcCCc8C3DF4a5a3C11dc9a6B",
}

// Explorer bases (tx link = `${base}/tx/${hash}`)
const EXPLORER_TX_BASE = {
  ethereum: "https://etherscan.io/tx",
  arbitrum: "https://arbiscan.io/tx",
  base: "https://basescan.org/tx",
  optimism: "https://optimistic.etherscan.io/tx",
  binance: "https://bscscan.com/tx",
}

const KNOWN_DECIMALS = {
  ethereum: {
    "0x0000000000000000000000000000000000000000": { symbol: "ETH", decimals: 18 },
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", decimals: 6 },
    "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", decimals: 6 },
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": { symbol: "WBTC", decimals: 8 },
  },
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
  optimism: {
    "0x0000000000000000000000000000000000000000": { symbol: "ETH", decimals: 18 },
    "0x0b2c639c533813f4aa9d7837caf62653d097ff85": { symbol: "USDC", decimals: 6 },
    "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": { symbol: "USDT", decimals: 6 },
    "0x68f180fcce6836688e9084f035309e29bf0a2095": { symbol: "WBTC", decimals: 8 },
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
  toHex("BridgeDeposit(string,address,address,uint256,address,address,address,uint64)")
)

const normAddr = (a) => String(a).toLowerCase()

function ensureDir(path) {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
}

function explorerUrl(chainKey, txHash) {
  const base = EXPLORER_TX_BASE[chainKey]
  if (!base || !txHash) return ""
  return `${base}/${txHash}`
}

function chainClient(chainKey) {
  const key = process.env.ALCHEMY_KEY
  if (!key) throw new Error("Missing env var ALCHEMY_KEY")

  if (chainKey === "ethereum") {
    return createPublicClient({
      chain: mainnet,
      transport: http(`https://eth-mainnet.g.alchemy.com/v2/${key}`),
    })
  }
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
  if (chainKey === "optimism") {
    return createPublicClient({
      chain: optimism,
      transport: http(`https://opt-mainnet.g.alchemy.com/v2/${key}`),
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

  const chainKey = process.argv[2]
  const startIso = process.argv[3] || "2025-12-18T00:00:00Z"

  if (!chainKey || !CONTRACTS[chainKey]) {
    console.error(`Usage: node evm-bridge.mjs <chain> <startIso>`)
    console.error(`Chains: ${Object.keys(CONTRACTS).join(", ")}`)
    process.exit(1)
  }

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

  const totals = new Map() // tokenFrom -> BigInt
  const known = KNOWN_DECIMALS[chainKey] || {}

  let decoded = 0
  const eventRows = []

  for (const log of logs) {
    try {
      const ev = decodeEventLog({
        abi: [BridgeDepositEvent],
        topics: log.topics,
        data: log.data,
      })

      const tokenFrom = normAddr(ev.args.tokenFrom)
      const amount = BigInt(ev.args.amount)

      totals.set(tokenFrom, (totals.get(tokenFrom) || 0n) + amount)
      decoded++

      const meta = known[tokenFrom]
      const symbol = meta?.symbol || "UNKNOWN"
      const decimals = meta?.decimals ?? null
      const amountHuman = decimals != null ? formatUnits(amount, decimals) : ""

      const txHash = log.transactionHash ? String(log.transactionHash) : ""
      eventRows.push({
        explorer_url: explorerUrl(chainKey, txHash),
        tx_hash: txHash,
        block_number: log.blockNumber != null ? String(log.blockNumber) : "",
        log_index: log.logIndex != null ? String(log.logIndex) : "",
        depositor: normAddr(ev.args.from),
        tokenFrom,
        symbol,
        decimals: decimals == null ? "" : String(decimals),
        amount_raw: amount.toString(),
        amount_human: amountHuman,
      })
    } catch {
      // ignore
    }
  }

  // Build totals rows
  const rows = []
  for (const [tokenFrom, totalRaw] of totals.entries()) {
    const meta = known[tokenFrom]
    const symbol = meta?.symbol || "UNKNOWN"
    const decimals = meta?.decimals ?? null
    const totalHuman = decimals != null ? formatUnits(totalRaw, decimals) : ""

    rows.push({
      tokenFrom,
      symbol,
      decimals,
      total_raw: totalRaw.toString(),
      total_human: totalHuman,
    })
  }

  rows.sort((a, b) => {
    if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol)
    return a.tokenFrom.localeCompare(b.tokenFrom)
  })

  // Totals CSV
  const totalsCsvHeader = "chain,bridge_contract,tokenFrom,symbol,decimals,total_raw,total_human"
  const totalsCsvLines = [
    totalsCsvHeader,
    ...rows.map(
      (r) =>
        `${chainKey},${contract},${r.tokenFrom},${r.symbol},${r.decimals ?? ""},${r.total_raw},${
          r.total_human
        }`
    ),
  ]

  const totalsCsvName = `${OUT_DIR}/evm-bridge-volume-${chainKey}.csv`
  fs.writeFileSync(totalsCsvName, totalsCsvLines.join("\n") + "\n", "utf8")

  // Events CSV (clickable explorer_url)
  const eventsCsvHeader =
    "explorer_url,tx_hash,block_number,log_index,depositor,tokenFrom,symbol,decimals,amount_raw,amount_human"
  const eventsCsvLines = [
    eventsCsvHeader,
    ...eventRows.map(
      (r) =>
        `${r.explorer_url},${r.tx_hash},${r.block_number},${r.log_index},${r.depositor},${r.tokenFrom},${r.symbol},${r.decimals},${r.amount_raw},${r.amount_human}`
    ),
  ]

  const eventsCsvName = `${OUT_DIR}/evm-bridge-events-${chainKey}.csv`
  fs.writeFileSync(eventsCsvName, eventsCsvLines.join("\n") + "\n", "utf8")

  // Summary JSON (includes totals + where to find the detailed event list)
  const jsonName = `${OUT_DIR}/evm-bridge-summary-${chainKey}.json`

  const summary = {
    chain: chainKey,
    bridge_contract: contract,
    startIso,
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
    explorer_tx_base: EXPLORER_TX_BASE[chainKey] || "",
    logsFetched: logs.length,
    eventsDecoded: decoded,
    uniqueTokens: rows.length,

    volume_by_token: rows,

    note: "EVM bridged volume computed as sum of BridgeDeposit(amount) logs emitted by the bridge contract since startIso. totals_csv aggregates by token. events_csv includes per-event rows with explorer_url for verification.",
    events_sample: eventRows.slice(0, 5),
  }

  fs.writeFileSync(jsonName, JSON.stringify(summary, null, 2), "utf8")

  console.log(summary)
  console.log(`Wrote ${totalsCsvName}, ${eventsCsvName}, ${jsonName}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
