import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, type Address } from "viem";
import { mainnet } from "viem/chains";
import { 
  createVerificationMessage, 
  verifyAndLinkAccount,
  getVerifiedAccount 
} from "../src/services/verification.js";

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testSignatureVerification() {
  log("\n🔍 Signature Verification Debug Test", colors.cyan);
  log("===================================\n", colors.cyan);

  // Test data
  const privateKey = "0x376e27e68a7412d0fb6b0c9acef39f6b49500e1e27667c315bb9b0aa00f109f9" as const;
  const account = privateKeyToAccount(privateKey);
  const telegramId = "123456789";
  const telegramHandle = "testuser";
  
  log("📱 Test Account:", colors.blue);
  log(`   Private Key: ${privateKey.substring(0, 10)}...`);
  log(`   Address: ${account.address}`);
  log(`   Telegram ID: ${telegramId}`);
  log(`   Telegram Handle: @${telegramHandle}\n`);

  // Step 1: Create verification message
  log("1️⃣ Creating Verification Message", colors.yellow);
  const { message, data } = createVerificationMessage(telegramId, telegramHandle);
  
  log("\n📝 Generated Message:");
  log("-------------------");
  log(message);
  log("-------------------\n");
  
  log("📊 Message Data:");
  log(JSON.stringify(data, null, 2) + "\n");

  // Step 2: Sign message using different methods
  log("2️⃣ Testing Different Signing Methods\n", colors.yellow);
  
  // Method 1: Direct account signing (like in our test)
  log("Method 1: Direct account.signMessage()");
  const signature1 = await account.signMessage({ message });
  log(`Signature: ${signature1}`);
  
  // Method 2: Using wallet client (like wagmi does)
  log("\nMethod 2: Using WalletClient (wagmi-style)");
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(),
  });
  
  const signature2 = await walletClient.signMessage({ 
    account,
    message 
  });
  log(`Signature: ${signature2}`);
  
  // Compare signatures
  log("\n📊 Signature Comparison:");
  log(`   Signatures match: ${signature1 === signature2 ? '✅ YES' : '❌ NO'}`);
  if (signature1 !== signature2) {
    log(`   Sig1: ${signature1}`);
    log(`   Sig2: ${signature2}`);
  }

  // Step 3: Test recovery methods
  log("\n3️⃣ Testing Address Recovery", colors.yellow);
  
  const { recoverMessageAddress, verifyMessage } = await import("viem");
  
  // Test recovery
  const recoveredAddress = await recoverMessageAddress({
    message,
    signature: signature1,
  });
  
  log(`\n📍 Recovery Results:`);
  log(`   Original Address: ${account.address}`);
  log(`   Recovered Address: ${recoveredAddress}`);
  log(`   Match: ${recoveredAddress.toLowerCase() === account.address.toLowerCase() ? '✅ YES' : '❌ NO'}`);
  
  // Test verifyMessage function
  const isValidMessage = await verifyMessage({
    address: account.address,
    message,
    signature: signature1,
  });
  log(`\n✅ verifyMessage result: ${isValidMessage}`);

  // Step 4: Test our verification function
  log("\n4️⃣ Testing Our Verification Function", colors.yellow);
  
  const verifyResult = await verifyAndLinkAccount({
    address: account.address,
    signature: signature1,
    message,
    telegramId,
    telegramHandle,
  });
  
  log(`\n📋 Verification Result:`);
  log(`   Success: ${verifyResult.success ? '✅' : '❌'}`);
  if (!verifyResult.success) {
    log(`   Error: ${verifyResult.error}`, colors.red);
  }

  // Step 5: Test with frontend-generated signature format
  log("\n5️⃣ Testing Frontend Signature Format", colors.yellow);
  
  // Check if signature has correct format
  log("\n🔍 Signature Analysis:");
  log(`   Length: ${signature1.length} characters`);
  log(`   Starts with 0x: ${signature1.startsWith('0x') ? '✅' : '❌'}`);
  log(`   Valid hex: ${/^0x[0-9a-fA-F]+$/.test(signature1) ? '✅' : '❌'}`);
  
  // Test with exact frontend scenario
  log("\n6️⃣ Simulating Frontend Scenario", colors.yellow);
  
  // This simulates what happens in TelegramVerification.tsx
  const frontendMessage = `RISE Telegram Bot Verification

I am linking my wallet to Telegram account @${telegramHandle} (ID: ${telegramId})

Timestamp: ${Date.now()}
Nonce: testNonce123

This signature proves I control this wallet and authorize the RISE bot to execute transactions on my behalf.`;
  
  const frontendSignature = await account.signMessage({ message: frontendMessage });
  
  log("\n📝 Frontend-style Message:");
  log("-------------------");
  log(frontendMessage);
  log("-------------------");
  log(`\nSignature: ${frontendSignature}`);
  
  // Verify frontend-style signature
  const frontendRecovered = await recoverMessageAddress({
    message: frontendMessage,
    signature: frontendSignature,
  });
  
  log(`\n✅ Frontend Recovery Test:`);
  log(`   Recovered: ${frontendRecovered}`);
  log(`   Expected: ${account.address}`);
  log(`   Match: ${frontendRecovered.toLowerCase() === account.address.toLowerCase() ? '✅ YES' : '❌ NO'}`);
  
  log("\n✅ Test completed!", colors.green);
}

// Run the test
testSignatureVerification().catch(error => {
  log("\n❌ Test failed with error:", colors.red);
  console.error(error);
  process.exit(1);
});