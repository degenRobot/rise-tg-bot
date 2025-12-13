import "dotenv/config";
import { readTools } from "../src/tools/readTools.js";
import type { Address } from "viem";

// Test address from points-api
const TEST_ADDRESS = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc" as Address;
const POINTS_API_URL = process.env.POINTS_API_URL || "https://points-api.marble.live";

// Helper function to log results
function log(title: string, data: any) {
  console.log(`\n===== ${title} =====`);
  console.log(JSON.stringify(data, null, 2));
}

// Test various query prompts
const QUERY_PROMPTS = [
  // Balance queries
  {
    category: "Balance Queries",
    prompts: [
      "what's my balance",
      "show me my tokens",
      "how much MockUSD do I have",
      "check my wallet balance",
      "what tokens do I own",
      "show balance for 0x07b780E6D4D7177bd596e7caBf2725a471E685Dc"
    ],
    expectedTool: "get_balances"
  },
  // Transaction history queries
  {
    category: "Transaction History",
    prompts: [
      "show my recent transactions",
      "what did I do yesterday",
      "show last 5 transactions",
      "transaction history",
      "what transfers have I made",
      "show my activity"
    ],
    expectedTool: "get_transactions"
  },
  // Portfolio/Position queries
  {
    category: "Portfolio Positions", 
    prompts: [
      "show my DeFi positions",
      "what protocols am I using",
      "check my liquidity positions",
      "show my portfolio",
      "what's my exposure to UniSwap"
    ],
    expectedTool: "get_positions"
  },
  // Wallet summary queries
  {
    category: "Wallet Summary",
    prompts: [
      "what's my total portfolio value",
      "how much am I worth",
      "give me a wallet summary",
      "total value of my assets",
      "portfolio overview",
      "how much money do I have in total"
    ],
    expectedTool: "get_wallet_summary"
  }
];

async function testBalanceQueries() {
  log("Testing Balance Queries", {
    address: TEST_ADDRESS,
    description: "Testing various balance-related prompts"
  });

  try {
    const resultString = await readTools.getBalances.execute({ address: TEST_ADDRESS }, {
      sessionID: "test",
      messageID: "test",
      agent: "test",
      abort: new AbortController().signal
    });
    const result = JSON.parse(resultString);

    if (result.success) {
      log("✅ Balance Query Successful", {
        totalValue: result.totalUsdValue,
        tokenCount: result.count,
        sampleBalances: result.balances.slice(0, 3)
      });

      // Verify response structure
      if (result.balances.length > 0) {
        const firstBalance = result.balances[0];
        log("Balance Structure", {
          hasToken: !!firstBalance.token,
          hasBalance: !!firstBalance.balance,
          hasUsdValue: !!firstBalance.usdValue,
          hasPrice: !!firstBalance.price
        });
      }
    } else {
      log("❌ Balance Query Failed", result);
    }
  } catch (error) {
    log("❌ Error in balance query", { error: error instanceof Error ? error.message : String(error) });
  }
}

async function testTransactionQueries() {
  log("Testing Transaction History Queries", {
    address: TEST_ADDRESS,
    description: "Testing transaction history retrieval"
  });

  try {
    // Test with different limits
    const limits = [5, 10, 20];
    
    for (const limit of limits) {
      const resultString = await readTools.getTransactionHistory.execute({
        address: TEST_ADDRESS,
        limit
      }, {
        sessionID: "test",
        messageID: "test",
        agent: "test",
        abort: new AbortController().signal
      });
      const result = JSON.parse(resultString);

      if (result.success) {
        log(`✅ Transaction Query (limit: ${limit})`, {
          returnedCount: result.transactions.length,
          totalCount: result.totalCount,
          hasMore: result.hasMore
        });

        // Check first transaction structure
        if (result.transactions.length > 0) {
          const firstTx = result.transactions[0];
          log("Transaction Structure", {
            hasHash: !!firstTx.txHash,
            hasTimestamp: !!firstTx.timestamp,
            hasSuccess: typeof firstTx.success === 'boolean',
            callsCount: firstTx.callsCount,
            sampleCall: firstTx.calls[0]
          });
        }
      }
    }
  } catch (error) {
    log("❌ Error in transaction query", { error: error instanceof Error ? error.message : String(error) });
  }
}

async function testPositionQueries() {
  log("Testing Portfolio Position Queries", {
    address: TEST_ADDRESS,
    description: "Testing DeFi position retrieval"
  });

  try {
    const resultString = await readTools.getPortfolioPositions.execute({
      address: TEST_ADDRESS
    }, {
      sessionID: "test",
      messageID: "test",
      agent: "test",
      abort: new AbortController().signal
    });
    const result = JSON.parse(resultString);

    if (result.success) {
      log("✅ Position Query Successful", {
        positionCount: result.positions.length,
        totalValue: result.totalValue
      });

      // Check position structure
      if (result.positions.length > 0) {
        const firstPosition = result.positions[0];
        log("Position Structure", {
          hasProtocol: !!firstPosition.protocol,
          hasAssetPair: !!firstPosition.assetPair,
          hasUsdValue: !!firstPosition.usdValue,
          hasApy: firstPosition.apy !== undefined,
          protocolDetails: {
            name: firstPosition.protocol.name,
            category: firstPosition.protocol.category,
            verified: firstPosition.protocol.verified
          }
        });
      } else {
        log("No DeFi positions found", {});
      }
    } else {
      log("❌ Position Query Failed", result);
    }
  } catch (error) {
    log("❌ Error in position query", { error: error instanceof Error ? error.message : String(error) });
  }
}

async function testWalletSummaryQueries() {
  log("Testing Wallet Summary Queries", {
    address: TEST_ADDRESS,
    description: "Testing comprehensive wallet summary"
  });

  try {
    const resultString = await readTools.getWalletSummary.execute({
      address: TEST_ADDRESS
    }, {
      sessionID: "test",
      messageID: "test",
      agent: "test",
      abort: new AbortController().signal
    });
    const result = JSON.parse(resultString);

    if (result.success) {
      log("✅ Wallet Summary Query Successful", {
        totalValue: result.totalValue,
        breakdown: result.breakdown
      });

      // Verify summary completeness
      log("Summary Breakdown Verification", {
        hasTokenValue: !!result.breakdown.tokens.value,
        hasTokenCount: typeof result.breakdown.tokens.count === 'number',
        hasProtocolValue: !!result.breakdown.protocols.value,
        hasProtocolCount: typeof result.breakdown.protocols.count === 'number'
      });
    } else {
      log("❌ Wallet Summary Query Failed", result);
    }
  } catch (error) {
    log("❌ Error in wallet summary query", { error: error instanceof Error ? error.message : String(error) });
  }
}

async function testQueryEdgeCases() {
  log("Testing Query Edge Cases", {
    description: "Testing various edge cases for queries"
  });

  const edgeCases = [
    {
      name: "Invalid address format",
      tool: "getBalances",
      params: { address: "invalid-address" }
    },
    {
      name: "Non-existent address", 
      tool: "getBalances",
      params: { address: "0x0000000000000000000000000000000000000000" }
    },
    {
      name: "Address with no transactions",
      tool: "getTransactionHistory",
      params: { address: "0x0000000000000000000000000000000000000001" }
    },
    {
      name: "Very high limit",
      tool: "getTransactionHistory", 
      params: { address: TEST_ADDRESS, limit: 1000 }
    }
  ];

  for (const testCase of edgeCases) {
    log(`Testing: ${testCase.name}`, testCase.params);

    try {
      const tool = readTools[testCase.tool as keyof typeof readTools];
      const resultString = await tool.execute(testCase.params as any, {
        sessionID: "test",
        messageID: "test",
        agent: "test",
        abort: new AbortController().signal
      });
      const result = JSON.parse(resultString);

      log("Result", {
        success: result.success,
        error: result.error,
        hasData: !result.error
      });
    } catch (error) {
      log("Caught error", { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

async function testMultipleAddresses() {
  log("Testing Multiple Address Queries", {
    description: "Testing queries for different addresses"
  });

  const addresses = [
    "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc", // Original test address
    "0x038AEBDbDEcd7F4604Fd6902b40BE063e5fc3f7B", // Backend signer
    "0x1234567890123456789012345678901234567890"  // Random address
  ];

  for (const address of addresses) {
    log(`Querying address: ${address}`, {});
    
    try {
      const context = {
        sessionID: "test",
        messageID: "test",
        agent: "test",
        abort: new AbortController().signal
      };
      const balanceResultString = await readTools.getBalances.execute({ address }, context);
      const summaryResultString = await readTools.getWalletSummary.execute({ address }, context);
      const balanceResult = JSON.parse(balanceResultString);
      const summaryResult = JSON.parse(summaryResultString);
      
      log("Query Results", {
        address,
        hasBalances: balanceResult.success && balanceResult.count > 0,
        totalValue: summaryResult.success ? summaryResult.totalValue : "N/A",
        tokenCount: balanceResult.success ? balanceResult.count : 0
      });
    } catch (error) {
      log("Error querying address", { address, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

async function testPromptMapping() {
  log("Testing Prompt to Tool Mapping", {
    description: "Simulating how different prompts would map to tools"
  });

  for (const category of QUERY_PROMPTS) {
    log(`Category: ${category.category}`, {
      expectedTool: category.expectedTool,
      promptCount: category.prompts.length
    });

    for (const prompt of category.prompts) {
      log(`Prompt: "${prompt}"`, {
        shouldMap: category.expectedTool,
        // In real implementation, the LLM would determine this
        sampleParams: {
          address: TEST_ADDRESS,
          ...(category.expectedTool === "get_transactions" ? { limit: 10 } : {})
        }
      });
    }
  }
}

async function runAllTests() {
  console.log("📊 RISE TG Bot - Query Prompt Tests\n");
  console.log(`Using test address: ${TEST_ADDRESS}`);
  console.log(`API URL: ${POINTS_API_URL}\n`);
  
  await testBalanceQueries();
  await testTransactionQueries();
  await testPositionQueries();
  await testWalletSummaryQueries();
  await testQueryEdgeCases();
  await testMultipleAddresses();
  await testPromptMapping();
  
  console.log("\n✅ All query tests completed!");
}

// Run tests
runAllTests().catch(console.error);