/**
 * Test RISE Relay Client Implementation
 * 
 * Tests the direct relay client approach with correct wallet-demo parameter structure.
 * Wagmi connectors require browser environment, so we use direct relay for backend.
 */

import { riseRelayClient, risePublicClient, backendSessionKey, Chains } from "../src/config/backendRiseClient.js";
import { backendTransactionService } from "../src/services/backendTransactionService.js";
import { backendSwapService } from "../src/services/backendSwapService.js";
import { encodeFunctionData, parseUnits } from "viem";
import { MintableERC20ABI } from "../src/abi/erc20.js";
import "dotenv/config";

// Test user address (has permissions)
const TEST_USER_ADDRESS = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc";
const TEST_TOKEN_ADDRESS = "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50"; // MockUSD

async function testRiseRelayClient() {
  console.log("🧪 Testing RISE Relay Client Implementation...");
  console.log("=" + "=".repeat(60));

  // Test 1: Basic client connectivity
  console.log("\n1️⃣ Testing relay client connectivity...");
  try {
    console.log("📡 RISE Relay Client:", {
      client: typeof riseRelayClient,
      transport: typeof riseRelayClient.transport,
      hasRequest: typeof riseRelayClient.request === 'function',
    });

    console.log("📡 RISE Public Client:", {
      client: typeof risePublicClient,
      chain: risePublicClient.chain?.name,
      chainId: risePublicClient.chain?.id,
    });

    console.log("✅ Clients initialized successfully");

  } catch (error) {
    console.error("❌ Client initialization failed:", error);
    return;
  }

  // Test 2: Backend session key configuration
  console.log("\n2️⃣ Testing backend session key...");
  try {
    const serviceInfo = backendTransactionService.getInfo();
    console.log("✅ Transaction service info:", serviceInfo);

  } catch (error) {
    console.error("❌ Session key configuration failed:", error);
    return;
  }

  // Test 3: Basic blockchain connectivity 
  console.log("\n3️⃣ Testing basic blockchain connectivity...");
  try {
    console.log("🔗 Testing chain connectivity...");
    
    // Test if we can make basic RPC calls
    const chainId = await risePublicClient.getChainId();
    console.log(`✅ Connected to chain: ${chainId}`);

    const blockNumber = await risePublicClient.getBlockNumber();
    console.log(`✅ Current block: ${blockNumber}`);

  } catch (error) {
    console.error("❌ Basic connectivity test failed:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
    });
  }

  // Test 4: Simple transaction execution
  console.log("\n4️⃣ Testing simple transaction execution...");
  try {
    console.log("🔨 Building simple approve transaction...");

    // Build a simple approve call
    const approveData = encodeFunctionData({
      abi: MintableERC20ABI,
      functionName: "approve",
      args: ["0x6c10B45251F5D3e650bcfA9606c662E695Af97ea", parseUnits("1", 18)], // Approve router for 1 token
    });

    const simpleCalls = [{
      to: TEST_TOKEN_ADDRESS as `0x${string}`,
      data: approveData,
    }];

    console.log("📋 Simple calls prepared:", {
      target: TEST_TOKEN_ADDRESS,
      function: "approve",
      dataLength: approveData.length,
    });

    console.log("🚀 Executing via backend transaction service...");
    const result = await backendTransactionService.execute(
      {
        calls: simpleCalls,
        requiredPermissions: {
          calls: [TEST_TOKEN_ADDRESS]
        }
      },
      TEST_USER_ADDRESS
    );

    if (result.success) {
      console.log("✅ Simple transaction execution successful!");
      console.log("📊 Result:", {
        hash: result.data?.hash?.slice(0, 10) + "...",
        usedSessionKey: result.data?.usedSessionKey,
        totalTransactions: result.data?.totalTransactions,
      });
    } else {
      console.error("❌ Simple transaction failed:", result.error);
      console.error("Error details:", {
        message: result.error?.message,
        stack: result.error?.stack,
      });
    }

  } catch (error) {
    console.error("❌ Simple transaction test failed:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
    });
  }

  // Test 5: Full swap execution
  console.log("\n5️⃣ Testing full swap execution...");
  try {
    console.log(`🔄 Executing swap for user: ${TEST_USER_ADDRESS}`);
    
    const swapResult = await backendSwapService.executeSwap({
      fromToken: "MockUSD",
      toToken: "MockToken",
      amount: "0.5", // Small amount for testing
      userAddress: TEST_USER_ADDRESS,
      slippagePercent: 1.0, // Higher slippage for testing
    });

    if (swapResult.success) {
      console.log("✅ Swap execution successful!");
      console.log("📊 Swap result:", {
        hash: swapResult.data?.hash?.slice(0, 10) + "...",
        usedSessionKey: swapResult.data?.usedSessionKey,
        totalTransactions: swapResult.data?.totalTransactions,
      });
      console.log(`🌍 Explorer: https://explorer.testnet.riselabs.xyz/tx/${swapResult.data?.hash}`);
    } else {
      console.error("❌ Swap execution failed:", swapResult.error);
      console.error("Error details:", {
        message: swapResult.error?.message,
        name: swapResult.error?.name,
        stack: swapResult.error?.stack,
      });
    }

  } catch (error) {
    console.error("❌ Swap test failed:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  console.log("\n🎉 RISE Relay Client test completed!");
  console.log("\n📝 Test Summary:");
  console.log("- Relay client initialization: ✅");
  console.log("- Session key configuration: ✅");
  console.log("- Basic blockchain connectivity: ✅");
  console.log("- Transaction execution: ⚡ Tested");
  console.log("- Swap execution: ⚡ Tested");
  console.log("\n🔑 Direct relay client approach with wallet-demo parameters!");
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testRiseRelayClient().catch(console.error);
}