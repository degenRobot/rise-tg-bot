import "dotenv/config";
import { backendTransactionService } from "./src/services/backendTransactionService.js";
import { Address } from "viem";

async function testPrecallDebug() {
  console.log("🔍 Testing Backend Transaction with Precall Debug");
  console.log("===============================================\n");

  // Test with the correct user who has granted permissions
  const userAddress = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc" as Address;
  const telegramId = "1628036245";

  console.log("🔧 Backend service info:");
  console.log(backendTransactionService.getInfo());
  console.log("");

  // Create a simple test transaction
  const calls = [{
    to: "0xA0Cf798816D4b9b9866b5330EEa46a18382f251e" as `0x${string}`,
    value: BigInt("100000000000000"), // 0.0001 ETH
  }];

  const transactionProps = {
    calls,
    requiredPermissions: {
      calls: ["0xA0Cf798816D4b9b9866b5330EEa46a18382f251e"]
    }
  };

  console.log("🚀 Attempting transaction execution...");
  console.log("📋 Transaction details:");
  console.log("- To:", calls[0].to);
  console.log("- Value:", calls[0].value.toString());
  console.log("- From (user):", userAddress);
  console.log("");

  try {
    const result = await backendTransactionService.execute(transactionProps, userAddress);
    
    console.log("✅ Transaction execution result:");
    console.log("- Success:", result.success);
    console.log("- Used session key:", result.data?.usedSessionKey);
    console.log("- Hash:", result.data?.hash);
    console.log("- Error:", result.error);
    
    if (result.error) {
      console.log("\n🔍 Error details:");
      console.log(result.error);
    }
    
  } catch (error) {
    console.error("❌ Transaction execution failed:", error);
  }
}

testPrecallDebug().catch(console.error);