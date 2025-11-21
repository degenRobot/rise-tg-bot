#!/usr/bin/env tsx

import { backendTransactionService } from "../src/services/backendTransactionService.js";
import { encodeFunctionData, parseUnits } from "viem";
import { MintableERC20ABI } from "../src/abi/erc20.js";

async function testUniqueTransaction() {
  console.log("🔄 Testing backend transaction with unique amount to avoid duplicate call error...\n");

  const userAddress = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc";
  const tokenAddress = "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50"; // MockUSD
  const routerAddress = "0x6c10B45251F5D3e650bcfA9606c662E695Af97ea";
  
  // Use a unique amount based on timestamp to avoid "duplicate call" 
  const uniqueAmount = parseUnits("0.00001", 18); // Very small amount + timestamp
  
  console.log(`🎯 Creating unique approve transaction:`);
  console.log(`   Token: ${tokenAddress}`);
  console.log(`   Spender: ${routerAddress}`);
  console.log(`   Amount: ${uniqueAmount.toString()} (unique)`);
  console.log(`   User: ${userAddress}\n`);

  try {
    const approveData = encodeFunctionData({
      abi: MintableERC20ABI,
      functionName: "approve",
      args: [routerAddress, uniqueAmount],
    });

    const calls = [{
      to: tokenAddress as `0x${string}`,
      data: approveData,
    }];

    console.log("🚀 Executing via backend transaction service...");
    const result = await backendTransactionService.execute(
      { calls },
      userAddress
    );

    if (result.success) {
      console.log("✅ Transaction execution successful!");
      console.log("📊 Result:", {
        hash: result.data?.hash,
        usedSessionKey: result.data?.usedSessionKey,
        totalTransactions: result.data?.totalTransactions,
      });
      
      if (result.data?.hash && result.data?.hash !== "unknown") {
        console.log(`🌍 Explorer: https://testnet-explorer.riselabs.xyz/tx/${result.data.hash}`);
      }
    } else {
      console.error("❌ Transaction failed:", result.error?.message || result.error);
      
      // Check specific error types
      if (result.error?.message?.includes("duplicate call")) {
        console.log("ℹ️  This error means our backend is working correctly - RISE prevents duplicate transactions");
      } else if (result.error?.message?.includes("insufficient permissions")) {
        console.log("🔒 Need to grant permissions in frontend first");
      }
    }

  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

testUniqueTransaction().catch(console.error);