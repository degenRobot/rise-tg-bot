/**
 * Test script for RISE wallet pattern implementation
 * Tests the new RISE transaction and swap services with proper provider.request calls
 */

import { riseTransactionService } from "../src/services/riseTransactionService.js";
import { riseSwapService } from "../src/services/riseSwapService.js";
import { Address } from "viem";

// Test address that has already granted permissions to the bot backend
const TEST_USER_ADDRESS = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc" as Address;

async function testRiseWalletPattern() {
  console.log("🧪 Testing RISE wallet pattern implementation...");
  console.log("=" + "=".repeat(60));

  // Test 1: Configuration validation
  console.log("\n1️⃣ Testing RISE wallet configuration...");
  try {
    const sessionKeyInfo = riseTransactionService.getSessionKeyInfo();
    console.log("✅ RISE wallet config loaded successfully:");
    console.log(`   Backend session key: ${sessionKeyInfo.address}`);
    console.log(`   Chain ID: ${sessionKeyInfo.chainId}`);
    console.log(`   Connector: ${sessionKeyInfo.connector}`);
    console.log(`   Has private key: ${sessionKeyInfo.hasPrivateKey}`);
    console.log(`   Key type: ${sessionKeyInfo.type}`);
  } catch (error) {
    console.error("❌ RISE wallet configuration failed:", error);
    return;
  }

  // Test 2: Transaction capability check (no balance check needed with gas sponsorship)
  console.log("\n2️⃣ Testing transaction capability...");
  try {
    const canExecute = await riseTransactionService.canExecute({
      calls: [],
      requiredPermissions: { calls: [] }
    });
    
    if (canExecute.canExecute) {
      console.log("✅ RISE wallet ready for gas-sponsored transactions");
    } else {
      console.log(`❌ Cannot execute transactions: ${canExecute.reason}`);
      return;
    }
  } catch (error) {
    console.error("❌ Transaction capability check failed:", error);
    return;
  }

  // Test 3: Token configuration
  console.log("\n3️⃣ Testing token configuration...");
  try {
    const availableTokens = riseSwapService.getAvailableTokens();
    console.log("✅ Available tokens for swapping:");
    availableTokens.forEach(token => {
      console.log(`   ${token.symbol}: ${token.address} (${token.decimals} decimals)`);
    });
  } catch (error) {
    console.error("❌ Token configuration failed:", error);
    return;
  }

  // Test 4: Swap parameter building
  console.log("\n4️⃣ Testing swap parameter building...");
  try {
    const swapParams = riseSwapService.buildSwapParams({
      fromToken: "MockUSD",
      toToken: "MockToken",
      amount: "1.0",
      userAddress: TEST_USER_ADDRESS,
      slippagePercent: 0.5
    });

    console.log("✅ Swap parameters built successfully:");
    console.log(`   Amount in: ${swapParams.amountIn.toString()}`);
    console.log(`   Amount out min: ${swapParams.amountOutMin.toString()}`);
    console.log(`   From token: ${swapParams.from.symbol}`);
    console.log(`   To address: ${swapParams.toAddress}`);
    console.log(`   User address: ${swapParams.accountAddress}`);
    console.log(`   Deadline: ${swapParams.deadline.toString()}`);
    console.log(`   Should approve: ${swapParams.shouldApprove}`);
  } catch (error) {
    console.error("❌ Swap parameter building failed:", error);
    return;
  }

  // Test 5: RISE wallet execution test
  console.log("\n5️⃣ Testing RISE wallet execution...");
  
  console.log("⚠️  IMPORTANT: This will execute a real transaction via RISE wallet!");
  console.log(`   From: 1.0 MockUSD`);
  console.log(`   To: MockToken`);
  console.log(`   User: ${TEST_USER_ADDRESS}`);
  console.log(`   Backend session key: ${riseTransactionService.getSessionKeyInfo().address}`);
  console.log(`   Uses: provider.request('wallet_prepareCalls') + provider.request('wallet_sendPreparedCalls')`);
  console.log(`   Gas: Sponsored by RISE wallet`);
  console.log("");
  
  const shouldExecuteReal = process.env.EXECUTE_REAL_RISE_SWAP === "true";
  
  if (shouldExecuteReal) {
    console.log("🚀 EXECUTING REAL SWAP VIA RISE WALLET...");
    
    try {
      const swapParams = riseSwapService.buildSwapParams({
        fromToken: "MockUSD",
        toToken: "MockToken", 
        amount: "1.0",
        userAddress: TEST_USER_ADDRESS,
        slippagePercent: 0.5
      });

      console.log("🔄 Starting RISE wallet swap execution...");
      const result = await riseSwapService.onSwap(swapParams);
      
      if (result.success) {
        console.log("✅ RISE WALLET SWAP EXECUTED SUCCESSFULLY!");
        console.log(`   Hash: ${result.data?.hash}`);
        console.log(`   Used session key: ${result.data?.usedSessionKey}`);
        console.log(`   Total transactions: ${result.data?.totalTransactions}`);
        console.log(`   Explorer: https://explorer.testnet.riselabs.xyz/tx/${result.data?.hash}`);
      } else {
        console.log("❌ RISE WALLET SWAP FAILED:");
        console.log(`   Error: ${result.error}`);
        
        // Additional debug info
        if (result.error?.message) {
          console.log(`   Message: ${result.error.message}`);
        }
        if (result.error?.cause) {
          console.log(`   Cause: ${result.error.cause}`);
        }
      }
      
    } catch (error) {
      console.error("❌ Real RISE wallet swap execution failed:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  } else {
    console.log("ℹ️  Skipping real execution (set EXECUTE_REAL_RISE_SWAP=true to execute)");
    console.log("✅ RISE wallet pattern validation passed");
  }

  console.log("\n🎉 RISE wallet pattern test completed!");
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testRiseWalletPattern().catch(console.error);
}