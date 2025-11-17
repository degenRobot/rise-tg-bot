# RISE TG Bot Test Suite

This directory contains comprehensive tests for the RISE Telegram bot's natural language processing and tool routing capabilities.

## Test Files

### 1. `test-swap-prompts.ts`
Tests swap transaction construction to ensure compatibility with wallet-demo patterns.

**Key Test Cases:**
- Basic swaps: "swap 10 MockUSD for MockToken"
- Natural language: "trade 5.5 mocktoken for mockusd"
- With parameters: "exchange 100 MOCKUSD to MOCKTOKEN with 1% slippage"
- Edge cases: Same token swaps, zero amounts, invalid tokens

**Verifies:**
- Correct transaction call construction
- Approval + swap call sequence
- Permission requirements
- Slippage calculations
- Deadline handling

### 2. `test-query-prompts.ts`
Tests data query operations against the points-api endpoints.

**Key Test Cases:**
- Balance queries: "what's my balance", "show me my tokens"
- Transaction history: "show my recent transactions", "last 5 transactions"
- Portfolio positions: "show my DeFi positions", "what protocols am I using"
- Wallet summary: "total portfolio value", "how much am I worth"

**Verifies:**
- Correct API endpoint mapping
- Response structure validation
- Edge cases (invalid addresses, empty results)
- Multiple address queries

### 3. `test-llm-routing.ts`
Tests the LLM's ability to route prompts to appropriate tools.

**Key Test Cases:**
- Transaction routing: Mint, transfer, swap operations
- Query routing: Balance, transaction, portfolio queries
- Ambiguous prompts: "help me with my tokens"
- Unsupported operations: "stake my tokens", "buy NFT"
- Non-crypto requests: "what's the weather"

**Features:**
- Model comparison (GPT-4o mini, Sherlock Think Alpha, Claude)
- Structured output validation with Zod
- Parameter extraction testing
- Accuracy metrics

### 4. `test-edge-cases.ts`
Tests system behavior under edge conditions and error scenarios.

**Key Test Cases:**
- Invalid parameters: Negative amounts, malformed addresses
- Missing information: Incomplete commands
- Unverified users: Transaction attempts without verification
- Rate limiting: Rapid repeated requests
- Large numbers: Extreme amounts and precision
- Concurrent requests: Multiple simultaneous operations
- Error recovery: Network failures and retries

### 5. `test-improved-router.ts`
Advanced routing tests using Sherlock Think Alpha model.

**Features:**
- Deep intent analysis with confidence scores
- Entity extraction (tokens, amounts, addresses)
- Multi-step operation handling
- Tool chaining scenarios
- Error diagnosis and recovery guidance
- Conditional logic handling

## Test Data

**Test Address**: `0x07b780E6D4D7177bd596e7caBf2725a471E685Dc`
- Used consistently across all tests
- Has transaction history in points-api

**Test Tokens**:
- MockUSD: `0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50`
- MockToken: `0x6166a6e02b4CF0e1E0397082De1B4fc9CC9D6ceD`

**Uniswap Contracts**:
- Router: `0x6c10B45251F5D3e650bcfA9606c662E695Af97ea`
- Factory: `0xf6A86076ce8e9A2ff628CD3a728FcC5876FA70C6`

## Running Tests

```bash
# Install dependencies
cd apps/tg-bot
pnpm install

# Run individual test files
pnpm tsx tests/test-swap-prompts.ts
pnpm tsx tests/test-query-prompts.ts
pnpm tsx tests/test-llm-routing.ts
pnpm tsx tests/test-edge-cases.ts
pnpm tsx tests/test-improved-router.ts

# Run all tests (create a script if needed)
for test in tests/test-*.ts; do pnpm tsx "$test"; done
```

## Environment Requirements

Required environment variables:
```env
# For API tests
POINTS_API_URL=https://points-api.marble.live

# For LLM tests
OPENROUTER_API_KEY=sk-or-v1-...

# For transaction tests
RISE_RPC_URL=https://testnet.riselabs.xyz
BACKEND_SIGNER_PRIVATE_KEY=0x...
BACKEND_SIGNER_ADDRESS=0x038AEBDbDEcd7F4604Fd6902b40BE063e5fc3f7B
```

## Sample Prompts for Manual Testing

### Balance & Portfolio
- "what's my balance"
- "show me my MockUSD balance"
- "how much am I worth"
- "portfolio overview"

### Transactions
- "mint some MockUSD"
- "send 10 MockToken to 0x1234..."
- "swap 50 MockUSD for MockToken"
- "trade all my MockToken for MockUSD with 2% slippage"

### History & Activity
- "show my recent transactions"
- "what did I do yesterday"
- "last 5 swaps"

### Complex Requests
- "check my balance then swap half for MockToken"
- "if I have more than 100 MockUSD, send 50 to my friend"
- "mint tokens, swap some, and show me the result"

### Error Cases
- "stake my tokens" (unsupported)
- "buy bitcoin" (wrong chain)
- "send -10 tokens" (invalid amount)
- "what's the weather" (off-topic)

## Tool Flow Architecture

```
User Message → LLM Router → Tool Selection → Parameter Extraction
                    ↓
              Tool Execution
                    ↓
            Response Formatting → User
```

## Best Practices for Adding Tests

1. **Use consistent test data**: Stick to the standard test address and tokens
2. **Log clearly**: Use the `log()` helper for structured output
3. **Handle BigInt**: Use the custom JSON stringifier for BigInt values
4. **Test edge cases**: Always include validation and error scenarios
5. **Mock carefully**: When mocking APIs, ensure cleanup in finally blocks
6. **Rate limit**: Add delays between API calls to avoid rate limiting

## Future Test Additions

- Session key flow testing
- Permission validation tests
- Multi-user scenarios
- Gas estimation accuracy
- Transaction status tracking
- Alert system functionality
- DeFi position tracking