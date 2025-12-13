# RISE Telegram Bot Architecture

This document describes the architecture of the RISE Telegram Bot - a showcase implementation of RISE Wallet's session key and permission system that enables natural language blockchain interactions through Telegram.

## Overview

The RISE Telegram Bot demonstrates how to build secure, user-friendly crypto applications using the RISE Wallet SDK. It showcases:

- **Session Keys**: Temporary keys with specific permissions for secure delegation
- **Natural Language Processing**: AI-powered intent parsing for user commands
- **Porto Relay Integration**: Gasless transactions via RISE's relay infrastructure
- **Smart Account Support**: Full ERC-4337 compatibility with P256 signatures

## System Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                            User Layer                              │
├─────────────────┬─────────────────────────────────────────────────┤
│                 │                                                   │
│  Telegram App   │                Web Browser                        │
│                 │                                                   │
└────────┬────────┴──────────────────────┬───────────────────────────┘
         │                               │
         │ Natural Language              │ HTTPS
         │ Commands                      │
         │                               │
┌────────▼────────┐             ┌────────▼────────────────────────────┐
│                 │             │                                     │
│ Telegram Bot API│             │    Frontend (Next.js)               │
│                 │             │  - Wallet Connection                │
│                 │             │  - Permission Management             │
│                 │             │  - Telegram Verification            │
│                 │             │                                     │
└────────┬────────┘             └────────┬────────────────────────────┘
         │                               │
         │ Webhook                       │ API Calls
         │                               │
┌────────▼───────────────────────────────▼────────────────────────────┐
│                                                                      │
│                    Backend Services (Express)                        │
│                                                                      │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │   LLM Router   │  │ Verification │  │   Permission Store     │  │
│  │ (Intent Parser)│  │   Service    │  │ (Session Management)   │  │
│  └───────┬────────┘  └──────┬───────┘  └───────────┬────────────┘  │
│          │                  │                       │                │
│  ┌───────▼──────────────────▼──────────────────────▼────────────┐  │
│  │                                                               │  │
│  │                 Porto Execution Service                       │  │
│  │            (Session Key Management & TX Relay)                │  │
│  │                                                               │  │
│  └───────────────────────────┬──────────────────────────────────┘  │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               │ Porto Relay Protocol
                               │ (Signed Transactions)
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                                                                      │
│                         RISE Blockchain                              │
│                                                                      │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  Smart Wallets │  │  UniswapV2   │  │    Mock Tokens         │  │
│  │  (ERC-4337)    │  │   Router     │  │  (USDC, ETH)          │  │
│  └────────────────┘  └──────────────┘  └────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Transaction Flow

### 1. Permission Setup Flow

```
User → Frontend → RISE Wallet → Smart Contract → Backend Storage

1. User connects RISE wallet (WebAuthn)
2. Frontend displays permission options
3. User grants permissions to backend P256 key
4. Transaction creates on-chain permission
5. Backend stores permission reference
```

### 2. Telegram Verification Flow

```
User → Frontend → Backend API → Signature Verification → Storage

1. User enters Telegram handle
2. Frontend generates verification message
3. User signs with RISE wallet (ERC-1271)
4. Backend verifies signature
5. Links Telegram ID to wallet address
```

### 3. Natural Language Transaction Flow

```
User → Telegram → Bot → LLM → Services → Porto → Blockchain

1. User: "swap 10 USD for tokens"
2. Bot receives message via webhook
3. LLM parses intent and extracts:
   - Action: swap
   - Amount: 10
   - From: USD
   - To: tokens
4. Backend services build transaction
5. Porto signs with session key
6. Transaction submitted to relay
7. User receives confirmation
```

## Core Components

### Frontend Application

**Technology Stack:**
- Next.js 14 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- RISE Wallet SDK for blockchain integration
- Wagmi + Viem for Ethereum interactions

**Key Features:**
- WebAuthn/Passkey authentication
- Permission template selection
- Real-time permission status
- Telegram account linking

### Telegram Bot Service

**Technology Stack:**
- Node.js with Express
- Telegraf for Telegram integration
- TypeScript with Zod validation
- OpenRouter API for LLM
- File-based storage (upgradeable)

**Core Services:**

#### 1. LLM Router (`src/llm/router.ts`)
```typescript
interface Intent {
  tool: 'transfer' | 'swap' | 'query';
  params: Record<string, any>;
  confidence: number;
}
```
- Processes natural language inputs
- Extracts structured intents
- Handles ambiguous commands
- Provides contextual responses

#### 2. Verification Service (`src/services/verification.ts`)
```typescript
interface VerificationData {
  telegramId: string;
  telegramHandle: string;
  nonce: string;  // crypto.randomBytes(16)
  timestamp: number;
}
```
- Generates secure nonces
- Creates ERC-1271 compatible messages
- Verifies wallet signatures
- Manages account links

#### 3. Permission Store (`src/services/permissionStore.ts`)
```typescript
interface StoredPermission {
  walletAddress: Address;
  telegramId: string;
  permission: {
    id: `0x${string}`;
    expiry: number;
    keyPublicKey: string;
    permissions?: {
      calls?: CallPermission[];
      spend?: SpendPermission[];
    };
  };
}
```
- File-based storage with JSON
- Permission lookup by wallet/telegram
- Expiry management
- Audit trail

#### 4. Porto Execution (`src/services/portoExecution.ts`)
```typescript
interface ExecutionResult {
  success: boolean;
  callsId?: string;
  transactionHashes?: string[];
  error?: string;
  errorType?: ExecutionErrorType;
}
```
- Integrates RISE Wallet SDK relay actions
- Manages P256 session keys
- Handles transaction batching
- Implements retry logic

### Backend Services

#### Transaction Service
- Direct token transfers
- Balance checks
- Gas estimation

#### Swap Service
- UniswapV2 integration
- Slippage protection
- Pool liquidity checks

#### Query Service
- Portfolio data from points-api
- Transaction history
- Token balances

## Security Architecture

### 1. Key Management

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User Wallet    │     │ Backend P256    │     │  Smart Account  │
│  (Private Key)  │     │  Session Key    │     │   (On-chain)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                        │
         │ Signs Permissions     │ Signs Transactions    │
         └───────────────────────┼────────────────────────┘
                                 │
                         ┌───────▼────────┐
                         │  Permission    │
                         │  Validation    │
                         └────────────────┘
```

### 2. Permission Model

**Granular Controls:**
- Token spending limits
- Contract call whitelist
- Time-based expiry
- Revocation support

**Example Permission:**
```json
{
  "calls": [
    {
      "to": "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50",
      "signature": "transfer(address,uint256)"
    }
  ],
  "spend": [
    {
      "token": "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50",
      "limit": "1000000000000000000000",
      "period": "86400"
    }
  ]
}
```

### 3. Verification Flow

```
1. Generate nonce: crypto.randomBytes(16).toString('hex')
2. Create message: "Verify Telegram account [handle] for [address]\n\nNonce: [nonce]"
3. User signs with wallet
4. Backend verifies signature using ERC-1271
5. Store verified link with timestamp
```

## Data Storage

### Current Implementation (File-based)

```
data/
├── permissions.json       # Permission store
├── verified-links.json    # Telegram-wallet links
└── .gitignore            # Exclude from version control
```

### Production Migration Path

```
File Storage → PostgreSQL/Redis
             │
             └→ Maintain same interfaces
                Keep backward compatibility
```

## Testing Strategy

### Test Categories

1. **Unit Tests**
   - Service logic
   - Utility functions
   - Type safety

2. **Integration Tests**
   - API endpoints
   - Porto relay interaction
   - Permission flows

3. **Security Tests**
   - Nonce generation entropy
   - Signature verification
   - Permission boundaries

4. **E2E Tests**
   - Complete user flows
   - Error scenarios
   - Recovery paths

### Test Execution

```bash
# Run all tests
./tests/run-all-tests.sh

# Specific categories
pnpm tsx tests/llm-routing.test.ts
pnpm tsx tests/permission-execution.test.ts
pnpm tsx tests/nonce-generation.test.ts
```

## Performance Considerations

### 1. LLM Optimization
- Structured output format
- Minimal token usage
- Response caching

### 2. Transaction Batching
- Multiple operations per transaction
- Reduced gas costs
- Atomic execution

### 3. Permission Caching
- In-memory active permissions
- Lazy expiry cleanup
- Quick lookups

## Deployment Architecture

### Development
```
Frontend: https://localhost:3000 (HTTPS for WebAuthn)
Backend: http://localhost:8008
Telegram: Local webhook or polling
```

### Production
```
Frontend: Vercel/Netlify (HTTPS required)
Backend: Fly.io with persistent volumes
Database: PostgreSQL for scale
Monitoring: OpenTelemetry integration
```

## Future Enhancements

### 1. Multi-chain Support
- Extend beyond RISE testnet
- Cross-chain swaps
- Unified balance view

### 2. Advanced Features
- Scheduled transactions
- DeFi position management
- Custom trading strategies

### 3. Enterprise Features
- Multi-signature support
- Role-based permissions
- Compliance tools

## Resources

- [RISE Wallet Documentation](https://docs.risechain.com/docs/rise-wallet)
- [Porto Protocol Specification](https://porto.sh)
- [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and code standards.