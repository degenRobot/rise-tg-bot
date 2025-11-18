# RISE Telegram Bot Tests

## 🧪 Active Tests

### **Core Backend Tests** ⚡
- **`test-rise-relay-client.ts`** - Main test for RISE relay client backend (✅ Working)
- **`test-unique-transaction.ts`** - Test unique transactions to avoid duplicate errors

### **Integration Tests** 🔄
- **`test-end-to-end-flow.ts`** - Full transaction flow testing
- **`test-real-signature.ts`** - Real signature verification
- **`test-smart-wallet-verification.ts`** - Smart wallet verification
- **`test-wallet-signing.ts`** - Wallet signing functionality

### **Bot Tests** 🤖
- **`test-api-endpoints.ts`** - Test API endpoint functionality  
- **`test-bot-flow.ts`** - Test complete bot conversation flow
- **`test-e2e.ts`** - End-to-end testing
- **`test-signature.ts`** - Test signature verification
- **`test-tools.ts`** - Test bot tools and integrations
- **`test-basic.js`** - Basic functionality tests

### **Development Tests** 🔧
- **`test-bot-lookup.ts`** - Bot user lookup functionality
- **`test-improved-router.ts`** - LLM router improvements
- **`test-llm-routing.ts`** - Language model routing
- **`test-query-prompts.ts`** - Query prompt testing
- **`test-rise-wallet-pattern.ts`** - RISE wallet pattern testing
- **`test-swap-prompts.ts`** - Swap prompt testing

### **Test Runner** 🎯
- **`run-all-tests.sh`** - Test runner script

## 📁 Archived Tests (`archive/`)

Historical and debugging tests that are no longer actively used but kept for reference:

- `test-backend-wagmi.ts` - Old wagmi backend (replaced by relay client)
- `test-porto-connector.ts` - Porto connector tests (replaced by relay client) 
- `test-session-key-signing.ts` - Session key signing (integrated into transaction service)
- `test-wallet-demo-pattern.ts` - Wallet demo patterns (integrated into transaction service)
- `test-sendpreparedcalls-debug.ts` - SendPreparedCalls debugging (issue resolved)
- `test-signature-debug.ts` - Signature debugging (issue resolved)
- `debug-rise-signing.ts` - RISE signing debugging (issue resolved)
- `test-direct-rise.ts` - Direct RISE service (replaced by relay client)
- `test-backend-wallet.ts` - Backend wallet testing (replaced by transaction service)
- `prompt-examples.md` - Historical prompt examples
- `parse-signature.ts` - Signature parsing utilities
- `test-edge-cases.ts` - Edge case testing

## 🚀 Running Tests

```bash
# Run all active tests
./run-all-tests.sh

# Run specific test
npx tsx test-rise-relay-client.ts

# Run main backend test
npx tsx test-rise-relay-client.ts
```

## 📊 Test Status

- ✅ **Backend Transaction Service**: Fully working with RISE relay client
- ✅ **Session Key Management**: P256 key generation and signing working
- ✅ **Permission System**: Integration with frontend permission granting
- ⚡ **Current Focus**: Frontend permission granting workflow

## 🔧 Test Environment

- **Network**: RISE Testnet (Chain ID: 11155931)
- **Test User**: `0x07b780E6D4D7177bd596e7caBf2725a471E685Dc` 
- **Backend Signer**: `0x038AEBDbDEcd7F4604Fd6902b40BE063e5fc3f7B`
- **Test Tokens**: MockUSD, MockToken
- **Router**: Uniswap V2 compatible

**Test Address**: `0x07b780E6D4D7177bd596e7caBf2725a471E685Dc` (Consistent across all tests)

**Test Tokens**:
- MockUSD: `0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50`
- MockToken: `0x6166a6e02b4CF0e1E0397082De1B4fc9CC9D6ceD`

**Uniswap Contracts**:
- Router: `0x6c10B45251F5D3e650bcfA9606c662E695Af97ea`
- Factory: `0xf6A86076ce8e9A2ff628CD3a728FcC5876FA70C6`

## 📝 Notes

- Use `test-rise-relay-client.ts` as the primary integration test
- "Duplicate call" errors indicate successful backend operation  
- "Invalid precall" errors indicate permissions need to be granted via frontend
- All archived tests are kept for historical reference and debugging context

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