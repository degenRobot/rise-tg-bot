# RISE Telegram Bot Monorepo

A natural language crypto wallet interface for RISE blockchain, accessible through Telegram. Users can check balances, send tokens, and swap assets using simple conversational commands.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run both frontend and bot
pnpm dev

# Run with ngrok (for Telegram webhook integration)
pnpm dev:ngrok
```

## Project Status

✅ **Completed Features**:
- **Natural Language Processing**: Uses LLMs (OpenRouter/GPT-4o-mini) to interpret user intent for crypto operations.
- **Wallet Verification**: Securely links Telegram accounts to RISE wallets via signature verification.
- **Token Operations**: Swaps, transfers, and balance queries fully implemented.
- **Robust Error Handling**: Structured error codes and actionable user feedback (e.g., guiding users to renew expired permissions).
- **Test Coverage**: Comprehensive Vitest suite covering core logic, relay interactions, and verification.
- **Modern UI**: Clean, responsive frontend for permission management.

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

### 3. Backend EOA Key

The bot needs a backend key to sign "pre-calls" and act as the session key holder. Generate a new EOA:

```bash
cast wallet new
```

Update your `.env` file with the generated private key (`BACKEND_SIGNER_PRIVATE_KEY`) and the frontend env with the address (`NEXT_PUBLIC_BACKEND_KEY_ADDRESS`).

⚠️ **Security Note**: Never commit private keys to version control. Use a dedicated wallet for development with no real funds.

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

## Future Enhancements

- **Persistent Database**: Migrate from `permissions.json` to a real database (PostgreSQL/Redis).
- **Multi-chain Support**: Extend support to other EVM chains supported by RISE.
- **Advanced Alerting**: Real-time notifications for on-chain events.
