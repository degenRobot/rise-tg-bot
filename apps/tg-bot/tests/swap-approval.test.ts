import "dotenv/config";
import { backendSwapService, TOKENS } from "../src/services/backendSwapService.js";
import { parseUnits } from "viem";

async function testSwapApprovalAmounts() {
  console.log("🧪 Testing Swap Approval Amounts");
  console.log("=" .repeat(60));

  // Test different swap amounts to ensure approval matches exactly
  const testAmounts = [
    { amount: "1", description: "Small swap (1 token)" },
    { amount: "50", description: "Previous hardcoded limit (50 tokens)" },
    { amount: "100", description: "Large swap (100 tokens)" },
    { amount: "999.99", description: "Very large swap (999.99 tokens)" },
  ];

  for (const test of testAmounts) {
    console.log(`\n📊 Testing ${test.description}`);
    
    const fromToken = "MockUSD";
    const toToken = "MockToken";
    const amountIn = parseUnits(test.amount, TOKENS[fromToken].decimals);
    
    try {
      // Build swap calls
      const { calls } = backendSwapService.buildSwapCalls({
        fromToken,
        toToken,
        amountIn,
        userAddress: "0x0000000000000000000000000000000000000000", // dummy address for test
      });

      // Check that we have 2 calls (approve + swap)
      if (calls.length !== 2) {
        console.error(`❌ Expected 2 calls, got ${calls.length}`);
        continue;
      }

      // Decode the approve call to check the amount
      const approveCall = calls[0];
      
      // Extract the amount from the encoded data
      // The approve function data includes: selector (4 bytes) + spender (32 bytes) + amount (32 bytes)
      const approveData = approveCall.data as `0x${string}`;
      
      // Skip function selector (0x095ea7b3) and spender address
      const amountHex = "0x" + approveData.slice(74); // 10 (0x + selector) + 64 (spender)
      const approvedAmount = BigInt(amountHex);

      console.log(`✅ Swap amount: ${test.amount} tokens (${amountIn.toString()} wei)`);
      console.log(`✅ Approved amount: ${approvedAmount.toString()} wei`);
      
      // Verify approval amount matches swap amount exactly
      if (approvedAmount === amountIn) {
        console.log(`✅ PASS: Approval amount matches swap amount exactly`);
      } else {
        console.error(`❌ FAIL: Approval amount (${approvedAmount}) does not match swap amount (${amountIn})`);
      }

    } catch (error) {
      console.error(`❌ Error testing ${test.description}:`, error);
    }
  }
  
  console.log("\n✅ Swap approval amount test completed");
}

// Run the test
testSwapApprovalAmounts().catch(console.error);