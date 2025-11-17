# RISE Telegram Bot - Architecture

## Overview

The RISE Telegram Bot uses a sophisticated Natural Language Processing (NLP) pipeline to understand user intents and execute blockchain transactions on the RISE chain. This document details the architectural design and data flow.

## Core Architecture

```
+-----------------+     +------------------+     +-----------------+
|                 |     |                  |     |                 |
|  Telegram User  |===> |  Telegram Bot    |===> |   LLM Router    |
|                 |     |   (Telegraf)     |     |  (OpenRouter)   |
+-----------------+     +------------------+     +-----------------+
                                                           |
                              +---------------------------+---------------------------+
                              |                           |                           |
                         +----+----+            +---------+-----------+          +-----+------+
                         |         |            |                    |          |            |
                         |Transaction|          |   API Caller       |          | Event Watcher|
                         |  Builder  |          |  (Query Tools)     |          |   (Alerts)  |
                         |         |            |                    |          |            |
                         +----+----+            +---------+-----------+          +-----+------+
                              |                           |                           |
                         +----+----+            +---------+-----------+
                         |         |            |                    |
                         | Blockchain|          |   Points API       |
                         |   (RISE)  |          |  (External API)    |
                         |         |            |                    |
                         +---------+            +--------------------+
```
## Natural Language Processing Pipeline

### 1. Message Reception
When a user sends a message to the Telegram bot:
```typescript
bot.on('text', async (ctx) => {
  const message = ctx.message.text;
  const telegramId = ctx.from.id.toString();
  // Process message through LLM router
});
```

### 2. LLM Router (`src/llm/router.ts`)

The LLM Router is the brain of the system, using OpenAI-compatible models via OpenRouter.

#### Key Components:

**a) Tool Schema Definition**
```typescript
const ToolCallSchema = z.discriminatedUnion("tool", [
  // Transaction tools
  z.object({
    tool: z.literal("mint"),
    params: z.object({
      tokenSymbol: z.enum(["MockUSD", "MockToken"]),
    }),
  }),
  z.object({
    tool: z.literal("swap"),
    params: z.object({
      fromToken: z.enum(["MockUSD", "MockToken"]),
      toToken: z.enum(["MockUSD", "MockToken"]),
      amount: z.string(),
      slippagePercent: z.number().optional(),
    }),
  }),
  // Query tools
  z.object({
    tool: z.literal("get_balances"),
    params: z.object({
      address: z.string(),
    }),
  }),
  // ... more tools
]);
```

**b) Context-Aware Processing**
```typescript
const response = await openai.chat.completions.create({
  model: "openai/gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: `You are a transaction router for the RISE chain Telegram bot. 
                User identity is bound to a RISE account: ${userAddress}.
                Available tools: mint, transfer, swap, get_balances, etc.`
    },
    {
      role: "user",
      content: userMessage
    }
  ],
  response_format: { type: "json_object" }
});
```

### 3. Intent Classification & Parameter Extraction

The LLM analyzes the user's message and returns structured data:

**Example Flow:**
- User: "swap 10 MockUSD for MockToken with 2% slippage"
- LLM Output:
```json
{
  "tool": "swap",
  "params": {
    "fromToken": "MockUSD",
    "toToken": "MockToken",
    "amount": "10",
    "slippagePercent": 2
  }
}
```

### 4. Tool Execution

Based on the selected tool, the appropriate handler is invoked:

#### Transaction Tools (`src/tools/transactionBuilder.ts`)
- **mint**: Creates test tokens
- **transfer**: Sends tokens to addresses
- **swap**: Exchanges tokens via UniswapV2

#### Query Tools (`src/tools/apiCaller.ts`)
- **get_balances**: Fetches token balances from points-api
- **get_transactions**: Retrieves transaction history
- **get_wallet_summary**: Shows total portfolio value

#### Alert Tools (`src/tools/eventWatcher.ts`)
- **create_alert**: Sets up price/balance alerts
- **list_alerts**: Shows active alerts

### 5. Response Generation

The tool execution results are formatted for the user:
```typescript
if (tool === "get_balances") {
  return `**Wallet Balances**\n
Total Value: ${result.totalUsdValue}\n
${result.balances.map(b => `${b.token}: ${b.balance}`).join('\n')}`;
}
```

## Security Architecture

### 1. Verification Flow
```
User => Telegram Bot => Frontend => Wallet Signature => Backend Verification => Account Link
```

### 2. Permission System
- Users grant specific permissions to backend EOA
- All transactions require verified account
- Permissions have expiry timestamps

### 3. Transaction Security
- No private keys stored in bot
- Backend EOA executes transactions
- Verification via cryptographic signatures

## Data Storage

### File-Based Storage (`src/services/storage.ts`)
Using fly.io volumes for persistence:
```
data/
  verified-links/      # User verification records
  permissions/         # Granted permissions
  conversations/       # Chat sessions
  messages/            # Chat history
  tool-executions/     # Audit trail
```

## External Integrations

### 1. OpenRouter API
- Model: GPT-4o mini (default)
- Alternative: Sherlock Think Alpha
- Structured JSON outputs
- Temperature: 0.2 for consistency

### 2. Points API
- Base URL: `https://points-api.marble.live`
- Endpoints:
  - `/balances/{address}`
  - `/calls/{address}`
  - `/positions/{address}`
  - `/wallet-summary/{address}`

### 3. RISE Blockchain
- RPC URL: `https://testnet.riselabs.xyz`
- Chain ID: 717175
- Native token: RISE

## Error Handling

### 1. LLM Errors
- Fallback responses for parsing failures
- Retry logic for API timeouts
- User-friendly error messages

### 2. Blockchain Errors
- Slippage protection
- Gas estimation
- Transaction revert handling

### 3. API Errors
- Graceful degradation
- Cached responses
- Rate limit handling

## Performance Optimizations

### 1. Caching
- User verification status
- Recent API responses
- Transaction receipts

### 2. Concurrent Processing
- Parallel tool execution
- Batch API calls
- Async message handling

### 3. Resource Management
- Connection pooling
- Memory-efficient storage
- Automatic cleanup

## Monitoring & Logging

### 1. Transaction Audit Trail
Every tool execution is logged:
```typescript
{
  id: string;
  conversationId: string;
  toolName: string;
  params: any;
  result: any;
  success: boolean;
  timestamp: number;
  transactionHash?: string;
}
```

### 2. Error Tracking
- Failed transactions
- LLM parsing errors
- API failures

### 3. Usage Analytics
- Popular commands
- User engagement
- Success rates

## Future Architecture Enhancements

### 1. Session Key Implementation
Replace backend EOA with per-user session keys:
```
User Wallet => Session Key => Smart Account => Transaction
```

### 2. Multi-Model Support
- Model selection based on query complexity
- Specialized models for different tasks
- Cost optimization

### 3. Advanced NLP Features
- Multi-turn conversations
- Context awareness
- Intent prediction
- Proactive suggestions

### 4. Scalability
- Horizontal scaling with Redis
- WebSocket connections
- Message queuing
- Load balancing