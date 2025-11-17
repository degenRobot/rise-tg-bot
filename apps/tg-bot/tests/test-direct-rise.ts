/**
 * Test script for direct RISE wallet RPC approach
 * This tests a simpler approach while we figure out the proper backend provider setup
 */

import { directRiseService } from "../src/services/directRiseService.js";
import { Address } from "viem";

// Test address that has permissions
const TEST_USER_ADDRESS = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc" as Address;

async function testDirectRiseApproach() {
  console.log("🧪 Testing direct RISE wallet RPC approach...");
  console.log("=" + "=".repeat(60));

  // Test 1: Service info
  console.log("\n1️⃣ Testing service configuration...");
  try {
    const info = directRiseService.getInfo();
    console.log("✅ Service configured:");
    console.log(`   RPC URL: ${info.rpcUrl}`);
    console.log(`   Chain ID: ${info.chainId}`);
    console.log(`   Backend signer: ${info.backendSigner}`);
    console.log(`   Has private key: ${info.hasPrivateKey}`);
    console.log(`   Mode: ${info.mode}`);
  } catch (error) {
    console.error("❌ Service configuration failed:", error);
    return;
  }

  // Test 2: Execute swap
  console.log("\n2️⃣ Testing direct swap execution...");
  
  console.log("⚠️  This will test the direct RISE wallet approach");
  console.log(`   From: 1.0 MockUSD`);
  console.log(`   To: MockToken`);
  console.log(`   User: ${TEST_USER_ADDRESS}`);
  console.log("");

  try {
    const result = await directRiseService.executeSwap({
      fromToken: "MockUSD",
      toToken: "MockToken",
      amount: "1.0",
      userAddress: TEST_USER_ADDRESS,
      slippagePercent: 0.5
    });

    if (result.success) {
      console.log("✅ Direct RISE execution successful!");
      console.log(`   Hash: ${result.data?.hash}`);
      console.log(`   Used session key: ${result.data?.usedSessionKey}`);
      console.log(`   Total transactions: ${result.data?.totalTransactions}`);
      console.log(`   Simulated: ${result.data?.simulated}`);
      
      if (!result.data?.simulated) {
        console.log(`   Explorer: https://testnet-explorer.riselabs.xyz/tx/${result.data?.hash}`);
      } else {
        console.log("   ⚠️  This was a simulation - need proper backend provider setup for real execution");
      }
    } else {
      console.log("❌ Direct RISE execution failed:");
      console.log(`   Error: ${result.error}`);
    }

  } catch (error) {
    console.error("❌ Direct approach test failed:", error);
  }

  console.log("\n🎉 Direct RISE wallet approach test completed!");
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testDirectRiseApproach().catch(console.error);
}