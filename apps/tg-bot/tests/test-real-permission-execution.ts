import "dotenv/config";
import { backendTransactionService } from "../src/services/backendTransactionService.js";
import { Address, encodeFunctionData, parseUnits, getAddress } from "viem";

// Real wallet that has granted permissions
const REAL_WALLET = getAddress("0x8Fb415fb0D62668fdfE63705919068fe551D1Ec6");

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

async function testRealPermissionExecution() {
  console.log("🧪 Testing Transaction Execution with Real Permission");
  console.log("=" .repeat(60));
  
  console.log(`👤 User wallet: ${REAL_WALLET}`);
  console.log(`🔧 Backend info:`);
  console.log(backendTransactionService.getInfo());
  console.log("");

  try {
    // Test 1: Simple ERC20 transfer
    console.log("📝 Test 1: Simple ERC20 transfer...");
    
    const transferCall = {
      to: TOKENS.MockUSD.address,
      data: encodeFunctionData({
        abi: ERC20ABI,
        functionName: "transfer",
        args: [REAL_WALLET, parseUnits("0.001", 18)], // Transfer 0.001 tokens to self
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
    console.log(`   Function: transfer`);
    console.log(`   Amount: 0.001 MockUSD`);
    console.log(`   Required permissions: ${transactionProps.requiredPermissions.calls}`);
    console.log("");

    console.log("🚀 Executing transaction...");
    const result = await backendTransactionService.execute(transactionProps, REAL_WALLET);

    console.log("\n📊 Transaction execution result:");
    console.log("=" .repeat(40));
    console.log(`✨ Success: ${result.success}`);
    console.log(`🔑 Used session key: ${result.data?.usedSessionKey}`);
    console.log(`🆔 Hash: ${result.data?.hash}`);
    console.log(`📦 Total transactions: ${result.data?.totalTransactions}`);

    if (result.error) {
      console.log("\n❌ Error details:");
      console.log(result.error);
      
      if (result.error.toString().includes("Invalid precall")) {
        console.log("\n💡 Analysis: Still getting 'Invalid precall' error");
        console.log("   This suggests the permission ID might not be the actual Porto permission ID");
        console.log("   The permission ID from the frontend logs might be the backend key address");
        console.log("   We need to check the actual Porto grant result structure");
      } else if (result.error.toString().includes("No active permission")) {
        console.log("\n💡 Analysis: Permission lookup failed");
        console.log("   Check if permission was stored correctly");
      } else {
        console.log("\n💡 Analysis: Different error occurred");
      }
    } else {
      console.log("\n🎉 SUCCESS! Transaction executed successfully!");
      console.log("   The new permission storage and execution flow is working!");
      console.log("   No more 'Invalid precall' errors!");
    }

    // Test 2: Check current permissions via API
    console.log("\n🔍 Test 2: Check stored permissions...");
    
    // This should now show the stored permission
    const walletPermissions = await fetch(`http://localhost:8008/api/permissions/wallet/${REAL_WALLET}`)
      .then(r => r.json())
      .catch(() => null);
      
    if (walletPermissions && !walletPermissions.error) {
      console.log("✅ Permissions found via API:");
      console.log(`   Total: ${walletPermissions.totalPermissions}`);
      console.log(`   Active: ${walletPermissions.activePermissions}`);
      console.log(`   Has backend permission: ${walletPermissions.hasBackendPermission}`);
    } else {
      console.log("❌ No permissions found via API");
    }

  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error(error.stack);
  }
}

testRealPermissionExecution().catch(console.error);