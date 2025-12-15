# RISE Wallet Permission Manager

A Next.js application demonstrating RISE Wallet SDK integration for managing session key permissions. This frontend enables secure delegation of wallet permissions to a Telegram bot for natural language blockchain interactions.

## Key Features

### RISE Wallet Integration
- **WebAuthn/Passkey Authentication**: Secure wallet access without seed phrases
- **Session Key Management**: Grant temporary permissions to backend services
- **Smart Account Support**: Full ERC-4337 compatibility
- **Permission Templates**: Pre-configured permission sets for common use cases

### Security Features
- **Granular Permissions**: Control exactly what the bot can do
- **Time-based Expiry**: Permissions automatically expire
- **Token Limits**: Set maximum spending amounts per token
- **Contract Whitelisting**: Restrict which contracts can be called

### User Experience
- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Real-time Status**: Live permission status updates
- **Error Handling**: Clear feedback for all operations
- **Mobile Friendly**: Works seamlessly on all devices

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

## User Flow

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│   Connect   │ ──▶ │    Grant     │ ──▶ │    Verify      │
│   Wallet    │     │ Permissions  │     │   Telegram     │
└─────────────┘     └──────────────┘     └────────────────┘
       │                    │                      │
       ▼                    ▼                      ▼
  WebAuthn Auth      Session Key Setup      Signature Proof
```

### Step-by-Step Process

1. **Connect RISE Wallet**
   - User authenticates with WebAuthn/Passkey
   - Smart wallet address is retrieved
   - Connection persists across sessions

2. **Grant Permissions**
   - Select permission template or customize
   - Set token spending limits
   - Choose expiration time
   - Sign on-chain transaction

3. **Verify Telegram Account**
   - Enter Telegram handle
   - Sign verification message
   - Backend validates signature
   - Account linking confirmed

## Technical Architecture

### Frontend Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + Custom Components
- **Wallet Integration**: RISE Wallet SDK + Wagmi + Viem
- **State Management**: React hooks + Context
- **Type Safety**: TypeScript with strict mode

### Key Components

```
src/
├── app/                    # Next.js app router
├── components/
│   ├── ui/                # Reusable UI components
│   ├── TelegramVerification.tsx
│   ├── PermissionTemplates.tsx
│   └── ActivePermissions.tsx
├── hooks/
│   ├── useBackendPermissions.ts
│   ├── useNeedPermissions.ts
│   └── useWallet.ts
└── lib/
    ├── types.ts          # TypeScript definitions
    └── utils.ts          # Helper functions
```

## Backend Integration

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|----------|
| `/api/permissions/config` | GET | Fetch backend public key |
| `/api/verify/message` | POST | Generate verification challenge |
| `/api/verify/signature` | POST | Submit signature proof |
| `/api/permissions/sync` | POST | Sync granted permissions |
| `/api/permissions/revoke` | POST | Revoke active permissions |

### Permission Sync Flow

```typescript
// After successful on-chain permission grant
const syncData = {
  accountAddress: wallet.address,
  backendKeyAddress: backendKey,
  expiry: Math.floor(Date.now() / 1000) + duration,
  telegramId: params.telegram_id,
  telegramUsername: params.telegram_username,
  permissionDetails: {
    id: permissionId,
    keyPublicKey: backendKey,
    permissions: grantedPermissions
  }
};
```

## Development Guide

### Prerequisites

```bash
# Required software
node >= 18.0.0
pnpm >= 8.0.0

# Generate SSL certificates for local HTTPS
pnpm run generate-certs
```

### Local Development

```bash
# Install dependencies
pnpm install

# Start with HTTPS (required for RISE Wallet)
pnpm dev:https

# Open https://localhost:3000
```

### Testing Permissions

1. Visit with test parameters:
   ```
   https://localhost:3000?telegram_id=123456&telegram_username=testuser
   ```

2. Connect wallet and grant test permissions

3. Check backend logs for permission sync

4. Verify in Telegram bot with `/status` command

## Usage

1. Users visit the app via the link provided by the Telegram bot (includes `telegram_id` parameter)
2. Complete the wallet connection and permission granting
3. Verify Telegram account ownership
4. Return to Telegram to use the bot

## Security Considerations

### Permission Security
- **On-chain Enforcement**: All permissions validated by smart contracts
- **No Key Exposure**: Private keys never transmitted or stored
- **Session Key Isolation**: Each permission has unique ID
- **Automatic Expiry**: Time-based permission revocation

### Implementation Security
- **HTTPS Required**: WebAuthn requires secure context
- **CORS Protection**: Configured for specific origins
- **Input Validation**: All user inputs sanitized
- **Error Messages**: No sensitive data in errors

### Best Practices
- Always verify permission status before operations
- Implement permission refresh for long sessions
- Log permission grants/revokes for audit trail
- Monitor for unusual permission patterns

## Available Scripts

```bash
# Development
pnpm dev              # Start dev server (HTTP)
pnpm dev:https        # Start with HTTPS (recommended)
pnpm generate-certs   # Create SSL certificates

# Production
pnpm build           # Create production build
pnpm start           # Start production server

# Quality
pnpm lint            # Run ESLint
pnpm type-check      # Run TypeScript checks
```

## Deployment

### Environment Variables

```env
# Required
NEXT_PUBLIC_API_URL=https://your-backend.com
NEXT_PUBLIC_BACKEND_KEY_ADDRESS=0x...

# Optional
NEXT_PUBLIC_TELEGRAM_BOT_NAME=YourBotName
NEXT_PUBLIC_CHAIN_ID=11155931
```



## Resources

- [RISE Wallet Documentation](https://docs.risechain.com/docs/rise-wallet)
