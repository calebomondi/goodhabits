# GoodHabit

**Turn your GoodDollar UBI into lasting wealth.**

GoodHabit is a DeFi savings & investment dApp built on [Celo](https://celo.org) that helps GoodDollar UBI recipients automatically save, invest, and grow their daily Universal Basic Income. Set a habit strategy once, and the protocol handles the rest — splitting each deposit across spendable, savings, and investment buckets, building streaks, deploying capital into Uniswap V3 LP positions, and tracking progress on a gamified leaderboard.

## How It Works

```mermaid
flowchart LR
    U[User claims UBI] --> D[Deposits G$ into Treasury]
    D --> H{Has habit strategy set?}
    H -- No --> E[Prompt to set Spend/Save/Invest %]
    E --> H
    H -- Yes --> S[Split per habit allocation]
    
    subgraph Spendable
        S1[Free to withdraw anytime]
    end
    
    subgraph Savings
        S2[Locked until unlock date]
        S2 -->|Early withdrawal| B[Broke habit - 7d points freeze]
        S2 -->|Hold until unlock| ST[Streak continues + points]
    end
    
    subgraph Investment
        I1[Mint shares at current PPS]
        I1 --> I2[Backend deploys idle G$ to Uniswap V3 LP]
        I2 --> I3[LP earns swap fees → NAV grows → PPS increases]
        I3 --> I4[User withdraws shares → G$ + yield]
    end
    
    S --> S1
    S --> S2
    S --> I1
    
    style Spendable fill:#e8f5e9
    style Savings fill:#fff3e0
    style Investment fill:#e3f2fd
```

## Repository Structure

```
gooddollar/
├── frontend/        # Next.js 16 dApp (TypeScript, Tailwind, shadcn/ui)
├── backend/         # NestJS 11 API server (PostgreSQL, Redis, BullMQ)
├── contracts/       # Foundry Solidity smart contracts
└── README.md
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Blockchain** | Celo (chain 42220), Solidity 0.8.28, Foundry |
| **Backend** | NestJS 11, TypeScript, PostgreSQL (Drizzle ORM), Redis (BullMQ), Viem |
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Wagmi, Reown AppKit |
| **AI** | Groq API (llama-3.3-70b-versatile), custom fallback agent |
| **DeFi** | Uniswap V3 (G$–cUSD pool on Celo), DexScreener price feed |
| **Identity** | GoodDollar Citizen SDK (Face Verification, UBI claiming) |

## System Architecture

```mermaid
flowchart TB
    subgraph User[User]
        W[Web3 Wallet<br/>MetaMask / WalletConnect]
    end
    
    subgraph Frontend[Next.js Frontend]
        LP[Landing Page] --> DASH[Dashboard]
        DASH --> SC[SectionCards]
        DASH --> CH[ChartAreaInteractive]
        DASH --> DT[DataTable]
        DASH --> LB[Leaderboard]
        DASH --> LSB[Left Sidebar<br/>Strategy / Savings / Offramp]
        DASH --> RSB[Right Sidebar<br/>Identity / Claim / Deposit]
        DASH --> AC[Agent Chat]
    end
    
    subgraph Backend[NestJS Backend]
        AG[Agent Module<br/>Groq LLM + Fallback]
        OF[Offramp Module<br/>G$ → USDC swap]
        AN[Analytics Module<br/>Snapshots / Leaderboard]
        TR[Treasury Module<br/>Contract interaction]
        UNI[Uniswap Module<br/>Quoting / LP management]
        WK[Workers<br/>BullMQ queues]
        PR[Price Service<br/>DexScreener + FX]
    end
    
    subgraph Storage[Data Layer]
        PG[(PostgreSQL<br/>Drizzle ORM)]
        RD[(Redis<br/>BullMQ)]
    end
    
    subgraph Blockchain[Celo Mainnet]
        TRE[GoodHabitsTreasury<br/>0x64E169...]
        UV3[Uniswap V3<br/>G$–cUSD Pool]
        GD[G$ Token]
    end
    
    W -->|Wagmi / Viem| TRE
    W -->|Connect / Sign| Frontend
    Frontend -->|/api/* rewrite| Backend
    
    Backend --> PG
    Backend --> RD
    Backend -->|Viem WalletClient| TRE
    Backend -->|Viem PublicClient| UV3
    
    TRE --> GD
    TRE --> UV3
    
    AG -->|GROQ_API_KEY| Groq[Groq API]
    OF --> UNI
    OF --> PR
    AN --> TR
    WK --> TR
    WK --> UNI
    WK --> OF
    PR -->|DexScreener| DEX[DexScreener API]
    PR -->|Frankfurter API| FX[FX Rates API]
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL running on `localhost:5432`
- Redis running on `localhost:6379`
- A Celo wallet private key for the backend bot
- A [Groq API key](https://console.groq.com)

### 1. Smart Contracts

```bash
cd contracts
cp .env.example .env      # fill in PRIVATE_KEY_DEPLOYER, RPC URLs, etc.
forge build
forge test
make deploy NETWORK=mainnet
```

### 2. Backend

```bash
cd backend
cp .env.example .env      # fill in RPC_URL, BACKEND_PRIVATE_KEY, DATABASE_URL, etc.
npm install
npm run start:dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env      # fill in NEXT_PUBLIC_* vars
npm install
npm run dev
```

Visit `http://localhost:3001` (or whichever port the frontend runs on).

## Environment Overview

| Variable | Where | Purpose |
|---|---|---|
| `RPC_URL` | backend | Celo RPC endpoint (e.g. Forno) |
| `BACKEND_PRIVATE_KEY` | backend | Hot wallet for on-chain operations |
| `DATABASE_URL` | backend | PostgreSQL connection |
| `REDIS_URL` | backend | Redis connection for BullMQ |
| `GROQ_API_KEY` | backend | AI agent LLM inference |
| `NEXT_PUBLIC_API_URL` | frontend | Backend URL for API proxy |
| `PRIVATE_KEY_DEPLOYER` | contracts | Contract deployment key |
| `ETHERSCAN_API_KEY` | contracts | Contract verification |

## Detailed Documentation

- [Backend README](./backend/README.md) — API endpoints, modules, database schema, worker flows
- [Frontend README](./frontend/README.md) — pages, components, hooks, wallet integration
- [Contracts README](./contracts/README.md) — smart contract architecture, deployment, roles
