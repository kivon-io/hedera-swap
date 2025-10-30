import { ethers } from "ethers";
import path from 'path';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const RPC = process.env.HEDERA_RPC_URL;
// --- SaucerSwap UniswapV2-like testnet addresses (update if needed) ---
const ROUTER = process.env.ROUTER; // UniswapV2Router02 (testnet)
const FACTORY = process.env.FACTORY; // factory testnet (example)
const WHBAR_CONTRACT = process.env.WHBAR_CONTRACT; // WHBAR wrapper contract (testnet)
const PRIVATE_KEY = process.env.PRIVATE_KEY; 

// Replace with your token (EVM format) on testnet
const TOKEN_OUT = process.env.TOKEN_OUT;

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const routerAbi = [
  "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)"
];
const factoryAbi = [
  "function getPair(address tokenA, address tokenB) view returns (address)",
];
const whbarAbi = [
  "function token() view returns (address)" // IWHBAR.token()
];

async function main() {
  console.log("Wallet:", await wallet.getAddress());

  const router = new ethers.Contract(ROUTER, routerAbi, wallet);
  const factory = new ethers.Contract(FACTORY, factoryAbi, provider);
  const whbar = new ethers.Contract(WHBAR_CONTRACT, whbarAbi, provider);

  // 1) Resolve whbar token address (the token pair token, not the wrapper contract)
  let whbarToken;
  try {
    whbarToken = await whbar.token();
    console.log("Resolved whbar token address:", whbarToken);
  } catch (e) {
    console.error("Failed to resolve whbar token via IWHBAR.token(). Make sure WHBAR_CONTRACT is correct.", e);
    return;
  }

  // 2) Check pair exists
  try {
    const pair = await factory.getPair(whbarToken, TOKEN_OUT);
    console.log("Factory pair address (whbar <-> token):", pair);
    if (pair === ethers.ZeroAddress) {
      console.error("ERROR: Pair does not exist. No liquidity pool for whbar <-> token.");
      return;
    }
  } catch (e) {
    console.error("Factory getPair call failed:", e);
    return;
  }

  // 3) Show getAmountsOut result (view) so we can detect liquidity or path problems
  const amountInHBAR = "1.0"; // HBAR amount to swap
  const amountIn = ethers.parseUnits(amountInHBAR, 18); // HBAR decimals (use 18)
  const path = [whbarToken, TOKEN_OUT];

  try {
    const amounts = await router.getAmountsOut(amountIn, path);
    console.log("getAmountsOut returned:", amounts.map(a => a.toString()));
    if (!amounts || amounts.length === 0) {
      console.error("getAmountsOut returned empty — likely no liquidity or broken path.");
      return;
    }
  } catch (err) {
    console.error("getAmountsOut failed — likely pool missing or revert. Details:", err);
    return;
  }

  // 4) Execute swapExactETHForTokens (payable)
const slippage = 0.005; // 0.5%
const amounts = await router.getAmountsOut(amountIn, path);
const amountOutMin = amounts[1] - (amounts[1] * BigInt(Math.floor(slippage * 1000)) / 1000n)

  const to = await wallet.getAddress();
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes
  console.log(`Swapping ${amountInHBAR} HBAR -> token (path[0]=whbar token).`);
  try {
    const tx = await router.swapExactETHForTokens(
      amountOutMin,
      path,
      to,
      deadline,
      {
        value: amountIn,
        gasLimit: 1000000n, // bump if needed (Hedera needs explicit gas)
      }
    );
    console.log("Tx submitted:", tx.hash);
    const receipt = await tx.wait();
    console.log("the full receipt")
    console.log(receipt)
    console.log("Tx confirmed:", receipt.hash, "block:", receipt.blockNumber);
  } catch (err) {
    console.error("Swap failed:", err);
    // If revert, print helpful pieces:
    if (err?.reason) console.error("Revert reason:", err.reason);
    if (err?.data) console.error("Revert data:", err.data);
  }
}

main().catch((e)=>{ console.error("Fatal:", e); });

