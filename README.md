# RISE Telegram Bot

A Telegram bot that allows users to perform wallet operations using natural language through Telegram. The bot uses the RISE blockchain's permission system to execute transactions on behalf of users securely.

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
5. Set up the bot domain for the login widget (required for Telegram authentication)

### 5. Run Development Servers

```bash
# First time setup - generate SSL certificates
cd apps/frontend && npm run generate-certs

# Run both frontend (HTTPS) and bot
pnpm dev

# Or run separately
pnpm dev:frontend  # https://localhost:3000 (HTTPS)
pnpm dev:tg-bot    # http://localhost:4000

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
3. **Link Telegram**: Authenticate with Telegram to link their account to their wallet
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

2. **Telegram Authentication**:
   - Custom React component for Telegram widget
   - Secure user verification
   - Links Telegram ID to wallet address

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