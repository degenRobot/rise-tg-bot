import "dotenv/config";
import { backendTransactionService } from "../src/services/backendTransactionService.js";
import { Address, encodeFunctionData, parseUnits, getAddress } from "viem";

// Match the exact token addresses from the precall
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

// Simple ERC20 ABI
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

async function testPrecallConsumption() {
  console.log("🔍 Testing Precall Consumption with Exact Granted Permissions");
  console.log("==========================================================\n");

  // Test with the correct user who has granted permissions
  const userAddress = getAddress("0x07b780E6D4D7177bd596e7caBf2725a471E685Dc");

  console.log("👤 User Address:", userAddress);
  console.log("🔧 Backend service info:");
  console.log(backendTransactionService.getInfo());
  console.log("");

  // Try a simple ERC20 transfer that matches the precall permissions
  console.log("📋 Creating ERC20 transfer call (should match precall)...");
  
  // Transfer 0.01 MockUSD to a test address
  const transferAmount = parseUnits("0.01", TOKENS.MockUSD.decimals);
  const toAddress = "0xA0Cf798816D4b9b9866b5330EEa46a18382f251e"; // Test recipient
  
  const transferCall = {
    to: TOKENS.MockUSD.address,
    data: encodeFunctionData({
      abi: ERC20ABI,
      functionName: "transfer",
      args: [toAddress as `0x${string}`, transferAmount],
    }),
  };

  console.log("✅ Transfer call created:");
  console.log("- Token:", TOKENS.MockUSD.symbol, TOKENS.MockUSD.address);
  console.log("- To:", toAddress);
  console.log("- Amount:", transferAmount.toString(), "(0.01 MockUSD)");
  console.log("- Call data:", transferCall.data);
  console.log("");

  const transactionProps = {
    calls: [transferCall],
    requiredPermissions: {
      calls: [TOKENS.MockUSD.address.toLowerCase()]
    }
  };

  console.log("🚀 Attempting to execute ERC20 transfer...");
  console.log("💡 This should consume the existing precall for MockUSD transfer");
  console.log("");

  try {
    const result = await backendTransactionService.execute(transactionProps, userAddress);
    
    console.log("📊 Transaction execution result:");
    console.log("- Success:", result.success);
    console.log("- Used session key:", result.data?.usedSessionKey);
    console.log("- Hash:", result.data?.hash);
    console.log("- Total transactions:", result.data?.totalTransactions);
    
    if (result.success) {
      console.log("\n🎉 SUCCESS! Precall consumption worked!");
      console.log("✅ The backend can execute transactions that match granted permissions");
    } else {
      console.log("\n❌ Error details:");
      console.log(result.error);
      
      if (result.error?.message?.includes("Invalid precall")) {
        console.log("\n💡 Still getting 'Invalid precall' - need to match exact precall structure");
      }
    }
    
  } catch (error) {
    console.error("❌ Transaction execution failed:", error);
    
    if (error?.message?.includes("Invalid precall")) {
      console.log("\n💡 The issue is that our transaction doesn't exactly match the stored precall");
      console.log("🔍 Need to understand the exact structure of the granted permissions");
    }
  }
}

testPrecallConsumption().catch(console.error);