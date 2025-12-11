import "dotenv/config";
import { createLlmRouter } from "../src/llm/router.js";
import {
  createVerificationMessage,
  verifyAndLinkAccount,
  getVerifiedAccount
} from "../src/services/verification.js";
import { privateKeyToAccount, signMessage } from "viem/accounts";
import type { Address } from "viem";

// Test account (using a test private key)
const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);

// Test user data
const TEST_USER = {
  telegramId: "123456789",
  telegramHandle: "testuser",
  accountAddress: testAccount.address,
};

// Helper to log test results
function log(message: string, data?: any) {
  console.log(`\n[TEST] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    , 2));
  }
}

async function testVerificationFlow() {
  log("Starting Verification Flow Test");

  // Step 1: Generate verification message
  log("1. Generating verification message");
  const { message, data } = createVerificationMessage(
    TEST_USER.telegramId,
    TEST_USER.telegramHandle
  );
  log("Generated message:", { message, data });

  // Step 2: Sign the message
  log("2. Signing message with test account");
  const signature = await signMessage({
    message,
    privateKey: TEST_PRIVATE_KEY,
  });
  log("Signature generated:", signature);

  // Step 3: Verify and link account
  log("3. Verifying signature and linking account");
  const verifyResult = await verifyAndLinkAccount({
    address: TEST_USER.accountAddress,
    signature,
    message,
    telegramId: TEST_USER.telegramId,
    telegramHandle: TEST_USER.telegramHandle,
  });
  log("Verification result:", verifyResult);

  // Step 4: Check if account is verified
  log("4. Checking verification status");
  const verifiedAccount = await getVerifiedAccount(TEST_USER.telegramId);
  log("Verified account:", verifiedAccount);

  return verifyResult.success;
}

async function testLLMRouter() {
  log("Starting LLM Router Tests");
  
  const llmRouter = createLlmRouter();
  const mockSessionKey = { permissions: { calls: ["0x1234..."] } }; // Mock session key

  // Test scenarios
  const testCases = [
    {
      name: "Check Balance",
      message: "What's my balance?",
      expectSuccess: true,
    },
    {
      name: "Recent Transactions",
      message: "Show me my recent transactions",
      expectSuccess: true,
    },
    {
      name: "Wallet Summary",
      message: "Give me a summary of my wallet",
      expectSuccess: true,
    },
    {
      name: "Transfer Request",
      message: "Send 10 MockUSD to 0x1234567890123456789012345678901234567890",
      expectSuccess: true,
    },
    {
      name: "Mint Tokens",
      message: "Mint some MockToken",
      expectSuccess: true,
    },
    {
      name: "Swap Tokens",
      message: "Swap 5 MockUSD for MockToken",
      expectSuccess: true,
    },
    {
      name: "Create Alert",
      message: "Alert me when RISE goes below 100",
      expectSuccess: true,
    },
    {
      name: "Ambiguous Request",
      message: "Help me with my tokens",
      expectSuccess: true,
    },
  ];

  for (const testCase of testCases) {
    log(`\nTesting: ${testCase.name}`);
    log(`User message: "${testCase.message}"`);

    try {
      const response = await llmRouter.handleMessage({
        telegramId: TEST_USER.telegramId,
        text: testCase.message,
        userAddress: TEST_USER.accountAddress as Address,
        sessionKey: mockSessionKey,
      });

      log("Bot response:", response);

      if (!response || response.includes("error")) {
        log("❌ Test failed: Error in response");
      } else {
        log("✅ Test passed");
      }
    } catch (error) {
      log("❌ Test failed with exception:", error);
    }
  }
}

// Transaction construction and storage tests removed - these modules no longer exist
// TODO: Add new tests for backendSwapService and backendTransactionService if needed

async function runAllTests() {
  console.log("🚀 Starting End-to-End Tests for RISE TG Bot\n");

  try {
    // Test 1: Verification Flow
    const verificationSuccess = await testVerificationFlow();
    if (!verificationSuccess) {
      log("❌ Verification failed, skipping remaining tests");
      return;
    }

    // Test 2: LLM Router (requires OpenRouter API key)
    if (process.env.OPENROUTER_API_KEY) {
      await testLLMRouter();
    } else {
      log("⚠️ Skipping LLM Router tests - OPENROUTER_API_KEY not set");
    }

    log("\n✅ All tests completed!");

  } catch (error) {
    log("❌ Test suite failed:", error);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);