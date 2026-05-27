# ATLAS Protocol

**Tokenized Stock Index Funds on Robinhood Chain**

> Create, trade, and manage custom index funds of tokenized stocks — fully on-chain, permissionless, and powered by AI.

**Live Demo:** [london-hackaton.vercel.app](https://london-hackaton.vercel.app)

Built for the **Arbitrum Open House London Buildathon** (May 25 – June 14, 2026).

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Architecture Diagram](#architecture-diagram)
- [Smart Contracts](#smart-contracts)
- [Protocol Flow](#protocol-flow)
- [Fee Model](#fee-model)
- [AI Trading Terminal](#ai-trading-terminal)
- [Tech Stack](#tech-stack)
- [Deployed Contracts](#deployed-contracts)
- [Stock Tokens](#stock-tokens)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Security](#security)
- [License](#license)

---

## Overview

ATLAS is a decentralized protocol for creating and trading **tokenized stock index funds** on Robinhood Chain (Arbitrum Orbit L2). Think of it as **on-chain ETFs** — anyone can bundle tokenized stocks (TSLA, AMZN, NFLX, AMD, PLTR) into a custom index fund, deploy it as an ERC-20 token, and earn fees when others buy it.

### Key Features

- **Create Index Funds** — Bundle 2-5 tokenized stocks with custom weights, deploy as ERC-20 token on-chain
- **Buy & Sell via AtlasVault** — One-click purchasing through the liquidity vault, no need to acquire each stock individually
- **AI Trading Terminal** — Natural language interface powered by AI + real-time web search
- **Liquidity Providers** — Deposit stocks into the vault, earn 50% of all index fees
- **Real-Time Prices** — Live stock prices from Yahoo Finance, refreshed every 30 seconds
- **Fully On-Chain** — Every transaction is a real smart contract call on Robinhood Chain testnet

---

## How It Works

### The Three Roles

| Role | What They Do | How They Earn |
|------|-------------|---------------|
| **Index Creator** | Creates a custom index fund (e.g., "Tech Titans" = 40% TSLA + 30% AMZN + 30% NFLX) | Earns 50% of the fee on every buy |
| **Liquidity Provider (LP)** | Deposits stock tokens into the AtlasVault | Earns 50% of the fee on every buy |
| **Buyer** | Purchases index tokens to get diversified exposure | Gets exposure to multiple stocks with one token |

### User Journey

```
1. GET STOCKS     User claims tokenized stocks from the Robinhood Chain faucet
                  (5 TSLA, 5 AMZN, 5 NFLX, 5 AMD, 5 PLTR per 24h)

2. CREATE INDEX   Index creator selects stocks + weights + fee, deploys ERC-20 on-chain
       or
   PROVIDE LP     LP deposits stocks into AtlasVault to provide liquidity

3. BUY INDEX      Buyer clicks "Buy" → AtlasVault provides stocks → mints index token
                  → buyer receives diversified exposure in 1 transaction

4. EARN FEES      Creator and LPs earn their fee split automatically on every purchase

5. SELL INDEX     Buyer sells index token back → burns token → stocks return to vault
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ATLAS PROTOCOL                               │
│                   Robinhood Chain (Arbitrum Orbit L2)                │
└─────────────────────────────────────────────────────────────────────┘

                         ┌──────────────┐
                         │   Frontend   │
                         │  (React SPA) │
                         │  Vercel CDN  │
                         └──────┬───────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
            ┌──────────┐ ┌──────────┐ ┌──────────┐
            │  MetaMask │ │ Yahoo    │ │ OpenAI + │
            │  Wallet   │ │ Finance  │ │ Tavily   │
            │  (RH     │ │ (Prices) │ │ (AI +    │
            │   Chain)  │ │          │ │  Search) │
            └─────┬────┘ └────┬─────┘ └──────────┘
                  │           │
                  │     ┌─────┴──────┐
                  │     │ /api/prices│  Vercel Serverless
                  │     │  (proxy)   │  (avoids CORS)
                  │     └────────────┘
                  │
    ══════════════╪═══════════════════════════════════
    ON-CHAIN      │    Robinhood Chain Testnet
    ══════════════╪═══════════════════════════════════
                  │
                  ▼
    ┌─────────────────────────────────────────────┐
    │              IndexFactory                    │
    │  Creates new IndexToken contracts            │
    │  Tracks all deployed indices                 │
    │  Passes vault address for fee split          │
    │                                              │
    │  createIndex(name, symbol, stocks[],         │
    │              weights[], feeBps)              │
    └──────────────────┬──────────────────────────┘
                       │ deploys
                       ▼
    ┌─────────────────────────────────────────────┐
    │              IndexToken (ERC-20)             │
    │  Custom index fund token                     │
    │                                              │
    │  ┌─────────────────────────────────────┐    │
    │  │ Composition:                        │    │
    │  │  TSLA 40% + AMZN 30% + NFLX 30%   │    │
    │  │  Fee: 1% per mint                   │    │
    │  │  Fee Split: 50% creator / 50% vault │    │
    │  └─────────────────────────────────────┘    │
    │                                              │
    │  mint(amount)  → deposit stocks, get index   │
    │  burn(amount)  → return index, get stocks    │
    └──────────────────┬──────────────────────────┘
                       │ interacts with
                       ▼
    ┌─────────────────────────────────────────────┐
    │              AtlasVault                      │
    │  Liquidity pool for all stock tokens         │
    │                                              │
    │  ┌───────────────────────────────────┐      │
    │  │ Holdings:                         │      │
    │  │  TSLA: 2.0  │  AMZN: 2.0        │      │
    │  │  NFLX: 2.0  │  AMD:  2.0        │      │
    │  │  PLTR: 2.0  │                    │      │
    │  └───────────────────────────────────┘      │
    │                                              │
    │  deposit(token, amount)   LP adds liquidity  │
    │  withdraw(token, amount)  LP removes          │
    │  buyIndex(index, amount)  Buyer purchases     │
    │  sellIndex(index, amount) Buyer sells back    │
    └─────────────────────────────────────────────┘
                       │
                       ▼
    ┌─────────────────────────────────────────────┐
    │         Robinhood Stock Tokens (ERC-20)      │
    │                                              │
    │  TSLA  0xC9f9c869...  │  AMZN  0x5884aD2f.. │
    │  NFLX  0x3b8262A6...  │  AMD   0x71178BAc.. │
    │  PLTR  0x1FBE1a0e...  │                      │
    │                                              │
    │  Official Robinhood Chain testnet tokens      │
    │  Obtained from faucet (5 each per 24h)       │
    └─────────────────────────────────────────────┘
```

### Buy Flow (Detailed)

```
    Buyer                    AtlasVault              IndexToken           Stock Tokens
      │                         │                       │                     │
      │  buyIndex(index, 1e18)  │                       │                     │
      │────────────────────────>│                       │                     │
      │                         │  approve(TSLA, amt)   │                     │
      │                         │──────────────────────────────────────────>  │
      │                         │  approve(AMZN, amt)   │                     │
      │                         │──────────────────────────────────────────>  │
      │                         │  approve(NFLX, amt)   │                     │
      │                         │──────────────────────────────────────────>  │
      │                         │                       │                     │
      │                         │  mint(1e18)           │                     │
      │                         │──────────────────────>│                     │
      │                         │                       │  transferFrom(vault)│
      │                         │                       │────────────────────>│
      │                         │                       │                     │
      │                         │                       │  FEE SPLIT:         │
      │                         │                       │  50% → creator      │
      │                         │                       │  50% → vault (LPs)  │
      │                         │                       │                     │
      │                         │  transfer(buyer, idx) │                     │
      │                         │──────────────────────>│                     │
      │                         │                       │                     │
      │  ✓ Receives index token │                       │                     │
      │<────────────────────────│                       │                     │
```

### Sell Flow (Detailed)

```
    Seller                   AtlasVault              IndexToken           Stock Tokens
      │                         │                       │                     │
      │  approve(vault, 1e18)   │                       │                     │
      │────────────────────────>│                       │                     │
      │                         │                       │                     │
      │  sellIndex(index, 1e18) │                       │                     │
      │────────────────────────>│                       │                     │
      │                         │  transferFrom(seller) │                     │
      │                         │──────────────────────>│                     │
      │                         │                       │                     │
      │                         │  burn(1e18)           │                     │
      │                         │──────────────────────>│                     │
      │                         │                       │  transfer(vault)    │
      │                         │                       │────────────────────>│
      │                         │                       │                     │
      │  ✓ Stocks return to vault for future buyers     │                     │
```

---

## Smart Contracts

### IndexFactory

The factory contract that deploys new IndexToken instances. Anyone can create a custom index fund.

```solidity
function createIndex(
    string memory _name,      // "Tech Titans"
    string memory _symbol,    // "TECH"
    address[] memory _stocks, // [TSLA, AMZN, NFLX]
    uint256[] memory _weights,// [4000, 3000, 3000] (basis points, sum = 10000)
    uint256 _feeBps           // 100 = 1% fee
) external returns (address)
```

- Deploys a new `IndexToken` contract
- Passes the AtlasVault address for fee splitting
- Tracks all created indices
- Emits `IndexCreated` event

### IndexToken (ERC-20)

Each index fund is its own ERC-20 token with mint/burn mechanics.

```solidity
function mint(uint256 amount) external
// Deposits underlying stocks proportionally
// Mints index tokens to caller
// Fee split: 50% to creator, 50% to vault (LPs)

function burn(uint256 amount) external
// Burns index tokens
// Returns proportional share of underlying stocks
```

**Composition Example:**
| Stock | Weight | To mint 1 INDEX token |
|-------|--------|----------------------|
| TSLA  | 40%    | 0.4 TSLA deposited   |
| AMZN  | 30%    | 0.3 AMZN deposited   |
| NFLX  | 30%    | 0.3 NFLX deposited   |

### AtlasVault

The liquidity vault that enables one-click index purchases. LPs deposit stocks, buyers purchase indices without needing to acquire each stock individually.

```solidity
function deposit(address token, uint256 amount) external   // LP deposits stocks
function withdraw(address token, uint256 amount) external  // LP withdraws stocks
function buyIndex(address indexToken, uint256 amount) external  // Buyer purchases index
function sellIndex(address indexToken, uint256 amount) external // Buyer sells index
```

**Buy flow:** Vault approves stocks to IndexToken → calls mint → transfers index tokens to buyer.
**Sell flow:** Buyer approves index tokens to vault → vault calls burn → stocks return to vault.

---

## Protocol Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   ┌──────────┐    deposit stocks    ┌──────────────┐            │
│   │    LP    │ ───────────────────> │  AtlasVault  │            │
│   │ (Bank/   │ <─────────────────── │              │            │
│   │  User)   │    withdraw stocks   │  Holds TSLA  │            │
│   └──────────┘                      │  AMZN, NFLX  │            │
│                                     │  AMD, PLTR   │            │
│                                     └──────┬───────┘            │
│                                            │                    │
│   ┌──────────┐    create index     ┌───────┴──────┐            │
│   │ Creator  │ ──────────────────> │ IndexFactory │            │
│   │          │ <────────────────── │              │            │
│   │  Earns   │    index deployed   │  Deploys     │            │
│   │  50% fee │                     │  IndexToken  │            │
│   └──────────┘                     └──────────────┘            │
│                                                                  │
│   ┌──────────┐    buyIndex()       ┌──────────────┐            │
│   │  Buyer   │ ──────────────────> │  AtlasVault  │            │
│   │          │ <────────────────── │              │            │
│   │  Gets    │    index tokens     │  Provides    │            │
│   │  index   │                     │  stocks,     │            │
│   │  tokens  │    sellIndex()      │  mints token │            │
│   │          │ ──────────────────> │              │            │
│   │          │ <────────────────── │  Burns token,│            │
│   │          │    stocks recycled  │  recycles    │            │
│   └──────────┘                     └──────────────┘            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Fee Model

Every time someone buys (mints) an index token, a fee is charged and split automatically on-chain:

```
                    Index Fee (e.g., 1%)
                          │
                ┌─────────┴─────────┐
                │                   │
           50% Creator         50% Vault (LPs)
                │                   │
         ┌──────┴──────┐    ┌──────┴──────┐
         │ Index token │    │ Index token │
         │ minted to   │    │ minted to   │
         │ creator's   │    │ vault addr  │
         │ wallet      │    │ (for LPs)   │
         └─────────────┘    └─────────────┘
```

**Example:** User buys 10 tokens of an index with 1% fee:
- User receives: **9.9 index tokens**
- Creator receives: **0.05 index tokens** (50% of 0.1 fee)
- Vault (LPs) receives: **0.05 index tokens** (50% of 0.1 fee)

---

## AI Trading Terminal

The ATLAS Terminal is a **natural language trading interface** powered by GPT-4o-mini. Instead of navigating forms and dropdowns, users type what they want in plain English (or Spanish) and the AI agent translates intent into on-chain transactions.

### How It Works

```
User Input → GPT-4o-mini → Structured JSON → Confirmation UI → On-Chain Transaction

┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│  User types  │────▶│  AI Agent    │────▶│  Confirm UI  │────▶│  Blockchain │
│  "buy 2      │     │  parses      │     │  shows tx    │     │  executes   │
│   ATLAS"     │     │  intent →    │     │  details,    │     │  buyIndex() │
│              │     │  JSON action │     │  user clicks │     │  via vault  │
└─────────────┘     └──────────────┘     │  ✓ Confirm   │     └─────────────┘
                                          └──────────────┘
```

### AI Agent Architecture

The AI agent uses a **dynamic system prompt** regenerated on every request, ensuring the agent always has current data:

| Component | Details |
|-----------|---------|
| **Model** | GPT-4o-mini (temperature 0.7, max 600 tokens) |
| **Dynamic Context** | Current stock prices, all deployed indices + supply, user wallet balances, available stocks |
| **Response Format** | Structured JSON: `{ reply, action, data }` |
| **Fallback Parser** | Regex-based intent detection when AI doesn't set action field |
| **Context Window** | Last 20 messages maintained for multi-turn conversations |

### Terminal Capabilities

| Command (Natural Language) | Action | On-Chain? |
|---------------------------|--------|-----------|
| "buy 2 ATLAS" | Purchases 2 ATLAS index tokens via AtlasVault | **Yes** — `buyIndex()` |
| "sell 1 ATLAS" | Redeems 1 ATLAS, receives underlying stocks | **Yes** — `sellIndex()` |
| "send 5 TSLA to 0x..." | Transfers 5 TSLA tokens to address | **Yes** — `transfer()` |
| "create index with TSLA and AMZN" | Guides through index creation flow | **Yes** — `createIndex()` |
| "show my portfolio" | Displays wallet balances for all tokens | Read-only |
| "price of TSLA?" | Shows live price from Yahoo Finance | Read-only |
| "latest news about Arbitrum" | Real-time web search via Tavily API | Off-chain |

### Multilingual Support

The terminal detects the user's language and responds accordingly:

```
English: "buy 2 ATLAS"    → action: buy, ticker: ATLAS, qty: 2
Spanish: "compra 2 ATLAS" → action: buy, ticker: ATLAS, qty: 2
English: "sell 1 ATLAS"   → action: sell, ticker: ATLAS, qty: 1
Spanish: "vende 1 ATLAS"  → action: sell, ticker: ATLAS, qty: 1
```

### Web Search Integration (Tavily)

The terminal has **real-time web search** capability:

1. Detects search intent via keyword patterns ("news", "latest", "what is", "who", etc.)
2. Calls Tavily API with the user's query (8 rotating keys for rate limiting)
3. Injects search results into the AI's system prompt
4. AI incorporates real data + URLs into the response

This means the terminal can answer questions about **any topic** — not just trading. Users can ask about news, events, tutorials, crypto, and more.

### Wallet Integration

- If a user tries to execute a trade without a connected wallet, MetaMask connection is automatically prompted
- A "Connect Wallet" banner appears at the top of the terminal when no wallet is detected
- The system prompt dynamically includes the user's current balances so the AI can reference them

### Response Pipeline

```
1. User sends message
2. System checks if message needs web search (Tavily)
3. Dynamic system prompt generated with:
   - Current stock prices (live from Yahoo Finance)
   - All deployed on-chain indices + supply
   - User's wallet balances
   - Web search results (if applicable)
4. GPT-4o-mini generates structured JSON response
5. Regex fallback parser runs if AI didn't set action field
6. buildConfirmation() maps action to confirmation UI
7. User clicks ✓ Confirm
8. handleConfirm() executes on-chain transaction via ethers.js
9. Balances refresh automatically after transaction
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Chain** | Robinhood Chain (Arbitrum Orbit L2) | Settlement layer, Chain ID 46630 |
| **Smart Contracts** | Solidity 0.8.20 | IndexToken, IndexFactory, AtlasVault |
| **Frontend** | React 18 (CDN, single HTML) | UI dashboard |
| **Wallet** | MetaMask + ethers.js v6 | On-chain interactions |
| **Prices** | Yahoo Finance API | Real-time stock prices |
| **AI Terminal** | OpenAI GPT-4o-mini | Natural language trading |
| **Web Search** | Tavily API | Real-time information for AI |
| **Hosting** | Vercel | Frontend + serverless API |
| **Price Proxy** | Vercel Serverless Functions | `/api/prices` (avoids CORS) |

---

## Deployed Contracts

| Contract | Address | Explorer |
|----------|---------|----------|
| **IndexFactory v2** | `0xE0136684FaA29801885e1faF619bc5C8894CA35D` | [View](https://explorer.testnet.chain.robinhood.com/address/0xE0136684FaA29801885e1faF619bc5C8894CA35D) |
| **AtlasVault** | `0x3130865dE0D1594E38C5cC52596712F05d93a4d5` | [View](https://explorer.testnet.chain.robinhood.com/address/0x3130865dE0D1594E38C5cC52596712F05d93a4d5) |
| **IndexFactory v1** *(deprecated)* | `0xfba93D3DE479Bcf6d4b1eFCeC317055F9253b269` | [View](https://explorer.testnet.chain.robinhood.com/address/0xfba93D3DE479Bcf6d4b1eFCeC317055F9253b269) |

**Network:** Robinhood Chain Testnet
**Chain ID:** 46630
**RPC:** `https://rpc.testnet.chain.robinhood.com`
**Explorer:** [explorer.testnet.chain.robinhood.com](https://explorer.testnet.chain.robinhood.com)

---

## Stock Tokens

Official Robinhood Chain testnet tokenized stocks:

| Token | Address | Faucet Amount |
|-------|---------|---------------|
| **TSLA** (Tesla) | `0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E` | 5 per 24h |
| **AMZN** (Amazon) | `0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02` | 5 per 24h |
| **NFLX** (Netflix) | `0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93` | 5 per 24h |
| **AMD** (AMD) | `0x71178BAc73cBeb415514eB542a8995b82669778d` | 5 per 24h |
| **PLTR** (Palantir) | `0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0` | 5 per 24h |

**Faucet:** [faucet.testnet.chain.robinhood.com](https://faucet.testnet.chain.robinhood.com/)

---

## Getting Started

### Prerequisites

- [MetaMask](https://metamask.io/) browser extension
- Node.js 18+ (for contract deployment only)

### Try It Live

1. Visit [london-hackaton.vercel.app](https://london-hackaton.vercel.app)
2. Click **Connect Wallet** — MetaMask will prompt to add Robinhood Chain
3. Get testnet stocks from the [faucet](https://faucet.testnet.chain.robinhood.com/)
4. Explore the dashboard, create an index, or trade via the AI terminal

### Local Development

```bash
# Clone
git clone https://github.com/NachoLLMJS/atlas-protocol.git
cd atlas-protocol

# Install dependencies (for contract deployment)
npm install

# Create config.js with your API keys (see config.example.js)
cp config.example.js config.js

# Open ATLAS.html in browser or serve with any static server
npx serve .

# Deploy contracts (optional — already deployed on testnet)
node contracts/deploy.js           # IndexFactory
node contracts/deploy-vault.js     # AtlasVault + seed liquidity
node contracts/deploy-factory-v2.js # IndexFactory v2 with fee split
```

### Compile Contracts

```bash
npx solc --bin --abi --optimize -o build \
  contracts/IndexToken.sol \
  contracts/IndexFactory.sol \
  contracts/AtlasVault.sol
```

---

## Project Structure

```
atlas-protocol/
├── ATLAS.html              # Main React SPA (single-file app)
├── config.js               # API keys (gitignored)
├── config.example.js       # Template for config.js
├── deployment.json         # Deployed contract addresses
├── package.json            # Dependencies (ethers.js)
│
├── api/
│   └── prices.js           # Vercel serverless — Yahoo Finance proxy
│
├── contracts/
│   ├── IndexToken.sol      # ERC-20 index fund token
│   ├── IndexFactory.sol    # Factory that deploys IndexTokens
│   ├── AtlasVault.sol      # Liquidity vault for buy/sell
│   ├── deploy.js           # Deploy script (Factory v1)
│   ├── deploy-vault.js     # Deploy + seed AtlasVault
│   └── deploy-factory-v2.js# Deploy Factory v2 (fee split)
│
└── build/                  # Compiled contract artifacts (gitignored)
```

---

## Security

- **API keys** are stored in `config.js` which is gitignored — never committed to the repo
- **Smart contracts** use standard ERC-20 patterns with `require` checks
- **AtlasVault** has `onlyOwner` emergency withdrawal
- **IndexToken** enforces weight validation (must sum to 10000), fee cap (max 5%), and stock count limits (2-5)
- **No proxy patterns** — contracts are immutable once deployed

---

## License

MIT

---

<p align="center">
  <b>ATLAS Protocol</b> · Robinhood Chain · Arbitrum Orbit L2<br>
  Built for the Arbitrum Open House London Buildathon 2026
</p>
