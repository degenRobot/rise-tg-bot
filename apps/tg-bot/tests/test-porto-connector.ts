/**
 * Test script to debug porto connector in backend context
 * Understanding how to get provider.request working for wallet methods
 */

import { portoConnector } from "../src/config/backendWagmi.js";

async function testPortoConnector() {
  console.log("🧪 Testing porto connector in backend context...");
  console.log("=" + "=".repeat(60));

  // Test 1: Check connector properties
  console.log("\n1️⃣ Testing connector properties...");
  try {
    console.log("✅ Porto connector info:");
    console.log(`   ID: ${portoConnector.id}`);
    console.log(`   Name: ${portoConnector.name}`);
    console.log(`   Type: ${portoConnector.type}`);
    console.log(`   Has getProvider: ${typeof portoConnector.getProvider === 'function'}`);
  } catch (error) {
    console.error("❌ Connector properties failed:", error);
    return;
  }

  // Test 2: Try to get provider
  console.log("\n2️⃣ Testing provider access...");
  try {
    console.log("🔌 Attempting to get provider...");
    const provider = await portoConnector.getProvider();
    console.log("✅ Provider obtained:");
    console.log(`   Provider type: ${typeof provider}`);
    console.log(`   Has request method: ${typeof provider?.request === 'function'}`);
    
    // List available methods
    if (provider && typeof provider === 'object') {
      const methods = Object.getOwnPropertyNames(provider);
      console.log(`   Available methods: ${methods.slice(0, 10).join(', ')}...`);
    }
  } catch (error) {
    console.error("❌ Provider access failed:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
    return;
  }

  // Test 3: Try a simple RPC call
  console.log("\n3️⃣ Testing simple RPC call...");
  try {
    const provider = await portoConnector.getProvider();
    console.log("📞 Attempting simple RPC call (eth_chainId)...");
    
    const chainId = await provider.request({
      method: "eth_chainId",
      params: [],
    });
    
    console.log("✅ Simple RPC call successful:");
    console.log(`   Chain ID: ${chainId}`);
  } catch (error) {
    console.error("❌ Simple RPC call failed:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
    });
  }

  // Test 4: Try wallet-specific methods
  console.log("\n4️⃣ Testing wallet-specific methods...");
  try {
    const provider = await portoConnector.getProvider();
    console.log("🔐 Attempting wallet_getCapabilities...");
    
    const capabilities = await provider.request({
      method: "wallet_getCapabilities",
      params: ["0xaa39db"], // RISE testnet chain ID in hex
    });
    
    console.log("✅ Wallet method call successful:");
    console.log(`   Capabilities:`, capabilities);
  } catch (error) {
    console.error("❌ Wallet method call failed:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
    });
  }

  console.log("\n🎉 Porto connector test completed!");
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testPortoConnector().catch(console.error);
}