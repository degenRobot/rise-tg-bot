# RISE Telegram Bot Monorepo

A natural language crypto wallet interface for RISE blockchain, accessible through Telegram. Users can check balances, send tokens, and swap assets using simple conversational commands.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run both frontend and bot
pnpm dev

# Run with ngrok (for Telegram webhook)
pnpm dev:ngrok
```

## Project Status

✅ **Completed Features**:
- Natural language processing for crypto operations
- Wallet verification via signatures
- Token swaps, transfers, and balance queries
- Persistent file-based storage
- Comprehensive test suite

## Overview

This application provides a seamless bridge between Telegram and the RISE blockchain, enabling users to:
- Connect their RISE wallet and grant specific permissions to a bot
- Link their Telegram account to their wallet
- Execute transactions using natural language commands in Telegram
- Maintain security through granular permission controls and time-based expiry

## Architecture

- **Frontend** (`apps/frontend`): Next.js app for wallet connection, permission granting, and Telegram account linking
- **Telegram Bot** (`apps/tg-bot`): Express + Telegraf bot server that processes commands and executes blockchain transactions

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Copy the example env files:

```bash
# Root .env
cp .env.example .env

# Frontend
cp apps/frontend/.env.local.example apps/frontend/.env.local
```

Update the frontend environment variables:
- `NEXT_PUBLIC_TELEGRAM_BOT_NAME`: Your Telegram bot username (without @)
- `NEXT_PUBLIC_BACKEND_KEY_ADDRESS`: The EOA address from step 3
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:4000)

### 3. Backend EOA Key

Generate a new EOA (Externally Owned Account) for the bot to use:

```bash
cast wallet new
```

Update your `.env` file with the generated address and private key.

⚠️ **Security Note**: Never commit private keys to version control. The example keys in `.env.example` are for demonstration only.

### 4. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Create a new bot with `/newbot`
3. Copy the bot token to your `.env` file
4. Enable inline mode with `/setinline` (optional)

### 5. Run Development Servers

```bash
# First time setup - generate SSL certificates
cd apps/frontend && npm run generate-certs

# Run both frontend and bot together (recommended)
pnpm dev

# This will start:
# - Frontend on http://localhost:3000
# - Bot API on http://localhost:8008
# - Logs prefixed with [frontend] and [bot]

# Alternative commands:
pnpm dev:ngrok     # Run with ngrok tunnel for Telegram webhooks
pnpm dev:frontend  # Run only frontend (https://localhost:3000)
pnpm dev:tg-bot    # Run only bot server (http://localhost:8008)

# To run frontend without HTTPS
cd apps/frontend && pnpm dev:http
```

**HTTPS Setup**: 
- The frontend requires HTTPS for RISE wallet integration
- Run `npm run generate-certs` in the frontend directory to generate trusted SSL certificates
- The certificates will be automatically trusted by your system (uses mkcert)
- If you see a certificate warning, the CA may not be fully installed - run `mkcert -install` manually

## How It Works

### User Flow

1. **Connect Wallet**: Users visit the frontend and connect their RISE wallet
2. **Grant Permissions**: Select specific permissions to grant to the bot (with customizable checkboxes)
3. **Link Telegram**: Enter Telegram username and sign a message to verify ownership
4. **Use Bot**: Send natural language commands to the bot on Telegram

### Three-Step Setup Process

The frontend guides users through a clear three-step process:
- Step 1: Connect RISE Wallet
- Step 2: Configure and grant permissions to the bot
- Step 3: Link Telegram account for authentication

### Permission System

The bot uses RISE's permission system to execute transactions securely. Users can grant granular permissions:

**Available Functions:**
- **Transfer ETH**: Send ETH to any address
- **Transfer Tokens**: Send ERC20 tokens (MockUSD, MockToken)
- **Approve Tokens**: Approve token spending for contracts
- **Mint Test Tokens**: Mint test tokens for development
- **Swap Tokens**: Execute token swaps on Uniswap V3

**Spending Limits:**
- Set maximum amounts for ETH transfers
- Configure limits for each token type
- Permissions expire after a user-defined period (1-365 days)

### Security Features

- **Time-based Expiry**: All permissions automatically expire after the set duration
- **Granular Control**: Users can enable/disable individual functions and set specific spending limits
- **Revocable**: Users can revoke permissions at any time through the frontend
- **Wallet-Telegram Binding**: Each Telegram account can only be linked to one wallet at a time

## Technical Details

### Tech Stack

- **Frontend**: 
  - Next.js 14 with App Router
  - TypeScript for type safety
  - rise-wallet SDK for RISE blockchain integration
  - wagmi & viem for Web3 functionality
  - Tailwind CSS for styling
  - Telegram Login Widget for authentication

- **Backend/Bot**:
  - Node.js with Express
  - Telegraf framework for Telegram bot
  - TypeScript
  - In-memory storage (upgradeable to database)
  - OpenRouter integration for LLM capabilities (planned)

- **Blockchain**: 
  - RISE testnet (https://testnet.riselabs.xyz)
  - Porto permission system
  - EOA (Externally Owned Account) for backend signing

### Key Components

1. **Permission Management Hook** (`useBackendPermissions`):
   - Handles granting/revoking permissions
   - Manages permission state and synchronization
   - Integrates with Porto SDK

2. **Telegram Verification**:
   - User enters their Telegram username
   - Signs a message with their wallet to prove ownership
   - Links Telegram handle to wallet address

3. **Backend API**:
   - RESTful endpoints for permission sync
   - Telegram user lookup
   - Permission template management

### Project Structure

```
rise-tg-bot/
├── apps/
│   ├── frontend/          # Next.js permission granting UI
│   │   ├── app/          # App router pages
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   └── config/       # Permission configurations
│   └── tg-bot/           # Telegram bot server
│       ├── src/
│       │   ├── routes/   # Express API routes
│       │   ├── bot/      # Telegraf bot logic
│       │   └── types/    # TypeScript types
│       └── server.ts     # Main server file
├── .env.example
├── package.json
└── pnpm-workspace.yaml
```

## Future Enhancements

- **Persistent Storage**: Migrate from in-memory to database storage
- **LLM Integration**: Natural language processing for complex commands
- **Multi-chain Support**: Extend beyond RISE to other EVM chains
- **Advanced Permissions**: Time-of-day restrictions, geographic limits
- **Analytics Dashboard**: Track bot usage and transaction history
- **Group Chat Support**: Enable bot usage in Telegram groups