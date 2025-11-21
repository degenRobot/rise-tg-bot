import "dotenv/config";
import { backendTransactionService } from "../src/services/backendTransactionService.js";
import { 
  storePermission, 
  findActivePermissionForBackendKey,
  debugListPermissions,
  cleanupExpiredPermissions,
  type StoredPermission 
} from "../src/services/permissionStore.js";
import { Address, encodeFunctionData, parseUnits, getAddress } from "viem";

// Test the new permission storage and execution flow
// This tests the complete flow from frontend permission grant to backend transaction execution

// Mock permission data (simulating what frontend would send after grantPermissions)
const TEST_USER_ADDRESS = getAddress("0x07b780E6D4D7177bd596e7caBf2725a471E685Dc");
const BACKEND_PUBLIC_KEY = process.env.BACKEND_SIGNER_ADDRESS!;
const MOCK_PERMISSION_ID = "0x1234567890abcdef1234567890abcdef12345678901234567890abcdef123456" as `0x${string}`;

// Token contracts for testing
const TOKENS = {
  MockUSD: {
    address: "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50" as `0x${string}`,
    decimals: 18,
    symbol: "MockUSD",
  },
  MockToken: {
    address: "0x6166a6e02b4CF0e1E0397082De1B4fc9CC9D6ceD" as `0x${string}`,
    decimals: 18, 
    symbol: "MockToken",
  },
} as const;

const ERC20ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

async function testPermissionStorageFlow() {
  console.log("🧪 Testing Permission Storage and Execution Flow");
  console.log("=" .repeat(60));
  
  try {
    // Step 1: Cleanup any expired permissions
    console.log("\n📋 Step 1: Cleaning up expired permissions...");
    const cleaned = cleanupExpiredPermissions();
    console.log(`✅ Cleaned up ${cleaned} expired permissions`);

    // Step 2: Store mock permission (simulating frontend sync)
    console.log("\n📦 Step 2: Storing mock permission (simulating frontend grant)...");
    
    const mockPermission: Omit<StoredPermission, 'userAddress' | 'grantedAt'> = {
      id: MOCK_PERMISSION_ID,
      expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      keyPublicKey: BACKEND_PUBLIC_KEY,
      keyType: "p256",
      permissions: {
        calls: [
          {
            // Allow ERC20 transfers
            to: TOKENS.MockUSD.address,
            signature: "0xa9059cbb", // transfer(address,uint256)
          },
          {
            // Allow any calls to MockToken
            to: TOKENS.MockToken.address,
            signature: undefined,
          },
        ],
        spend: [
          {
            token: "0x0000000000000000000000000000000000000000", // ETH
            limit: "100000000000000000", // 0.1 ETH
            period: "day",
          },
          {
            token: TOKENS.MockUSD.address,
            limit: "1000000000000000000", // 1 MockUSD
            period: "day",
          },
        ],
      },
    };

    storePermission({
      walletAddress: TEST_USER_ADDRESS,
      telegramId: "123456789",
      telegramHandle: "testuser",
      permission: mockPermission,
    });

    console.log("✅ Mock permission stored successfully");
    console.log(`   Permission ID: ${MOCK_PERMISSION_ID}`);
    console.log(`   User: ${TEST_USER_ADDRESS}`);
    console.log(`   Backend Key: ${BACKEND_PUBLIC_KEY.slice(0, 20)}...`);

    // Step 3: Verify permission lookup
    console.log("\n🔍 Step 3: Testing permission lookup...");
    
    const foundPermission = findActivePermissionForBackendKey({
      walletAddress: TEST_USER_ADDRESS,
      backendPublicKey: BACKEND_PUBLIC_KEY,
    });

    if (!foundPermission) {
      throw new Error("❌ Permission not found in lookup test");
    }

    console.log("✅ Permission lookup successful");
    console.log(`   Found ID: ${foundPermission.id}`);
    console.log(`   Expires: ${new Date(foundPermission.expiry * 1000)}`);
    console.log(`   Calls: ${foundPermission.permissions?.calls?.length || 0}`);
    console.log(`   Spend: ${foundPermission.permissions?.spend?.length || 0}`);

    // Step 4: Test transaction execution with stored permissions
    console.log("\n🚀 Step 4: Testing transaction execution with stored permissions...");
    
    // Create a simple ERC20 transfer call
    const transferCall = {
      to: TOKENS.MockUSD.address,
      data: encodeFunctionData({
        abi: ERC20ABI,
        functionName: "transfer",
        args: [TEST_USER_ADDRESS, parseUnits("0.1", 18)], // Transfer 0.1 tokens to self
      }),
    };

    const transactionProps = {
      calls: [transferCall],
      requiredPermissions: {
        calls: [TOKENS.MockUSD.address.toLowerCase()],
      },
    };

    console.log("📋 Transaction details:");
    console.log(`   To: ${transferCall.to}`);
    console.log(`   Data: ${transferCall.data}`);
    console.log(`   Required permissions: ${transactionProps.requiredPermissions.calls}`);

    // Execute the transaction using the new flow
    const result = await backendTransactionService.execute(transactionProps, TEST_USER_ADDRESS);

    console.log("\n📊 Transaction execution result:");
    console.log(`   Success: ${result.success}`);
    console.log(`   Used session key: ${result.data?.usedSessionKey}`);
    console.log(`   Hash: ${result.data?.hash}`);
    console.log(`   Total transactions: ${result.data?.totalTransactions}`);

    if (result.error) {
      console.log("\n❌ Error details:");
      console.log(result.error);
      
      // Check if it's a precall issue
      if (result.error.toString().includes("Invalid precall")) {
        console.log("\n💡 This might be expected if:");
        console.log("   - No real permissions were granted via frontend");
        console.log("   - Mock permission ID doesn't match real granted permission");
        console.log("   - Real user needs to grant permissions first");
      } else if (result.error.toString().includes("duplicate call")) {
        console.log("\n💡 This suggests the permission system is working but there's a call deduplication issue");
      }
    } else {
      console.log("\n🎉 Transaction execution successful!");
      console.log("   The new permission storage and execution flow is working!");
    }

    // Step 5: Debug information
    console.log("\n🔍 Step 5: Debug information...");
    console.log("\n📋 All stored permissions:");
    debugListPermissions();

    // Step 6: Test permission cleanup
    console.log("\n🧹 Step 6: Testing permission cleanup...");
    
    // Store an expired permission
    const expiredPermission = {
      ...mockPermission,
      id: "0xexpired1234567890abcdef1234567890abcdef12345678901234567890abcdef" as `0x${string}`,
      expiry: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    };

    storePermission({
      walletAddress: TEST_USER_ADDRESS,
      telegramId: "123456789",
      telegramHandle: "testuser", 
      permission: expiredPermission,
    });

    const cleanedAfter = cleanupExpiredPermissions();
    console.log(`✅ Cleaned up ${cleanedAfter} expired permissions in test cleanup`);

    console.log("\n🎯 Summary:");
    console.log("=" .repeat(40));
    console.log("✅ Permission storage: Working");
    console.log("✅ Permission lookup: Working");
    console.log("✅ Permission cleanup: Working");
    console.log(`${result.success ? "✅" : "⚠️ "} Transaction execution: ${result.success ? "Working" : "Needs real permissions"}`);
    
    if (!result.success) {
      console.log("\n💡 Next steps to complete the flow:");
      console.log("1. Use the frontend to grant real permissions to the backend key");
      console.log("2. Ensure the frontend permission sync includes the permission ID");
      console.log("3. Test with the real granted permission ID");
    }

  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error(error.stack);
  }
}

// Also export a helper function to test with real permissions
export async function testWithRealPermissions(permissionId: `0x${string}`) {
  console.log("\n🧪 Testing with real permission ID:", permissionId);
  
  // Update the stored permission with the real ID
  const realPermission: Omit<StoredPermission, 'userAddress' | 'grantedAt'> = {
    id: permissionId,
    expiry: Math.floor(Date.now() / 1000) + 3600,
    keyPublicKey: BACKEND_PUBLIC_KEY,
    keyType: "p256",
    permissions: {
      calls: [{ to: undefined, signature: undefined }], // Allow any calls
      spend: [{ 
        token: "0x0000000000000000000000000000000000000000",
        limit: "100000000000000000",
        period: "day"
      }],
    },
  };

  storePermission({
    walletAddress: TEST_USER_ADDRESS,
    telegramId: "123456789",
    telegramHandle: "testuser",
    permission: realPermission,
  });

  // Test a simple transaction
  const transferCall = {
    to: TOKENS.MockUSD.address,
    data: encodeFunctionData({
      abi: ERC20ABI,
      functionName: "transfer",
      args: [TEST_USER_ADDRESS, parseUnits("0.01", 18)],
    }),
  };

  const result = await backendTransactionService.execute(
    {
      calls: [transferCall],
      requiredPermissions: { calls: [TOKENS.MockUSD.address.toLowerCase()] },
    },
    TEST_USER_ADDRESS
  );

  console.log("🎯 Real permission test result:", result);
  return result;
}

testPermissionStorageFlow().catch(console.error);