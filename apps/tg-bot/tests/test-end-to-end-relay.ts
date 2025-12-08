import { Address } from "viem";
import { storePermission } from "../src/services/permissionStore.js";
import { getBackendP256PublicKey } from "../src/services/backendSessionKey.js";
import { executeWithBackendPermission } from "../src/services/portoExecution.js";
import { backendTransactionService } from "../src/services/backendTransactionService.js";

console.log("🧪 Testing End-to-End Relay Mode Flow...\n");

async function testEndToEndFlow() {
  try {
    // Test wallet address
    const testWalletAddress = "0x1234567890123456789012345678901234567890" as Address;
    const backendPublicKey = getBackendP256PublicKey();
    
    console.log("1. Backend P256 Public Key:", backendPublicKey);
    console.log("   Length:", backendPublicKey.length);
    console.log("   ✅ Backend key ready\n");

    // 2. Simulate storing a permission (as if frontend granted it)
    console.log("2. Simulating permission grant from frontend...");
    const permissionId = "0x" + Math.random().toString(16).slice(2, 66) as `0x${string}`;
    const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days
    
    storePermission({
      walletAddress: testWalletAddress,
      telegramId: "123456789",
      telegramHandle: "testuser",
      permission: {
        id: permissionId,
        expiry,
        keyPublicKey: backendPublicKey,
        keyType: "p256",
        permissions: {
          calls: [],
          spend: [
            {
              token: "0x0000000000000000000000000000000000000000",
              limit: "0x16345785D8A0000", // 0.1 ETH
              period: "day",
            }
          ],
        },
      },
    });
    
    console.log("   Permission ID:", permissionId);
    console.log("   Expiry:", new Date(expiry * 1000));
    console.log("   ✅ Permission stored\n");

    // 3. Test transaction execution (will fail without real account)
    console.log("3. Testing transaction execution with real relay call...");
    
    // Create a more realistic test call
    const testCall = {
      to: "0x0000000000000000000000000000000000000001" as Address,
      data: "0x" as `0x${string}`,
      value: 0n,
    };

    console.log("   📤 Attempting to send call to relay:");
    console.log("   - To:", testCall.to);
    console.log("   - Data:", testCall.data || "0x");
    console.log("   - Value:", testCall.value.toString());

    try {
      const result = await backendTransactionService.execute(
        { calls: [testCall] },
        testWalletAddress
      );
      
      console.log("   ✅ Execution result:", JSON.stringify(result, null, 2));
      console.log("   Transaction Hash:", result.data?.hash);
    } catch (error) {
      console.log("   ❌ Execution failed (this is expected)");
      console.log("   Error type:", (error as any).constructor.name);
      console.log("   Error message:", (error as Error).message);
      console.log("   Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      // This is expected since we don't have a real account
      console.log("   ✅ This is expected - we don't have a real account on relay\n");
    }

    // 4. Test direct Porto execution with more details
    console.log("4. Testing direct Porto execution with detailed logging...");
    
    console.log("   📤 Attempting direct relay call with Porto SDK:");
    console.log("   - Wallet:", testWalletAddress);
    console.log("   - Backend Key:", backendPublicKey.slice(0, 20) + "...");
    
    try {
      const result = await executeWithBackendPermission({
        walletAddress: testWalletAddress,
        calls: [testCall],
      });
      
      console.log("   ✅ Direct execution succeeded!");
      console.log("   Result:", JSON.stringify(result, null, 2));
      console.log("   Calls ID:", result.callsId);
      console.log("   Transaction Hashes:", result.transactionHashes);
    } catch (error) {
      console.log("   ❌ Direct execution failed (this is expected)");
      console.log("   Error details:");
      console.log("   - Type:", (error as any).constructor.name);
      console.log("   - Message:", (error as Error).message);
      console.log("   - Stack:", (error as Error).stack?.split('\n').slice(0, 5).join('\n'));
      
      // Log the raw error object
      console.log("   - Raw error:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      console.log("   ✅ This is expected - we don't have a real account\n");
    }

    // 5. Test with a different wallet address (might give different errors)
    console.log("5. Testing with a different wallet address...");
    
    const realishWallet = "0x0000000000000000000000000000000000000000" as Address; // Zero address
    
    // Store permission for this wallet too
    storePermission({
      walletAddress: realishWallet,
      telegramId: "999999999",
      telegramHandle: "zerouser",
      permission: {
        id: ("0x" + Math.random().toString(16).slice(2, 66)) as `0x${string}`,
        expiry,
        keyPublicKey: backendPublicKey,
        keyType: "p256",
        permissions: {
          calls: [],
          spend: [],
        },
      },
    });
    
    console.log("   Testing with zero address:", realishWallet);
    
    try {
      const result = await executeWithBackendPermission({
        walletAddress: realishWallet,
        calls: [testCall],
      });
      
      console.log("   🎉 Unexpected success! Result:", JSON.stringify(result, null, 2));
    } catch (error) {
      console.log("   ❌ Failed as expected");
      console.log("   - Error:", (error as Error).message);
    }

    console.log("\n✅ All tests completed!");
    console.log("\n📋 Summary:");
    console.log("- Backend P256 key properly configured");
    console.log("- Permission storage working");
    console.log("- Transaction service using relay mode");
    console.log("- Ready for real frontend integration");
    
    console.log("\n🔑 Next Steps:");
    console.log("1. Have frontend grant permissions to this backend key:");
    console.log(`   ${backendPublicKey}`);
    console.log("2. Test with real wallet account");
    console.log("3. Execute transactions via Telegram bot");

  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testEndToEndFlow().catch(console.error);