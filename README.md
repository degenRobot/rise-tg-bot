# RISE Telegram Bot

A production-ready natural language interface for RISE blockchain via Telegram. Users control their smart wallets using conversational commands - check balances, swap tokens, and transfer assets without touching a traditional crypto interface.

Built with account abstraction (Porto SDK), P256 session keys, and LLM-powered intent parsing.

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables (see Setup section)
cp .env.example .env
cp apps/frontend/.env.local.example apps/frontend/.env.local

# Generate P256 backend session key
pnpm generate-key

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

## Architecture

### Monorepo Structure

- **Frontend** (`apps/frontend`): Next.js application.
  - Handles wallet connection using `rise-wallet` SDK.
  - Provides a UI for users to grant specific permissions (calls, spend limits) to the bot's backend key.
  - Generates verification signatures to link Telegram IDs to wallet addresses.
- **Telegram Bot** (`apps/tg-bot`): Express + Telegraf server.
  - Processes natural language messages.
  - Manages user sessions and permissions.
  - Executes blockchain transactions using the Porto relay and stored session keys.

### Key Components

1.  **Relay Service** (`apps/tg-bot/src/services/relay.ts`):
    - Custom wrapper around `rise-wallet`'s relay actions.
    - Handles `prepareCalls` and `sendPreparedCalls` with correct capabilities for session keys.
    - Manages `permissions.id` capability for utilizing existing grants.

2.  **Porto Execution Service** (`apps/tg-bot/src/services/portoExecution.ts`):
    - Core logic for executing transactions on behalf of users.
    - Checks permission expiry and validity before execution.
    - Returns structured error types (`expired_session`, `unauthorized`, etc.) to the UI layer.

3.  **LLM Router** (`apps/tg-bot/src/llm/router.ts`):
    - Interprets user messages (e.g., "swap 10 USDC for ETH") into structured tool calls.
    - Routes actions to appropriate services (`backendSwapService`, `backendTransactionService`).
    - Provides user-friendly responses based on execution results.

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Copy the example env files:

```bash
# Root .env (for shared or bot config)
cp .env.example .env

# Frontend .env
cp apps/frontend/.env.local.example apps/frontend/.env.local
```

**Required Variables:**

*   **Frontend** (`apps/frontend/.env.local`):
    *   `NEXT_PUBLIC_TELEGRAM_BOT_NAME`: Your Telegram bot username (without @).
    *   `NEXT_PUBLIC_BACKEND_KEY_ADDRESS`: The public address of the backend EOA key (see Step 3).
    *   `NEXT_PUBLIC_API_URL`: Backend API URL (e.g., `http://localhost:8008` or your ngrok URL).

*   **Bot** (`.env` in root):
    *   `TELEGRAM_BOT_TOKEN`: Token from @BotFather.
    *   `BACKEND_SIGNER_PRIVATE_KEY`: Private key for the backend EOA (starts with `0x`).
    *   `OPENROUTER_API_KEY`: API key for OpenRouter (used for LLM/NLP).
    *   `RISE_CHAIN_ID`: Chain ID (e.g., `11155931` for Testnet).

### 3. Backend P256 Session Key

The bot uses a **P256 (secp256r1) session key** for Porto relay mode execution. Generate one:

```bash
pnpm generate-key
```

This creates a `.p256-key.json` file in the project root with your backend session key.

Copy the public key from the output and set it in:
- **Frontend** `.env.local`: `NEXT_PUBLIC_BACKEND_KEY_ADDRESS=0x<public_key>`
- **Bot** `.env`: The script automatically reads from `.p256-key.json`

⚠️ **Security Note**: Never commit `.p256-key.json` to version control. It's already in `.gitignore`. Generate a fresh key for production.

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

## Technical Stack

- **Frontend**: Next.js 14, Tailwind CSS, `rise-wallet` SDK, `wagmi`, `viem`.
- **Backend**: Node.js, Express, Telegraf, `zod` (validation).
- **AI/NLP**: OpenAI SDK connecting to OpenRouter (GPT-4o-mini).
- **Blockchain**: RISE Testnet, Porto Permission System (Account Abstraction).
- **Testing**: Vitest.

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

### Production Checklist
- [ ] Migrate from JSON storage to PostgreSQL
- [ ] Set up proper logging (Winston/Pino)
- [ ] Configure rate limiting
- [ ] Set up monitoring (Sentry, DataDog, etc.)
- [ ] Use secrets manager for keys (AWS Secrets Manager, Vault)
- [ ] Set up CI/CD pipeline
- [ ] Configure auto-scaling for bot service
- [ ] Add analytics tracking

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
