# 🌉 Multi-Chain Token Bridge DApp

A decentralized application (DApp) that enables users to **bridge tokens across different blockchains** — even when the tokens are not identical.  

For example:  
- Bridge **USDT (Hedera HTS)** → **DAI (Ethereum ERC20)**  
- Bridge **USDT (Hedera)** → **ETH (Ethereum)** via an automated swap  
- Or any supported token pair across Hedera and EVM-compatible networks  

---

## ✨ Features
- 🔗 **Cross-chain bridging** between Hedera and multiple EVM chains (Ethereum, Polygon, BSC, etc.)  
- 🪙 **Token-to-different-token bridging** (e.g., Hedera USDT → Ethereum DAI)  
- 💳 **Wallet connections**:  
  - Hedera (via HashPack / HashConnect)  
  - EVM chains (via MetaMask, WalletConnect, Coinbase Wallet, etc.)  
- ⚡ **Lock-and-Mint model** with optional token swaps (via Uniswap or other DEX APIs)  
- 💰 **Custom bridge fees** — configurable by the contract owner  
- 🛡 Built on **LayerZero/Axelar** validator infrastructure (no custom relayer required)  

---

## 🏗 Tech Stack
- **Frontend**: Next.js (React, TypeScript, Tailwind CSS)  
- **Wallets**: wagmi + viem (EVM), HashConnect (Hedera)  
- **Smart Contracts**: Solidity + Hedera Token Service (HTS)  
- **Cross-chain messaging**: LayerZero / Axelar  

---

## 🚀 Roadmap
- [ ] Hedera ↔ Ethereum bridge prototype  
- [ ] Multi-token support  
- [ ] Add Uniswap swap integration  
- [ ] UI/UX polish  
- [ ] Deploy demo on Vercel  

---

## 🗺 Project Architecture

```text
          ┌──────────────────────────┐
          │      User Wallets        │
          │ ─ MetaMask (EVM)         │
          │ ─ HashPack (Hedera)      │
          └───────────┬──────────────┘
                      │
                      ▼
             ┌─────────────────┐
             │  Bridge DApp UI │
             │  (Next.js +     │
             │   Tailwind)     │
             └────────┬────────┘
                      │
                      ▼
            ┌────────────────────┐
            │  Bridge Contracts  │
            │ (Hedera + EVM)     │
            └────────┬───────────┘
                      │
                      ▼
         ┌───────────────────────────────┐
         │ Cross-Chain Messaging Layer   │
         │   (LayerZero / Axelar)        │
         │  - Validators monitor events  │
         │  - Relay messages across L1s  │
         └───────────┬───────────────────┘
                      │
                      ▼
          ┌────────────────────────────┐
          │ Destination Chain Contract │
          │   (Mint / Swap / Unlock)   │
          └────────────────────────────┘

## 📦 Getting Started

Clone the repo and install dependencies:

```bash
git clone https://github.com/your-username/bridge-dapp.git
cd bridge-dapp
npm install
