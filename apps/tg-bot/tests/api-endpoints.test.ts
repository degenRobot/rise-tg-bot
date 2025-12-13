import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";

const API_URL = process.env.API_URL || "http://localhost:8008";
const TEST_PRIVATE_KEY = "0x376e27e68a7412d0fb6b0c9acef39f6b49500e1e27667c315bb9b0aa00f109f9";

async function testAPIEndpoints() {
  console.log(" Testing API Endpoints");
  console.log("========================\n");

  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const telegramId = "987654321";
  const telegramHandle = "apiTestUser";

  console.log("API URL:", API_URL);
  console.log("Test Wallet:", account.address);
  console.log("Telegram ID:", telegramId);
  console.log("Telegram Handle:", telegramHandle);

  // Test 1: Health Check
  console.log("\n Testing Health Check...");
  try {
    const healthResponse = await fetch(`${API_URL}/api/health`);
    const healthData = await healthResponse.json();
    console.log("✅ Health check passed:", healthData);
  } catch (error) {
    console.error("❌ Health check failed:", error);
  }

  // Test 2: Check Status (Before Linking)
  console.log("\n Checking Status (Before Linking)...");
  try {
    const statusResponse = await fetch(`${API_URL}/api/verify/status/${telegramId}`);
    const statusData = await statusResponse.json();
    console.log("   Status:", statusData.linked ? "❌ Already linked" : "✅ Not linked");
    console.log("   Data:", JSON.stringify(statusData, null, 2));
  } catch (error) {
    console.error("❌ Status check failed:", error);
  }

  // Test 3: Get Verification Message
  console.log("\n Getting Verification Message...");
  let message = "";
  try {
    const messageResponse = await fetch(`${API_URL}/api/verify/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId, telegramHandle }),
    });
    
    if (!messageResponse.ok) {
      throw new Error(`HTTP ${messageResponse.status}: ${await messageResponse.text()}`);
    }
    
    const messageData = await messageResponse.json();
    message = messageData.message;
    console.log("✅ Got verification message");
    console.log("\nMessage:");
    console.log("-------------------");
    console.log(message);
    console.log("-------------------");
  } catch (error) {
    console.error("❌ Failed to get message:", error);
    return;
  }

  // Test 4: Sign Message
  console.log("\nSigning Message...");
  const signature = await account.signMessage({ message });
  console.log("✅ Signature:", signature);

  // Test 5: Submit Signature
  console.log("\n Submitting Signature for Verification...");
  try {
    const verifyResponse = await fetch(`${API_URL}/api/verify/signature`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: account.address,
        signature,
        message,
        telegramId,
        telegramHandle,
      }),
    });
    
    const verifyData = await verifyResponse.json();
    if (verifyData.success) {
      console.log("✅ Verification successful!");
    } else {
      console.log("❌ Verification failed:", verifyData.error);
    }
  } catch (error) {
    console.error("❌ Verification request failed:", error);
  }

  // Test 6: Check Status (After Linking)
  console.log("\nChecking Status (After Linking)...");
  try {
    const statusResponse = await fetch(`${API_URL}/api/verify/status/${telegramId}`);
    const statusData = await statusResponse.json();
    console.log("   Linked:", statusData.linked ? "✅ YES" : "❌ NO");
    if (statusData.linked) {
      console.log("   Account:", statusData.accountAddress);
      console.log("   Handle:", statusData.telegramHandle);
      console.log("   Verified at:", statusData.verifiedAt);
    }
  } catch (error) {
    console.error("❌ Status check failed:", error);
  }

  // Test 7: Check User by Telegram ID
  console.log("\n Checking User by Telegram ID...");
  try {
    const userResponse = await fetch(`${API_URL}/api/users/by-telegram/${telegramId}`);
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log("✅ User found:");
      console.log(JSON.stringify(userData, null, 2));
    } else {
      console.log("❌ User not found (404)");
    }
  } catch (error) {
    console.error("❌ User lookup failed:", error);
  }

  // Test 8: Sync Permissions (Frontend Flow)
  console.log("\n Testing Permission Sync...");
  try {
    const syncResponse = await fetch(`${API_URL}/api/permissions/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountAddress: account.address,
        backendKeyAddress: process.env.BACKEND_SIGNER_ADDRESS,
        expiry: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
        telegramId,
        telegramUsername: telegramHandle,
      }),
    });
    
    const syncData = await syncResponse.json();
    console.log("✅ Permission sync:", syncData);
  } catch (error) {
    console.error("❌ Permission sync failed:", error);
  }

  // Test 9: Revoke Verification
  console.log("\n Testing Revoke Verification...");
  try {
    const revokeResponse = await fetch(`${API_URL}/api/verify/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId }),
    });
    
    const revokeData = await revokeResponse.json();
    console.log(revokeData.success ? "✅ Revoked successfully" : "❌ Revoke failed");
  } catch (error) {
    console.error("❌ Revoke failed:", error);
  }

  // Test 10: Final Status Check
  console.log("\n Final Status Check...");
  try {
    const statusResponse = await fetch(`${API_URL}/api/verify/status/${telegramId}`);
    const statusData = await statusResponse.json();
    console.log("   Linked:", statusData.linked ? "❌ Still linked" : "✅ Unlinked");
  } catch (error) {
    console.error("❌ Status check failed:", error);
  }

  console.log("\n✅ All tests completed!");
}

// Run tests
testAPIEndpoints().catch(console.error);