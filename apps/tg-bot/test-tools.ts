import { transactionBuilder } from "./src/tools/transactionBuilder.js";
import { apiCaller } from "./src/tools/apiCaller.js";
import { eventWatcher } from "./src/tools/eventWatcher.js";

// Helper to handle BigInt serialization
function jsonStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 2);
}

async function testTools() {
  console.log("Testing Transaction Builder Tools...\n");

  // Test mint tool
  console.log("1. Testing Mint Tool:");
  const mintResult = await transactionBuilder.mint.execute({
    tokenSymbol: "MockUSD" as any,
  });
  console.log("Mint result:", jsonStringify(mintResult));
  console.log("\n");

  // Test transfer tool
  console.log("2. Testing Transfer Tool:");
  const transferResult = await transactionBuilder.transfer.execute({
    tokenSymbol: "RISE" as any,
    to: "0x1234567890123456789012345678901234567890",
    amount: "0.1",
  });
  console.log("Transfer result:", jsonStringify(transferResult));
  console.log("\n");

  // Test swap tool
  console.log("3. Testing Swap Tool:");
  const swapResult = await transactionBuilder.swap.execute({
    fromToken: "MockUSD" as any,
    toToken: "MockToken" as any,
    amount: "10",
    slippagePercent: 0.5,
  });
  console.log("Swap result:", jsonStringify(swapResult));
  console.log("\n");

  // Test API caller tools
  console.log("4. Testing API Caller - Get Balances:");
  const balancesResult = await apiCaller.getBalances.execute({
    address: "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc", // Example address from the API URL you provided
  });
  console.log("Balances result:", jsonStringify(balancesResult));
  console.log("\n");

  // Test wallet summary
  console.log("5. Testing API Caller - Get Wallet Summary:");
  const summaryResult = await apiCaller.getWalletSummary.execute({
    address: "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc",
  });
  console.log("Wallet summary result:", jsonStringify(summaryResult));
  console.log("\n");

  // Test event watcher
  console.log("6. Testing Event Watcher - Create Alert:");
  const alertResult = await eventWatcher.createAlert.execute({
    type: "balance_threshold" as any,
    config: {
      token: "RISE",
      threshold: 100,
      direction: "below" as any,
    },
  });
  console.log("Alert result:", jsonStringify(alertResult));
  console.log("\n");

  console.log("All tool tests completed!");
}

testTools().catch(console.error);