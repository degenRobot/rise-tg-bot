# RISE Telegram Bot Frontend

This is the frontend application for the RISE Telegram Bot wallet linking system.

## Features

- RISE wallet connection
- Permission granting UI
- Telegram account verification via signature
- Backend API integration for account linking

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- RISE wallet extension installed

### Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# For HTTPS (required for wallet connections)
pnpm dev:https
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Environment Variables

Create a `.env.local` file (see `.env.local.example`):

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:4000

# Backend EOA address
NEXT_PUBLIC_BACKEND_KEY_ADDRESS=0x038AEBDbDEcd7F4604Fd6902b40BE063e5fc3f7B

# Telegram bot name (optional)
NEXT_PUBLIC_TELEGRAM_BOT_NAME=your_bot_name
```

## Verification Flow

The app guides users through a 3-step process:

1. **Connect Wallet**: User connects their RISE wallet
2. **Grant Permissions**: User grants specific permissions to the backend EOA
3. **Verify Telegram**: User verifies ownership of their Telegram account via signature

### Detailed Flow

1. User connects their RISE wallet
2. User selects which permissions to grant (transfers, swaps, mints, etc.)
3. User enters their Telegram handle
4. Frontend requests verification message from backend (`/api/verify/message`)
5. User signs the message with their wallet
6. Frontend submits signature to backend (`/api/verify/signature`)
7. Backend verifies signature and links accounts
8. User can now use the bot with their verified wallet

## API Endpoints Used

- `POST /api/verify/message` - Get verification message
- `POST /api/verify/signature` - Submit signature for verification
- `POST /api/permissions/sync` - Sync permissions with backend

## Components

- `TelegramVerification` - Handles the signature verification flow
- `PermissionManager` - UI for selecting bot permissions
- `ActivePermissions` - Shows currently granted permissions
- `Card`, `Button`, `Switch` - Reusable UI components

## Usage

1. Users visit the app via the link provided by the Telegram bot (includes `telegram_id` parameter)
2. Complete the wallet connection and permission granting
3. Verify Telegram account ownership
4. Return to Telegram to use the bot

## Security Notes

- Private keys never leave the wallet
- Permissions are granted to a specific backend EOA
- Telegram verification uses cryptographic signatures
- All permissions have expiry times

## Scripts

- `pnpm dev` - Start development server
- `pnpm dev:https` - Start with HTTPS (for wallet connections)
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
