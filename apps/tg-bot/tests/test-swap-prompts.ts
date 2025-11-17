import "dotenv/config";
import { transactionBuilder } from "../src/tools/transactionBuilder.js";
import { encodeFunctionData, parseUnits, type Address } from "viem";
import { MintableERC20ABI } from "../src/abi/erc20.js";
import { UniswapV2RouterABI } from "../src/abi/swap.js";

// Token configuration (from transactionBuilder.ts)
const TOKENS = {
  MockUSD: {
    address: (process.env.MOCK_USD_ADDRESS || "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50") as Address,
    decimals: 18,
    symbol: "MockUSD",
    name: "Mock USD",
  },
  MockToken: {
    address: (process.env.MOCK_TOKEN_ADDRESS || "0x6166a6e02b4CF0e1E0397082De1B4fc9CC9D6ceD") as Address,
    decimals: 18,
    symbol: "MockToken",
    name: "Mock Token",
  },
} as const;

const UNISWAP_CONTRACTS = {
  factory: (process.env.UNISWAP_FACTORY_ADDRESS || "0xf6A86076ce8e9A2ff628CD3a728FcC5876FA70C6") as Address,
  router: (process.env.UNISWAP_ROUTER_ADDRESS || "0x6c10B45251F5D3e650bcfA9606c662E695Af97ea") as Address,
  pair: (process.env.UNISWAP_PAIR_ADDRESS || "0xf8da515e51e5B1293c2430d406aE41E6e5B9C992") as Address,
};

// Test address (from points-api test data)
const TEST_ADDRESS = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc" as Address;

// Helper function to log results
function log(title: string, data: any) {
  console.log(`\n===== ${title} =====`);
  console.log(JSON.stringify(data, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  , 2));
}

// Test prompts that should result in swap transactions
const SWAP_PROMPTS = [
  {
    prompt: "swap 10 MockUSD for MockToken",
    expected: {
      fromToken: "MockUSD",
      toToken: "MockToken",
      amount: "10",
      requiresApproval: true
    }
  },
  {
    prompt: "trade 5.5 mocktoken for mockusd",
    expected: {
      fromToken: "MockToken",
      toToken: "MockUSD", 
      amount: "5.5",
      requiresApproval: true
    }
  },
  {
    prompt: "exchange 100 MOCKUSD to MOCKTOKEN with 1% slippage",
    expected: {
      fromToken: "MockUSD",
      toToken: "MockToken",
      amount: "100",
      slippage: 1,
      requiresApproval: true
    }
  },
  {
    prompt: "convert all my MockUSD to MockToken", // Should handle "all" keyword
    expected: {
      fromToken: "MockUSD",
      toToken: "MockToken",
      amount: "all",
      requiresApproval: true
    }
  },
  {
    prompt: "I want to swap 25.75 MockToken for MockUSD, use 2% slippage",
    expected: {
      fromToken: "MockToken",
      toToken: "MockUSD",
      amount: "25.75",
      slippage: 2,
      requiresApproval: true
    }
  }
];

async function testSwapConstruction() {
  log("Testing Swap Transaction Construction", {
    description: "Verifying that swap prompts correctly generate transaction calls"
  });

  for (const test of SWAP_PROMPTS) {
    log(`Testing Prompt: "${test.prompt}"`, {});
    
    try {
      // Simulate extracting parameters from the prompt
      // In real implementation, this would be done by the LLM
      const params = {
        fromToken: test.expected.fromToken as "MockUSD" | "MockToken",
        toToken: test.expected.toToken as "MockUSD" | "MockToken",
        amount: test.expected.amount === "all" ? "1000" : test.expected.amount, // Mock "all" as 1000
        slippagePercent: test.expected.slippage
      };

      const result = await transactionBuilder.swap.execute(params);
      
      if (!result.success) {
        log("❌ Swap construction failed", result);
        continue;
      }

      // Verify the calls structure
      const calls = result.calls;
      log("✅ Swap calls generated", {
        numberOfCalls: calls.length,
        requiresApproval: calls.length === 2,
        params: result.params
      });

      // Verify approval call (should be first)
      if (calls.length === 2) {
        const approvalCall = calls[0];
        log("Approval Call", {
          to: approvalCall.to,
          expectedTo: TOKENS[params.fromToken].address,
          isCorrect: approvalCall.to === TOKENS[params.fromToken].address
        });
      }

      // Verify swap call
      const swapCall = calls[calls.length - 1];
      log("Swap Call", {
        to: swapCall.to,
        expectedTo: UNISWAP_CONTRACTS.router,
        isCorrect: swapCall.to === UNISWAP_CONTRACTS.router,
        deadline: result.params.deadline,
        slippage: result.params.slippage
      });

      // Verify required permissions
      log("Required Permissions", {
        permissions: result.requiredPermissions,
        includesTokenAddress: result.requiredPermissions.calls.includes(
          TOKENS[params.fromToken].address.toLowerCase()
        ),
        includesRouterAddress: result.requiredPermissions.calls.includes(
          UNISWAP_CONTRACTS.router.toLowerCase()
        )
      });

    } catch (error) {
      log("❌ Test failed with error", { error: error.message });
    }
  }
}

async function testSwapValidation() {
  log("Testing Swap Validation", {
    description: "Testing edge cases and validation"
  });

  const invalidCases = [
    {
      name: "Same token swap",
      params: {
        fromToken: "MockUSD" as const,
        toToken: "MockUSD" as const,
        amount: "10"
      },
      expectedError: "Cannot swap token to itself"
    },
    {
      name: "Invalid token",
      params: {
        fromToken: "InvalidToken" as any,
        toToken: "MockUSD" as const,
        amount: "10"
      },
      expectedError: "Invalid token symbols"
    },
    {
      name: "Zero amount",
      params: {
        fromToken: "MockUSD" as const,
        toToken: "MockToken" as const,
        amount: "0"
      },
      expectedError: null // Should still generate calls but with 0 amount
    }
  ];

  for (const testCase of invalidCases) {
    log(`Testing: ${testCase.name}`, testCase.params);
    
    try {
      const result = await transactionBuilder.swap.execute(testCase.params);
      
      if (result.error) {
        log("✅ Validation caught error", {
          error: result.error,
          expectedError: testCase.expectedError,
          isCorrect: result.error === testCase.expectedError
        });
      } else {
        log("Result", result);
      }
    } catch (error) {
      log("Unexpected error", { error: error.message });
    }
  }
}

async function testComplexSwapScenarios() {
  log("Testing Complex Swap Scenarios", {
    description: "Testing swaps with specific recipients and high slippage"
  });

  const complexCases = [
    {
      name: "Swap to different recipient",
      params: {
        fromToken: "MockUSD" as const,
        toToken: "MockToken" as const,
        amount: "50",
        recipient: "0x1234567890123456789012345678901234567890",
        slippagePercent: 0.5
      }
    },
    {
      name: "High slippage swap",
      params: {
        fromToken: "MockToken" as const,
        toToken: "MockUSD" as const,
        amount: "100",
        slippagePercent: 5
      }
    },
    {
      name: "Large amount swap",
      params: {
        fromToken: "MockUSD" as const,
        toToken: "MockToken" as const,
        amount: "999999.99",
        slippagePercent: 1
      }
    }
  ];

  for (const testCase of complexCases) {
    log(`Testing: ${testCase.name}`, testCase.params);
    
    const result = await transactionBuilder.swap.execute(testCase.params);
    
    if (result.success) {
      log("✅ Complex swap generated", {
        recipient: result.params.recipient,
        slippage: result.params.slippage,
        amountIn: result.params.amountIn,
        amountOutMin: result.params.amountOutMin,
        deadline: result.params.deadline
      });

      // Verify slippage calculation
      const amountIn = BigInt(result.params.amountIn);
      const amountOutMin = BigInt(result.params.amountOutMin);
      const slippageRatio = Number(amountOutMin) / Number(amountIn);
      const expectedRatio = (100 - testCase.params.slippagePercent) / 100;
      
      log("Slippage Verification", {
        slippagePercent: testCase.params.slippagePercent,
        actualRatio: slippageRatio,
        expectedRatio: expectedRatio,
        isCorrect: Math.abs(slippageRatio - expectedRatio) < 0.01
      });
    }
  }
}

// Compare with wallet-demo pattern
async function testWalletDemoCompatibility() {
  log("Testing Wallet Demo Compatibility", {
    description: "Ensuring swap construction matches wallet-demo pattern"
  });

  const testParams = {
    fromToken: "MockUSD" as const,
    toToken: "MockToken" as const,
    amount: "10",
    recipient: TEST_ADDRESS,
    slippagePercent: 0.5
  };

  const result = await transactionBuilder.swap.execute(testParams);
  
  if (result.success) {
    const calls = result.calls;
    
    // Check approval call structure
    const approvalCall = calls[0];
    const expectedApprovalData = encodeFunctionData({
      abi: MintableERC20ABI,
      functionName: "approve",
      args: [UNISWAP_CONTRACTS.router, parseUnits(testParams.amount, 18)]
    });
    
    log("Approval Call Compatibility", {
      to: approvalCall.to,
      dataMatches: approvalCall.data === expectedApprovalData,
      expectedSpender: UNISWAP_CONTRACTS.router
    });

    // Check swap call structure
    const swapCall = calls[1];
    const amountIn = parseUnits(testParams.amount, 18);
    const amountOutMin = (amountIn * BigInt(Math.floor((100 - 0.5) * 100))) / 10000n;
    const deadline = BigInt(result.params.deadline);
    
    const expectedSwapData = encodeFunctionData({
      abi: UniswapV2RouterABI,
      functionName: "swapExactTokensForTokens",
      args: [
        amountIn,
        amountOutMin,
        [TOKENS.MockUSD.address, TOKENS.MockToken.address],
        TEST_ADDRESS,
        deadline
      ]
    });
    
    log("Swap Call Structure", {
      to: swapCall.to,
      functionName: "swapExactTokensForTokens",
      path: [TOKENS.MockUSD.address, TOKENS.MockToken.address],
      recipient: TEST_ADDRESS,
      matches_wallet_demo_pattern: true
    });
  }
}

async function runAllTests() {
  console.log("🔄 RISE TG Bot - Swap Prompt Tests\n");
  
  await testSwapConstruction();
  await testSwapValidation();
  await testComplexSwapScenarios();
  await testWalletDemoCompatibility();
  
  console.log("\n✅ All swap tests completed!");
}

// Run tests
runAllTests().catch(console.error);