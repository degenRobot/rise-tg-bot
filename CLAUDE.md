# CLAUDE.md - AI Agent Integration Guide

This document helps AI agents (like Claude, ChatGPT, or custom LLM agents) understand and work with the RISE Telegram Bot codebase.

## Project Overview

**What**: A Telegram bot that lets users control their RISE blockchain smart wallets using natural language.

**Key Tech**: Porto SDK (account abstraction), P256 session keys, OpenRouter LLM routing, Next.js frontend, Express backend.

**Main Goal**: Users can say "swap 10 mockusd for mocktoken" in Telegram and the bot executes it on-chain.

## Architecture Quick Reference

```
┌─────────────────┐
│  Telegram User  │
└────────┬────────┘
         │ "swap 1 mockusd for mocktoken"
         ▼
┌─────────────────────────────┐
│  LLM Router (router.ts)     │  ← Parses intent using GPT-4o-mini
│  - Uses OpenRouter API      │
│  - Returns structured JSON  │
└────────┬────────────────────┘
         │ { tool: "swap", params: {...} }
         ▼
┌──────────────────────────────────┐
│  Backend Services                │
│  - backendSwapService.ts         │
│  - backendTransactionService.ts  │
└────────┬─────────────────────────┘
         │ Builds transaction calls
         ▼
┌──────────────────────────────────┐
│  Porto Execution                 │
│  - portoExecution.ts             │
│  - Uses P256 session key         │
│  - Checks permissions            │
└────────┬─────────────────────────┘
         │ Signs & sends to relay
         ▼
┌──────────────────────────────────┐
│  RISE Blockchain (via Porto)     │
│  - Uniswap V2 Router             │
│  - ERC20 Tokens                  │
└──────────────────────────────────┘
```

## Critical Files & Their Purpose

### Core Bot Logic
- **`apps/tg-bot/src/index.ts`**: Telegraf bot initialization, message handlers, user lookup
- **`apps/tg-bot/src/llm/router.ts`**: LLM-powered intent parsing, tool routing, response generation
- **`apps/tg-bot/src/services/portoExecution.ts`**: Executes transactions using Porto SDK with session keys

### Transaction Services
- **`apps/tg-bot/src/services/backendSwapService.ts`**: Handles token swaps via Uniswap V2
- **`apps/tg-bot/src/services/backendTransactionService.ts`**: Generic transaction execution with permission checks
- **`apps/tg-bot/src/services/backendSessionKey.ts`**: Manages P256 session key (reads from `.p256-key.json`)

### Verification & Storage
- **`apps/tg-bot/src/services/verification.ts`**: Links Telegram accounts to wallet addresses via signature verification
- **`apps/tg-bot/src/services/verifiedLinksStore.ts`**: Stores Telegram ↔ Wallet mappings in `data/verified-links.json`
- **`apps/tg-bot/src/services/permissionStore.ts`**: Stores granted permissions in `data/permissions.json`

### Tools & APIs
- **`apps/tg-bot/src/tools/readTools.ts`**: Balance queries, transaction history (uses viem for on-chain reads)
- **`apps/tg-bot/src/routes/permissions.ts`**: API endpoints for permission sync, user lookup

### Frontend
- **`apps/frontend/app/page.tsx`**: Permission management UI, wallet connection, Telegram linking
- **`apps/frontend/hooks/useBackendPermissions.ts`**: Handles permission granting flow

## Key Concepts

### 1. P256 Session Keys (NOT EOA!)

The backend uses **P256 (secp256r1)** keys, which are different from standard Ethereum EOA keys (secp256k1).

```typescript
// Location: apps/tg-bot/src/services/backendSessionKey.ts
export function getOrCreateBackendSessionKey(): P256Credential {
  // Reads from .p256-key.json
  // Returns { publicKey, sign } for Porto SDK
}
```

**Why P256?** Porto's relay mode requires P256 keys for session-based execution.

### 2. Porto Permission System

Permissions are granted on-chain and specify:
- **Which contracts** the bot can call
- **Which functions** (by 4-byte signature)
- **Spend limits** per token
- **Expiry time**

```json
// Structure in data/permissions.json
{
  "walletAddress": "0x...",
  "permissions": [{
    "id": "0x...",  // On-chain permission ID
    "expiry": 1766078956,
    "permissions": {
      "calls": [
        { "to": "0x044b54...", "signature": "0xa9059cbb" }  // transfer()
      ],
      "spend": [
        { "token": "0x044b54...", "limit": "50000000000000000000", "period": "minute" }
      ]
    }
  }]
}
```

### 3. Lazy Permission Registration

**Important quirk**: Porto doesn't write permissions on-chain immediately. The first transaction after granting permission may fail with `status: 500`, then succeed on retry.

We handle this automatically:
```typescript
// apps/tg-bot/src/services/portoExecution.ts
if (statusResult?.status === 500 && retryCount === 0) {
  console.log("⚠️  Status 500 detected - retrying once...");
  await new Promise(resolve => setTimeout(resolve, 1000));
  return executeWithBackendPermission({ walletAddress, calls }, 1);
}
```

### 4. LLM Tool Routing

User messages are parsed by an LLM into structured tool calls:

```typescript
// User: "swap 1 mockusd for mocktoken"
// LLM returns:
{
  "tool": "swap",
  "params": {
    "fromToken": "MockUSD",
    "toToken": "MockToken",
    "amount": "1",
    "slippagePercent": 0.5
  }
}
```

Available tools: `swap`, `transfer`, `mint`, `get_balances`, `no_tool`

**Critical**: All amount values MUST be strings, not numbers! (e.g., "10" not 10)

## Common Workflows

### Adding a New Token

1. **Add to token config** (`apps/tg-bot/src/types/swap.ts`):
```typescript
export const TOKENS = {
  MockUSD: {
    address: "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50" as Address,
    decimals: 18,
    symbol: "MockUSD",
  },
  YourToken: {
    address: "0x..." as Address,
    decimals: 18,
    symbol: "YourToken",
  },
} as const;
```

2. **Ensure Uniswap pool exists** for swaps:
```bash
cast call 0x6c10B45251F5D3e650bcfA9606c662E695Af97ea \
  "getAmountsOut(uint256,address[])(uint256[])" \
  "1000000000000000000" \
  "[0xTOKEN_A,0xTOKEN_B]" \
  --rpc-url https://testnet.riselabs.xyz
```

3. **Update LLM system prompt** in `apps/tg-bot/src/llm/router.ts` to mention the new token.

### Adding a New Tool/Command

1. **Define tool schema** in `apps/tg-bot/src/types/llm.ts`:
```typescript
export const llmToolSchema = z.discriminatedUnion("tool", [
  // ... existing tools
  z.object({
    tool: z.literal("your_tool"),
    params: z.object({
      yourParam: z.string(),
    }),
  }),
]);
```

2. **Add tool handler** in `apps/tg-bot/src/llm/router.ts`:
```typescript
if (parsed.tool === "your_tool") {
  const result = await yourService.execute(parsed.params, userAddress);
  // Handle result...
}
```

3. **Update system prompt** to describe the tool to the LLM.

### Testing Changes

```bash
# Run all tests
pnpm --filter tg-bot test

# Run specific test file
pnpm --filter tg-bot test llm-routing.test.ts

# Watch mode
pnpm --filter tg-bot test:watch
```

**Key test files:**
- `llm-routing.test.ts`: Tests LLM intent parsing accuracy
- `backend-swap.test.ts`: Tests swap execution
- `smart-wallet-verification.test.ts`: Tests signature verification
- `permission-execution.test.ts`: Tests permission checking

## Environment Variables Reference

### Bot (.env in root)
```bash
TELEGRAM_BOT_TOKEN=<from @BotFather>
OPENROUTER_API_KEY=<for LLM routing>
PORT=8008
```

### Frontend (apps/frontend/.env.local)
```bash
NEXT_PUBLIC_TELEGRAM_BOT_NAME=<bot_username_without_@>
NEXT_PUBLIC_BACKEND_KEY_ADDRESS=<P256_public_key_from_.p256-key.json>
NEXT_PUBLIC_API_URL=http://localhost:8008
```

## Data Storage (JSON Files)

All persistence is currently file-based in `apps/tg-bot/data/`:

1. **`permissions.json`**: Stores granted permissions (synced from frontend)
2. **`verified-links.json`**: Maps Telegram IDs to wallet addresses
3. **`.p256-key.json`**: Backend session key (in project root, gitignored)

**For production**: Migrate to PostgreSQL/Redis for proper concurrency and durability.

## Common Issues & Solutions

### Issue: Balance queries show stale data
**Solution**: We now query directly on-chain using viem in `readTools.ts`. Marble API was caching data for 24+ hours.

### Issue: First swap after permission grant fails with status 500
**Solution**: This is expected (lazy permission registration). We automatically retry once with a 1-second delay.

### Issue: "No verified account found" despite verified-links.json having the user
**Solution**: Check if there are duplicate entries with `active: false`. We now search in reverse and filter by `active === true`.

### Issue: Transaction shows "status: 1 (success)" on-chain but Porto returns "status: 500"
**Solution**: Porto status codes are different from chain status. 500 means partial revert in the batch. Check the specific call that failed using `cast receipt`.

### Issue: Type errors with Porto SDK
**Solution**: Use `as any` for account objects with custom `keys` property. The Rise Wallet SDK has custom types not in standard viem.

## Useful Commands

```bash
# Check on-chain balance
cast call <TOKEN_ADDRESS> "balanceOf(address)(uint256)" <WALLET> --rpc-url https://testnet.riselabs.xyz

# Decode transaction
cast receipt <TX_HASH> --rpc-url https://testnet.riselabs.xyz

# Decode error signature
cast 4byte <ERROR_SELECTOR>

# Check Uniswap pool liquidity
cast call 0x6c10B45251F5D3e650bcfA9606c662E695Af97ea \
  "getAmountsOut(uint256,address[])(uint256[])" \
  "1000000000000000000" \
  "[0xTOKEN_A,0xTOKEN_B]" \
  --rpc-url https://testnet.riselabs.xyz

# Generate new P256 key
pnpm generate-key
```

## Contract Addresses (Rise Testnet)

```typescript
// Tokens
MockUSD: "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50"
MockToken: "0x6166a6e02b4CF0e1E0397082De1B4fc9CC9D6ceD"

// Uniswap V2
Router: "0x6c10B45251F5D3e650bcfA9606c662E695Af97ea"
Factory: "0xf6A86076ce8e9A2ff628CD3a728FcC5876FA70C6"

// RPC
Testnet: "https://testnet.riselabs.xyz"
Explorer: "https://explorer.testnet.riselabs.xyz"
```

## AI Agent Best Practices

When working on this codebase:

1. **Always check permissions.json and verified-links.json** when debugging user issues
2. **Use `cast` commands** to verify on-chain state vs local state
3. **Test LLM changes** with llm-routing.test.ts to ensure accuracy
4. **Remember P256 vs EOA difference** - don't try to use standard eth signing libraries
5. **Check Porto status codes**: 100=pending, 200=success, 300=rejected, 400=reverted, 500=partial
6. **Read error logs carefully** - Porto errors are verbose and usually indicate permission mismatches

## Contributing

When making changes:

1. Run tests: `pnpm --filter tg-bot test`
2. Check types: `pnpm --filter tg-bot typecheck`
3. Update this file if you add new concepts/patterns
4. Document any new environment variables in README.md

## Resources

- [RISE Wallet SDK Docs](https://github.com/rise-chain/rise-wallet)
- [Porto Documentation](https://docs.risechain.com)
- [Telegraf Docs](https://telegraf.js.org)
- [OpenRouter API](https://openrouter.ai/docs)
- [Viem Docs](https://viem.sh)

---

**Last Updated**: December 2025
**Maintainer**: RISE Team
**License**: MIT
