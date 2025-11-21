import "dotenv/config";
import { createPublicClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { 
  createVerificationMessage, 
  verifyAndLinkAccount, 
  getVerifiedAccount,
  isAccountVerified 
} from "./src/services/verification.js";
import { storage } from "./src/services/storage.js";

// RISE testnet chain configuration
const rise = {
  id: 7421614,
  name: "RISE",
  network: "rise",
  nativeCurrency: {
    decimals: 18,
    name: "RISE",
    symbol: "RISE",
  },
  rpcUrls: {
    default: {
      http: ["https://testnet.riselabs.xyz"],
    },
  },
};

async function testSignatureVerification() {
  console.log("🔐 Testing Signature Verification Flow");
  console.log("=====================================\n");

  // Test wallet (you can replace with your own for testing)
  const privateKey = "0x376e27e68a7412d0fb6b0c9acef39f6b49500e1e27667c315bb9b0aa00f109f9";
  const account = privateKeyToAccount(privateKey);
  
  console.log("📱 Test Wallet:");
  console.log(`   Address: ${account.address}`);
  
  // Test Telegram data
  const telegramId = "123456789";
  const telegramHandle = "testuser";
  
  console.log("\n📱 Telegram Account:");
  console.log(`   ID: ${telegramId}`);
  console.log(`   Handle: @${telegramHandle}`);

  // Step 1: Generate verification message
  console.log("\n1️⃣ Generating verification message...");
  const { message, data } = createVerificationMessage(telegramId, telegramHandle);
  
  console.log("\n📝 Message to sign:");
  console.log("-------------------");
  console.log(message);
  console.log("-------------------");
  
  console.log("\n📊 Message data:");
  console.log(JSON.stringify(data, null, 2));

  // Step 2: Sign the message
  console.log("\n2️⃣ Signing message with wallet...");
  const signature = await account.signMessage({ message });
  console.log(`✅ Signature: ${signature}`);

  // Step 3: Verify signature (server-side)
  console.log("\n3️⃣ Verifying signature on server...");
  
  // Create a public client to verify the signature
  const client = createPublicClient({
    chain: rise,
    transport: http(),
  });

  // Test the raw signature verification first
  const isValidRaw = await client.verifyMessage({
    address: account.address,
    message,
    signature,
  });
  console.log(`   Raw verification result: ${isValidRaw ? "✅ VALID" : "❌ INVALID"}`);

  // Test with wrong signature
  const wrongSignature = "0x" + "00".repeat(65) as `0x${string}`;
  const isInvalidRaw = await client.verifyMessage({
    address: account.address,
    message,
    signature: wrongSignature,
  });
  console.log(`   Wrong signature test: ${isInvalidRaw ? "❌ UNEXPECTED VALID" : "✅ CORRECTLY INVALID"}`);

  // Step 4: Use the verifyAndLinkAccount function
  console.log("\n4️⃣ Linking account using verifyAndLinkAccount...");
  const linkResult = await verifyAndLinkAccount({
    address: account.address,
    signature,
    message,
    telegramId,
    telegramHandle,
  });
  
  if (linkResult.success) {
    console.log("✅ Account successfully linked!");
  } else {
    console.log(`❌ Link failed: ${linkResult.error}`);
  }

  // Step 5: Check if account is verified
  console.log("\n5️⃣ Checking verification status...");
  const isVerified = await isAccountVerified(telegramId);
  console.log(`   Is verified: ${isVerified ? "✅ YES" : "❌ NO"}`);
  
  const verifiedAccount = await getVerifiedAccount(telegramId);
  if (verifiedAccount) {
    console.log("\n📋 Verified Account Details:");
    console.log(`   Wallet: ${verifiedAccount.accountAddress}`);
    console.log(`   Telegram: @${verifiedAccount.telegramHandle} (${verifiedAccount.telegramId})`);
    console.log(`   Verified at: ${verifiedAccount.verifiedAt}`);
    console.log(`   Active: ${verifiedAccount.active}`);
  }

  // Step 6: Test with wrong data (should fail)
  console.log("\n6️⃣ Testing with mismatched data (should fail)...");
  const wrongLinkResult = await verifyAndLinkAccount({
    address: account.address,
    signature,
    message,
    telegramId: "987654321", // Wrong ID
    telegramHandle,
  });
  console.log(`   Result: ${wrongLinkResult.success ? "❌ UNEXPECTED SUCCESS" : "✅ CORRECTLY FAILED"}`);
  if (!wrongLinkResult.success) {
    console.log(`   Error: ${wrongLinkResult.error}`);
  }

  // Step 7: List all verified links
  console.log("\n7️⃣ Checking storage...");
  const allLinks = await storage.getAllVerifiedLinks();
  console.log(`   Total verified links: ${allLinks.length}`);
  
  console.log("\n✅ Test completed!");
}

// Run the test
testSignatureVerification().catch(console.error);