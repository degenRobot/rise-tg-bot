# RISE Telegram Bot

A production-ready natural language interface for RISE blockchain via Telegram. Users control their smart wallets using conversational commands - check balances, swap tokens, and transfer assets without touching a traditional crypto interface.

Built with account abstraction (Porto SDK), P256 session keys, and LLM-powered intent parsing.

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables (see Setup section)
cp .env.example .env
cp apps/frontend/.env.example apps/frontend/.env.local

# Generate P256 backend session key
pnpm generate-key
# Copy private key to .env and public key to apps/frontend/.env.local

# Generate SSL certs for local HTTPS (required for WebAuthn)
cd apps/frontend && npm run generate-certs && cd ../..

# Run both frontend and bot
pnpm dev
```

**For Telegram webhook integration:**
```bash
pnpm dev:ngrok
```

## Features

### Core Functionality
- ✅ **Natural Language Commands**: "swap 10 mockusd for mocktoken", "send 5 rise to 0x123...", "what's my balance"
- ✅ **Smart Wallet Integration**: Porto SDK with session key permissions (no signatures needed per transaction)
- ✅ **Secure Verification**: Passkey-based wallet linking via WebAuthn signatures
- ✅ **Real-time Balances**: Direct on-chain balance queries (no stale API data)
- ✅ **Automatic Retry**: Handles Porto lazy permission registration gracefully
- ✅ **Uniswap V2 Swaps**: Pool liquidity checks with slippage protection

### Technical Highlights
- **P256 Session Keys**: Backend uses secp256r1 keys (not EOA secp256k1) for relay mode execution
- **Permission System**: Granular on-chain permissions (specific contracts, spend limits, time-based expiry)
- **LLM Routing**: GPT-4o-mini parses user intent into structured tool calls
- **Type-Safe**: Full TypeScript with Zod validation
- **Tested**: Vitest suite covering LLM routing, verification, swaps, and relay execution

## Overview

This application provides a seamless bridge between Telegram and the RISE blockchain, enabling users to:
- Connect their RISE wallet and grant specific permissions to a bot.
- Link their Telegram account to their wallet.
- Execute transactions using natural language commands in Telegram.
- Maintain security through granular permission controls and time-based expiry.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            User Devices                             │
├─────────────────────┬───────────────────────────────────────────────┤
│                     │                                               │
│   Telegram App      │            Web Browser                        │
│                     │                                               │
└──────────┬──────────┴────────────────────┬─────────────────────────┘
           │                               │
           │ Natural Language              │ HTTPS
           │ Commands                      │
           │                               │
┌──────────┴──────────┐         ┌──────────┴──────────────────────┐
│                     │         │                                 │
│  Telegram Bot API   │         │   Frontend (Next.js)            │
│                     │         │   - Wallet Connection           │
│                     │         │   - Permission Management       │
│                     │         │   - Account Verification        │
│                     │         │                                 │
└──────────┬──────────┘         └──────────┬─────────────────────┘
           │                               │
           │ Webhook                       │ API Calls
           │                               │
┌──────────┴───────────────────────────────┴─────────────────────┐
│                                                                │
│                    Backend Services (Express)                  │
│                                                                │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │   LLM Router    │  │ Verification │  │  Permission     │    │
│  │ (Intent Parser) │  │   Service    │  │    Store        │    │
│  └────────┬────────┘  └──────┬───────┘  └────────┬────────┘    │
│           │                  │                    │            │
│  ┌────────┴─────────────────┴────────────────────┴─────────┐   │
│  │                                                         │   │
│  │              Porto Execution Service                    │   │
│  │         (Session Key Management & TX Relay)             │   │
│  │                                                         │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                    │
└───────────────────────────┼────────────────────────────────────┘
                            │
                            │ Porto Relay Protocol
                            │ (Signed Transactions)
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                                                                 │
│                       RISE Blockchain                           │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐     │
│  │  Smart Wallets  │  │   UniswapV2  │  │  Mock Tokens    │     │
│  │   (ERC-4337)    │  │    Router    │  │  (USDC, ETH)    │     │
│  └─────────────────┘  └──────────────┘  └─────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Frontend (`apps/frontend`)
- **Technology**: Next.js 14, TypeScript, Tailwind CSS
- **RISE Wallet Integration**: Uses `rise-wallet` SDK for smart wallet interactions
- **Key Features**:
  - WebAuthn/Passkey authentication for wallet access
  - Permission granting UI (token limits, contract whitelist)
  - Signature-based Telegram account verification
  - Real-time permission status display

#### Telegram Bot (`apps/tg-bot`)
- **Technology**: Express, Telegraf, TypeScript
- **AI Integration**: OpenRouter (GPT-4) for natural language processing
- **Key Features**:
  - Intent recognition from natural language
  - Session key management with P256 cryptography
  - Transaction execution via Porto relay
  - File-based permission storage (upgradeable to DB)

#### Points API (`points-api`)
- Mock service simulating blockchain data queries
- Returns portfolio data, transaction history, DeFi positions

### Key Components

1.  **Porto Execution Service** (`apps/tg-bot/src/services/portoExecution.ts`):
    - Core logic for executing transactions on behalf of users.
    - Checks permission expiry and validity before execution.
    - Returns structured error types (`expired_session`, `unauthorized`, etc.) to the UI layer.

2.  **LLM Router** (`apps/tg-bot/src/llm/router.ts`):
    - Interprets user messages (e.g., "swap 10 USDC for ETH") into structured tool calls.
    - Routes actions to appropriate services (`backendSwapService`, `backendTransactionService`).
    - Provides user-friendly responses based on execution results.

## Transaction Flow

### 1. Permission Setup Flow
```
User → Frontend → RISE Wallet → Smart Contract
         │
         └→ Backend API (stores permission reference)
```

1. User connects RISE wallet in frontend
2. Frontend displays permission options (spending limits, allowed contracts)
3. User signs transaction granting backend key permissions
4. Permission ID and details stored in backend for later use

### 2. Telegram Verification Flow
```
User → Frontend → Backend API → Verified Links Storage
         │
         └→ Signature Verification (ERC-1271)
```

1. User enters Telegram handle in frontend
2. Frontend generates verification message
3. User signs message with RISE wallet
4. Backend verifies signature and stores link

### 3. Transaction Execution Flow
```
Telegram → Bot → LLM → Porto Service → RISE Blockchain
            │      │         │
            │      │         └→ Session Key Signing
            │      └→ Intent Parsing
            └→ Natural Language Input
```

1. User sends natural language command to bot
2. LLM parses intent and extracts parameters
3. Bot checks permissions and prepares transaction
4. Porto service signs with session key
5. Transaction submitted to RISE relay
6. User receives confirmation with TX hash

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Copy the example env files:

```bash
# Root .env (for bot backend)
cp .env.example .env

# Frontend .env.local
cp apps/frontend/.env.example apps/frontend/.env.local
```

**Required Variables:**

*   **Frontend** (`apps/frontend/.env.local`):
    *   `NEXT_PUBLIC_TELEGRAM_BOT_NAME`: Your Telegram bot username (without @).
    *   `NEXT_PUBLIC_BACKEND_KEY_ADDRESS`: The P256 public key from backend (see Step 3). This is a 130-character hex string starting with `0x`.
    *   `NEXT_PUBLIC_API_URL`: Backend API URL (e.g., `http://localhost:8008` or your ngrok URL).

*   **Bot** (`.env` in root):
    *   `TELEGRAM_BOT_TOKEN`: Token from @BotFather.
    *   `BACKEND_SIGNER_PRIVATE_KEY`: P256 private key for backend session key (starts with `0x`, 32 bytes).
    *   `OPENROUTER_API_KEY`: API key for OpenRouter (used for LLM/NLP).
    *   `RISE_RPC_URL`: RISE blockchain RPC endpoint (default: `https://testnet.riselabs.xyz`).
    *   `PORT`: Backend API port (default: `8008`).
    *   `FRONTEND_URL`: Frontend URL for CORS (e.g., `http://localhost:3000`).

### 3. Backend P256 Session Key

The bot uses a **P256 (secp256r1) session key** for Porto relay mode execution. Generate one:

```bash
pnpm generate-key
```

This will output:
- **Private Key**: Add to `.env` as `BACKEND_SIGNER_PRIVATE_KEY`
- **Public Key**: Add to `apps/frontend/.env.local` as `NEXT_PUBLIC_BACKEND_KEY_ADDRESS`

Example output:
```
✅ Generated P256 Key:
Private Key: 0x...
Public Key: 0x...

📝 Add this to your .env file:
BACKEND_SIGNER_PRIVATE_KEY=0x...

📝 And this to frontend .env.local:
NEXT_PUBLIC_BACKEND_KEY_ADDRESS=0x...
```

⚠️ **Security Note**: The private key grants full access to execute transactions on behalf of users (within their granted permissions). Keep it secure and never commit to version control.

### 4. Create Telegram Bot

1.  Message [@BotFather](https://t.me/botfather) on Telegram.
2.  Create a new bot with `/newbot`.
3.  Copy the token to `TELEGRAM_BOT_TOKEN` in `.env`.

### 5. Run Development Servers

```bash
# First time setup - generate SSL certificates (required for RISE wallet)
cd apps/frontend && npm run generate-certs

# Run comprehensive dev environment (Frontend + Bot)
pnpm dev
```

This starts:
- Frontend: `https://localhost:3000` (HTTPS required)
- Bot API: `http://localhost:8008`

**HTTPS Note**: The frontend uses `mkcert` to serve over HTTPS locally, which is required for Passkey/WebAuthn interactions in the RISE wallet.

### 6. Running Tests

The project uses Vitest for testing. The test suite covers relay interactions, LLM routing logic, and signature verification.

```bash
# Run all tests for the bot
pnpm --filter tg-bot test

# Run tests in watch mode
pnpm --filter tg-bot test:watch
```

## How It Works: The Flow

1.  **Connect & Grant**:
    - User goes to the frontend app.
    - Connects their RISE wallet.
    - Selects permissions to grant (e.g., "Can transfer max 100 USDC").
    - Signs a transaction to authorize the backend key as a session key on their account.

2.  **Link Telegram**:
    - User enters their Telegram handle in the frontend.
    - Signs a message: `Verify Telegram account [handle] for [address]`.
    - Backend verifies the signature and links the Telegram ID to the wallet address in `permissions.json`.

3.  **Chat & Execute**:
    - User sends a command on Telegram: "Swap 1 ETH for USDC".
    - **LLM Router** parses the intent -> `swap` tool.
    - **Porto Execution** checks if a valid, non-expired session key exists for this user.
    - **Relay Service** prepares the transaction bundles.
    - Backend signs the bundle with the session key.
    - Transaction is submitted to the RISE Relay.
    - Bot confirms success with a transaction hash link.

## RISE Wallet Features Showcased
[DOCS](https://docs.risechain.com/docs/rise-wallet)


This project demonstrates advanced RISE Wallet capabilities:

### Smart Account Features
- **P256 Session Keys**: Secure temporary keys using secp256r1 curve
- **ERC-4337 Account Abstraction**: Gasless transactions for users
- **Permission Templates**: Granular control over allowed operations
- **Time-based Expiry**: Automatic permission revocation

### Porto Relay Integration
- **Batched Transactions**: Multiple operations in single transaction
- **Pre-signed Calls**: Backend signs on behalf of users
- **Gas Sponsorship**: Bot pays for user transactions
- **Status Tracking**: Real-time transaction monitoring

### Security Model
- **No Private Key Exposure**: Users never share private keys
- **Signature Verification**: Cryptographic proof of ownership
- **Permission Isolation**: Each permission has unique ID
- **Audit Trail**: All operations logged and traceable

## Technical Stack

- **Frontend**: 
  - Next.js 14 (App Router)
  - TypeScript, Tailwind CSS
  - `rise-wallet` SDK for smart wallet integration
  - `wagmi` + `viem` for Ethereum interactions
  
- **Backend**: 
  - Node.js with Express
  - Telegraf for Telegram bot framework
  - TypeScript with `zod` validation
  - File-based storage (upgradeable to DB)
  
- **AI/NLP**: 
  - OpenRouter API (GPT-4 mini)
  - Structured output parsing
  - Intent recognition system
  
- **Blockchain**: 
  - RISE Testnet
  - Porto Permission System
  - UniswapV2 for swaps
  - ERC-4337 smart accounts
  
- **Testing**: 
  - Vitest test runner
  - Comprehensive test coverage
  - Integration tests for relay

## For AI Agents & Developers

See **[CLAUDE.md](./CLAUDE.md)** for:
- Detailed architecture explanations
- File-by-file breakdowns
- Common workflows (adding tokens, tools, etc.)
- Troubleshooting guide
- Contract addresses and useful commands

This guide helps AI agents (Claude, ChatGPT, custom LLMs) understand and work with the codebase effectively.

## Deployment

### Prerequisites
- Node.js 18+
- PostgreSQL (recommended for production vs JSON files)
- Ngrok or similar for Telegram webhook
- Domain with SSL for frontend

## Security Considerations

- **Never commit `.p256-key.json`** - It's your backend's private key
- **Verify signatures** before linking Telegram accounts
- **Check permission expiry** before executing transactions
- **Use spend limits** to cap bot's access to user funds
- **Audit permissions regularly** in the frontend UI
- **Rate limit** bot commands to prevent abuse
- **Validate all user inputs** before passing to blockchain

## Future Enhancements

- **Persistent Database**: Migrate from `permissions.json` to PostgreSQL/Redis
- **Multi-chain Support**: Extend to other EVM chains supported by RISE
- **Advanced Alerting**: Real-time blockchain event notifications (eventWatcher.ts is stubbed)
- **Gas Optimization**: Batch multiple user transactions
- **DeFi Integrations**: Lending, staking, liquidity provision
- **Portfolio Analytics**: Track performance, PnL, position health

## License

MIT
