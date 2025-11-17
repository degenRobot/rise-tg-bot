/**
 * Test script for wallet-demo pattern implementation
 * Tests the new transaction and swap services with the test address
 */

import { config } from "../src/config/client.js";
import { transactionService } from "../src/services/transactionService.js";
import { swapService, TOKENS } from "../src/services/swapService.js";
import { Address } from "viem";

// Test address that has already granted permissions to the bot backend
const TEST_USER_ADDRESS = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc" as Address;

async function testWalletDemoPattern() {
  console.log("🧪 Testing wallet-demo pattern implementation...");
  console.log("=" + "=".repeat(60));

  // Test 1: Configuration validation
  console.log("\n1️⃣ Testing configuration...");
  try {
    const signerInfo = transactionService.getSignerInfo();
    console.log("✅ Config loaded successfully:");
    console.log(`   Backend signer: ${signerInfo.address}`);
    console.log(`   Chain ID: ${signerInfo.chainId}`);
    console.log(`   Has private key: ${signerInfo.hasPrivateKey}`);
    console.log(`   RPC URL: ${signerInfo.rpcUrl}`);
  } catch (error) {
    console.error("❌ Configuration failed:", error);
    return;
  }

  // Test 2: Backend signer balance check
  console.log("\n2️⃣ Testing backend signer balance...");
  try {
    const canExecute = await transactionService.canExecute({
      calls: [],
      requiredPermissions: { calls: [] }
    });
    
    if (canExecute.canExecute) {
      console.log("✅ Backend signer has sufficient balance");
    } else {
      console.log(`❌ Backend signer balance insufficient: ${canExecute.reason}`);
      return;
    }
  } catch (error) {
    console.error("❌ Balance check failed:", error);
    return;
  }

  // Test 3: Token configuration
  console.log("\n3️⃣ Testing token configuration...");
  try {
    const availableTokens = swapService.getAvailableTokens();
    console.log("✅ Available tokens:");
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
    const swapParams = swapService.buildSwapParams({
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

  // Test 5: Dry run swap execution (for testing purposes)
  console.log("\n5️⃣ Testing swap execution (DRY RUN)...");
  
  console.log("⚠️  IMPORTANT: This would execute a real transaction!");
  console.log(`   From: 1.0 MockUSD`);
  console.log(`   To: MockToken`);
  console.log(`   User: ${TEST_USER_ADDRESS}`);
  console.log(`   Backend signer: ${config.backendSigner.address}`);
  console.log("");
  
  const shouldExecuteReal = process.env.EXECUTE_REAL_SWAP === "true";
  
  if (shouldExecuteReal) {
    console.log("🚀 EXECUTING REAL SWAP...");
    
    try {
      const swapParams = swapService.buildSwapParams({
        fromToken: "MockUSD",
        toToken: "MockToken", 
        amount: "1.0",
        userAddress: TEST_USER_ADDRESS,
        slippagePercent: 0.5
      });

      const result = await swapService.onSwap(swapParams);
      
      if (result.success) {
        console.log("✅ SWAP EXECUTED SUCCESSFULLY!");
        console.log(`   Hash: ${result.data?.hash}`);
        console.log(`   Used session key: ${result.data?.usedSessionKey}`);
        console.log(`   Total transactions: ${result.data?.totalTransactions}`);
        console.log(`   Explorer: https://testnet-explorer.riselabs.xyz/tx/${result.data?.hash}`);
      } else {
        console.log("❌ SWAP FAILED:");
        console.log(`   Error: ${result.error}`);
      }
      
    } catch (error) {
      console.error("❌ Real swap execution failed:", error);
    }
  } else {
    console.log("ℹ️  Skipping real execution (set EXECUTE_REAL_SWAP=true to execute)");
    console.log("✅ Dry run parameters validation passed");
  }

  console.log("\n🎉 Wallet-demo pattern test completed!");
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testWalletDemoPattern().catch(console.error);
}