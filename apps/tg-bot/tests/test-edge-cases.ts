import "dotenv/config";
import { createLlmRouter } from "../src/llm/router.js";
import { transactionBuilder } from "../src/tools/transactionBuilder.js";
import { apiCaller } from "../src/tools/apiCaller.js";
import type { Address } from "viem";

// Test data
const TEST_ADDRESS = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc" as Address;
const TEST_TELEGRAM_ID = "123456789";

// Helper function to log results
function log(title: string, data: any) {
  console.log(`\n===== ${title} =====`);
  console.log(JSON.stringify(data, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  , 2));
}

// Edge case scenarios
const EDGE_CASE_PROMPTS = [
  // Unsupported operations
  {
    category: "Unsupported Operations",
    cases: [
      {
        prompt: "stake my MockUSD in the yield farm",
        reason: "Staking not implemented"
      },
      {
        prompt: "provide liquidity to MockUSD/MockToken pool",
        reason: "LP operations not implemented"
      },
      {
        prompt: "buy an NFT",
        reason: "NFT operations not supported"
      },
      {
        prompt: "bridge my tokens to Ethereum",
        reason: "Cross-chain operations not supported"
      },
      {
        prompt: "create a limit order for MockUSD at $1.05",
        reason: "Limit orders not supported"
      }
    ]
  },
  // Ambiguous requests
  {
    category: "Ambiguous Requests",
    cases: [
      {
        prompt: "help me",
        reason: "Too vague"
      },
      {
        prompt: "do something with my tokens",
        reason: "No specific action requested"
      },
      {
        prompt: "I need money",
        reason: "Unclear what action to take"
      },
      {
        prompt: "fix my wallet",
        reason: "No specific issue identified"
      }
    ]
  },
  // Invalid parameters
  {
    category: "Invalid Parameters",
    cases: [
      {
        prompt: "send -10 MockUSD to 0x1234",
        reason: "Negative amount"
      },
      {
        prompt: "swap MockUSD for USDC",
        reason: "USDC not in supported tokens"
      },
      {
        prompt: "transfer MockToken to invalid-address",
        reason: "Invalid address format"
      },
      {
        prompt: "swap 0 MockUSD for MockToken",
        reason: "Zero amount"
      },
      {
        prompt: "mint RealUSD",
        reason: "Token doesn't exist"
      }
    ]
  },
  // Missing information
  {
    category: "Missing Information",
    cases: [
      {
        prompt: "send MockUSD",
        reason: "Missing recipient and amount"
      },
      {
        prompt: "swap for MockToken",
        reason: "Missing source token and amount"
      },
      {
        prompt: "transfer to 0x1234567890123456789012345678901234567890",
        reason: "Missing token and amount"
      },
      {
        prompt: "check balance",
        reason: "Should work with user's address"
      }
    ]
  },
  // Non-crypto requests
  {
    category: "Non-Crypto Requests",
    cases: [
      {
        prompt: "what's the weather today",
        reason: "Not crypto related"
      },
      {
        prompt: "tell me a joke",
        reason: "Entertainment request"
      },
      {
        prompt: "calculate 2 + 2",
        reason: "Math request"
      },
      {
        prompt: "book a flight to Paris",
        reason: "Travel request"
      }
    ]
  }
];

async function testUnsupportedOperations() {
  log("Testing Unsupported Operations", {
    description: "Testing how the bot handles operations it doesn't support"
  });

  const llmRouter = createLlmRouter();

  for (const category of EDGE_CASE_PROMPTS) {
    if (category.category === "Unsupported Operations") {
      for (const testCase of category.cases) {
        log(`Testing: "${testCase.prompt}"`, {
          expectedReason: testCase.reason
        });

        try {
          const response = await llmRouter.handleMessage({
            telegramId: TEST_TELEGRAM_ID,
            text: testCase.prompt,
            userAddress: TEST_ADDRESS,
            sessionKey: { permissions: { calls: ["mock"] } }
          });

          log("Bot Response", {
            response: response.substring(0, 100) + "...",
            handledGracefully: !response.includes("Error") && !response.includes("failed")
          });
        } catch (error) {
          log("Error", { message: error.message });
        }
      }
    }
  }
}

async function testInvalidParameters() {
  log("Testing Invalid Parameters", {
    description: "Testing parameter validation"
  });

  // Test negative amounts
  try {
    const result = await transactionBuilder.transfer.execute({
      tokenSymbol: "MockUSD" as any,
      to: TEST_ADDRESS,
      amount: "-10"
    });
    log("Negative Amount Transfer", {
      expectedError: true,
      actualResult: result
    });
  } catch (error) {
    log("✅ Negative amount correctly rejected", { error: error.message });
  }

  // Test invalid token symbols
  try {
    const result = await transactionBuilder.swap.execute({
      fromToken: "InvalidToken" as any,
      toToken: "MockUSD" as any,
      amount: "10"
    });
    log("Invalid Token Swap", {
      expectedError: true,
      hasError: !!result.error,
      error: result.error
    });
  } catch (error) {
    log("✅ Invalid token correctly rejected", { error: error.message });
  }

  // Test malformed addresses
  const invalidAddresses = [
    "0x123", // Too short
    "123456789012345678901234567890123456789012", // No 0x prefix
    "0xGGGG567890123456789012345678901234567890", // Invalid hex
    "not-an-address",
    ""
  ];

  for (const invalidAddr of invalidAddresses) {
    try {
      const result = await transactionBuilder.transfer.execute({
        tokenSymbol: "MockUSD" as any,
        to: invalidAddr,
        amount: "10"
      });
      log(`Invalid Address: ${invalidAddr}`, {
        shouldFail: true,
        actualResult: result.success ? "Incorrectly succeeded" : result.error
      });
    } catch (error) {
      log(`✅ Invalid address correctly rejected: ${invalidAddr}`, {});
    }
  }
}

async function testMissingVerification() {
  log("Testing Missing Verification", {
    description: "Testing behavior when user is not verified"
  });

  const llmRouter = createLlmRouter();

  // Test transaction without verification
  const transactionPrompts = [
    "swap 10 MockUSD for MockToken",
    "send 5 MockToken to 0x1234567890123456789012345678901234567890",
    "mint some MockUSD"
  ];

  for (const prompt of transactionPrompts) {
    log(`Testing without verification: "${prompt}"`, {});

    const response = await llmRouter.handleMessage({
      telegramId: "unverified-user-123",
      text: prompt,
      userAddress: undefined, // No verified address
      sessionKey: undefined // No permissions
    });

    log("Response", {
      containsVerificationMessage: response.includes("verified") || response.includes("link"),
      response: response.substring(0, 150) + "..."
    });
  }
}

async function testRateLimiting() {
  log("Testing Rate Limiting Scenarios", {
    description: "Simulating rapid requests from same user"
  });

  const llmRouter = createLlmRouter();
  const rapidRequests = 10;
  const results = [];

  console.log(`Sending ${rapidRequests} rapid requests...`);

  for (let i = 0; i < rapidRequests; i++) {
    const start = Date.now();
    
    try {
      await llmRouter.handleMessage({
        telegramId: TEST_TELEGRAM_ID,
        text: "what's my balance",
        userAddress: TEST_ADDRESS,
        sessionKey: { permissions: { calls: ["mock"] } }
      });
      
      const duration = Date.now() - start;
      results.push({ 
        request: i + 1, 
        duration,
        success: true 
      });
    } catch (error) {
      results.push({ 
        request: i + 1, 
        error: error.message,
        success: false
      });
    }
  }

  log("Rate Limiting Results", {
    totalRequests: rapidRequests,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    averageResponseTime: Math.round(
      results.filter(r => r.duration).reduce((sum, r) => sum + r.duration, 0) / 
      results.filter(r => r.duration).length
    ) + "ms"
  });
}

async function testLargeAmounts() {
  log("Testing Large Amount Handling", {
    description: "Testing how the system handles very large numbers"
  });

  const largeAmounts = [
    "999999999", // Just under 1 billion
    "1000000000000000000", // 1e18 (1 token with 18 decimals)
    "99999999999999999999999", // Very large
    "0.000000000000000001", // Very small
    "123456789.123456789" // High precision
  ];

  for (const amount of largeAmounts) {
    try {
      const result = await transactionBuilder.transfer.execute({
        tokenSymbol: "MockUSD" as any,
        to: TEST_ADDRESS,
        amount
      });

      log(`Large Amount: ${amount}`, {
        success: result.success,
        amountWei: result.params?.amountWei,
        error: result.error
      });
    } catch (error) {
      log(`Large Amount Error: ${amount}`, { error: error.message });
    }
  }
}

async function testConcurrentRequests() {
  log("Testing Concurrent Request Handling", {
    description: "Testing multiple simultaneous requests"
  });

  const llmRouter = createLlmRouter();

  const concurrentPrompts = [
    { prompt: "what's my balance", expectedTool: "get_balances" },
    { prompt: "show my transactions", expectedTool: "get_transactions" },
    { prompt: "total portfolio value", expectedTool: "get_wallet_summary" },
    { prompt: "swap 10 MockUSD for MockToken", expectedTool: "swap" }
  ];

  console.log("Sending concurrent requests...");

  const promises = concurrentPrompts.map(async (test, index) => {
    const start = Date.now();
    try {
      const response = await llmRouter.handleMessage({
        telegramId: TEST_TELEGRAM_ID + index,
        text: test.prompt,
        userAddress: TEST_ADDRESS,
        sessionKey: { permissions: { calls: ["mock"] } }
      });
      
      return {
        prompt: test.prompt,
        duration: Date.now() - start,
        responseLength: response.length,
        success: true
      };
    } catch (error) {
      return {
        prompt: test.prompt,
        error: error.message,
        success: false
      };
    }
  });

  const results = await Promise.all(promises);

  log("Concurrent Request Results", {
    totalRequests: results.length,
    allSuccessful: results.every(r => r.success),
    averageResponseTime: Math.round(
      results.filter(r => r.duration).reduce((sum, r) => sum + r.duration, 0) / 
      results.filter(r => r.duration).length
    ) + "ms",
    results: results.map(r => ({
      prompt: r.prompt,
      success: r.success,
      duration: r.duration ? r.duration + "ms" : "N/A"
    }))
  });
}

async function testErrorRecovery() {
  log("Testing Error Recovery", {
    description: "Testing how the system recovers from errors"
  });

  // Simulate API failures
  const originalFetch = global.fetch;
  let callCount = 0;

  // Mock fetch to fail every other call
  global.fetch = async (...args) => {
    callCount++;
    if (callCount % 2 === 0) {
      throw new Error("Simulated network error");
    }
    return originalFetch(...args);
  };

  try {
    const results = [];
    
    for (let i = 0; i < 4; i++) {
      try {
        const result = await apiCaller.getBalances.execute({
          address: TEST_ADDRESS
        });
        results.push({
          attempt: i + 1,
          success: result.success,
          error: result.error
        });
      } catch (error) {
        results.push({
          attempt: i + 1,
          success: false,
          error: error.message
        });
      }
    }

    log("Error Recovery Results", {
      attempts: results,
      recoveryPattern: results.map(r => r.success ? "✅" : "❌").join(" ")
    });

  } finally {
    // Restore original fetch
    global.fetch = originalFetch;
  }
}

async function runAllTests() {
  console.log("🔧 RISE TG Bot - Edge Case Tests\n");
  
  await testUnsupportedOperations();
  await testInvalidParameters();
  await testMissingVerification();
  await testRateLimiting();
  await testLargeAmounts();
  await testConcurrentRequests();
  await testErrorRecovery();
  
  console.log("\n✅ All edge case tests completed!");
}

// Run tests
runAllTests().catch(console.error);