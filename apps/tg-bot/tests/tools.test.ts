import { readTools } from "../src/tools/readTools.js";
import { eventWatcher } from "../src/tools/eventWatcher.js";

// Helper to handle BigInt serialization
function jsonStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 2);
}

async function testTools() {
  console.log("Testing Read Tools...\n");

  const context = {
    sessionID: "test",
    messageID: "test",
    agent: "test",
    abort: new AbortController().signal
  };

  // Test readTools - Get Balances
  console.log("1. Testing Get Balances:");
  const balancesResultString = await readTools.getBalances.execute({
    address: "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc",
  }, context);
  const balancesResult = JSON.parse(balancesResultString);
  console.log("Balances result:", jsonStringify(balancesResult));
  console.log("\n");

  // Test wallet summary
  console.log("2. Testing Get Wallet Summary:");
  const summaryResultString = await readTools.getWalletSummary.execute({
    address: "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc",
  }, context);
  const summaryResult = JSON.parse(summaryResultString);
  console.log("Wallet summary result:", jsonStringify(summaryResult));
  console.log("\n");


  console.log("All tool tests completed!");
}

testTools().catch(console.error);