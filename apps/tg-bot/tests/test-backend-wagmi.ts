/**
 * Test script for backend wagmi pattern (exact wallet-demo replication)
 * Tests the exact useTransaction and useSwap patterns in backend context
 */

import { backendTransactionService } from "../src/services/backendTransaction.js";
import { backendSwapService } from "../src/services/backendSwap.js";
import { Address } from "viem";

// Test address that has permissions
const TEST_USER_ADDRESS = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc" as Address;

async function testBackendWagmiPattern() {
  console.log("🧪 Testing backend wagmi pattern (exact wallet-demo replication)...");
  console.log("=" + "=".repeat(70));

  // Test 1: Execution info
  console.log("\n1️⃣ Testing backend execution info...");
  try {
    const info = backendTransactionService.getExecutionInfo();
    console.log("✅ Backend execution service ready:");
    console.log(`   Connector: ${info.connector}`);
    console.log(`   Chain ID: ${info.chainId}`);
    console.log(`   Backend signer: ${info.backendSigner}`);
    console.log(`   Has private key: ${info.hasPrivateKey}`);
    console.log(`   Session key expiry: ${new Date(info.sessionKeyExpiry * 1000).toISOString()}`);
    console.log(`   Permissions: ${info.permissions} contracts`);
  } catch (error) {
    console.error("❌ Backend execution info failed:", error);
    return;
  }

  // Test 2: Token configuration
  console.log("\n2️⃣ Testing token configuration...");
  try {
    const tokens = backendSwapService.getAvailableTokens();
    console.log("✅ Available tokens:");
    tokens.forEach(token => {
      console.log(`   ${token.symbol}: ${token.address} (${token.decimals} decimals)`);
    });
  } catch (error) {
    console.error("❌ Token configuration failed:", error);
    return;
  }

  // Test 3: Swap parameter building
  console.log("\n3️⃣ Testing swap parameter building...");
  try {
    const swapParams = backendSwapService.buildSwapParams({
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

  // Test 4: Backend wagmi execution
  console.log("\n4️⃣ Testing backend wagmi execution...");
  
  console.log("⚠️  This will execute using exact wallet-demo pattern!");
  console.log(`   Pattern: useTransaction.executeWithSessionKey()`);
  console.log(`   Provider: portoConnector.getProvider()`);
  console.log(`   Methods: wallet_prepareCalls + wallet_sendPreparedCalls`);
  console.log(`   From: 1.0 MockUSD → MockToken`);
  console.log(`   User: ${TEST_USER_ADDRESS}`);
  console.log(`   Backend session key: ${backendTransactionService.getExecutionInfo().backendSigner}`);
  console.log("");
  
  const shouldExecuteReal = process.env.EXECUTE_BACKEND_WAGMI_SWAP === "true";
  
  if (shouldExecuteReal) {
    console.log("🚀 EXECUTING WITH BACKEND WAGMI PATTERN...");
    
    try {
      const swapParams = backendSwapService.buildSwapParams({
        fromToken: "MockUSD",
        toToken: "MockToken", 
        amount: "1.0",
        userAddress: TEST_USER_ADDRESS,
        slippagePercent: 0.5
      });

      console.log("🔄 Starting backend wagmi swap execution...");
      const result = await backendSwapService.onSwap(swapParams);
      
      if (result.success) {
        console.log("✅ BACKEND WAGMI SWAP EXECUTED SUCCESSFULLY!");
        console.log(`   Hash: ${result.data?.hash}`);
        console.log(`   Used session key: ${result.data?.usedSessionKey}`);
        console.log(`   Total transactions: ${result.data?.totalTransactions}`);
        console.log(`   Explorer: https://testnet-explorer.riselabs.xyz/tx/${result.data?.hash}`);
      } else {
        console.log("❌ BACKEND WAGMI SWAP FAILED:");
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
      console.error("❌ Backend wagmi execution failed:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  } else {
    console.log("ℹ️  Skipping real execution (set EXECUTE_BACKEND_WAGMI_SWAP=true to execute)");
    console.log("✅ Backend wagmi pattern validation passed");
  }

  console.log("\n🎉 Backend wagmi pattern test completed!");
  console.log("💡 This follows the exact useTransaction + useSwap pattern from wallet-demo");
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testBackendWagmiPattern().catch(console.error);
}