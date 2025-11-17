import "dotenv/config";
import { createLlmRouter } from "./src/llm/router.js";
import { storage } from "./src/services/storage.js";
import { 
  createVerificationMessage, 
  verifyAndLinkAccount,
  getVerifiedAccount 
} from "./src/services/verification.js";
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

async function testTransactionConstruction() {
  log("Starting Transaction Construction Tests");

  // Import transaction builder directly
  const { transactionBuilder } = await import("./src/tools/transactionBuilder.js");

  // Test mint
  log("\n1. Testing Mint Transaction");
  const mintResult = await transactionBuilder.mint.execute({
    tokenSymbol: "MockUSD" as any,
  });
  log("Mint transaction:", mintResult);

  // Test transfer
  log("\n2. Testing Transfer Transaction");
  const transferResult = await transactionBuilder.transfer.execute({
    tokenSymbol: "MockUSD" as any,
    to: "0x1234567890123456789012345678901234567890",
    amount: "10.5",
  });
  log("Transfer transaction:", transferResult);

  // Test swap
  log("\n3. Testing Swap Transaction");
  const swapResult = await transactionBuilder.swap.execute({
    fromToken: "MockUSD" as any,
    toToken: "MockToken" as any,
    amount: "100",
    slippagePercent: 1,
  });
  log("Swap transaction:", swapResult);
}

async function testStorageOperations() {
  log("Starting Storage Operations Tests");

  // Test stats
  log("\n1. Getting storage stats");
  const stats = await storage.getStats();
  log("Storage stats:", stats);

  // Test backup
  log("\n2. Creating backup");
  const backupId = await storage.createBackup();
  log("Backup created:", backupId);

  // Test conversation management
  log("\n3. Testing conversation management");
  const conversation = await storage.getOrCreateConversation(TEST_USER.telegramId);
  log("Conversation:", conversation);

  // Save a test message
  const message = {
    id: `msg_${Date.now()}`,
    conversationId: conversation.id,
    role: "user" as const,
    content: { text: "Test message" },
    createdAt: Date.now(),
  };
  await storage.saveMessage(message);
  log("Message saved");

  // Retrieve messages
  const messages = await storage.getMessagesByConversation(conversation.id);
  log("Retrieved messages:", messages);
}

async function runAllTests() {
  console.log("🚀 Starting End-to-End Tests for RISE TG Bot\n");

  try {
    // Test 1: Verification Flow
    const verificationSuccess = await testVerificationFlow();
    if (!verificationSuccess) {
      log("❌ Verification failed, skipping remaining tests");
      return;
    }

    // Test 2: Storage Operations
    await testStorageOperations();

    // Test 3: Transaction Construction
    await testTransactionConstruction();

    // Test 4: LLM Router (requires OpenRouter API key)
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