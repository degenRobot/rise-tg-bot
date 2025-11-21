import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";

async function testBotFlow() {
  console.log("🤖 RISE Telegram Bot - Complete Flow Test");
  console.log("=========================================\n");

  const API_URL = "http://localhost:8008";
  
  // Test different Telegram IDs to avoid conflicts
  const testCases = [
    { telegramId: "555555555", handle: "alice_test" },
    { telegramId: "666666666", handle: "bob_test" },
  ];

  for (const testCase of testCases) {
    console.log(`\n📱 Testing with Telegram ID: ${testCase.telegramId}`);
    console.log(`👤 Handle: @${testCase.handle}`);
    
    // Step 1: Check initial status
    console.log("\n1️⃣ Checking initial status...");
    const statusBefore = await fetch(`${API_URL}/api/verify/status/${testCase.telegramId}`);
    const statusData = await statusBefore.json();
    console.log(`   Linked: ${statusData.linked ? "Yes" : "No"}`);
    
    if (!statusData.linked) {
      console.log("\n2️⃣ Simulating verification flow...");
      
      // Get verification message
      const messageRes = await fetch(`${API_URL}/api/verify/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: testCase.telegramId,
          telegramHandle: testCase.handle,
        }),
      });
      
      const { message } = await messageRes.json();
      console.log("   ✓ Got verification message");
      
      // Sign with test wallet
      const privateKey = "0x376e27e68a7412d0fb6b0c9acef39f6b49500e1e27667c315bb9b0aa00f109f9";
      const account = privateKeyToAccount(privateKey);
      const signature = await account.signMessage({ message });
      console.log("   ✓ Signed message");
      
      // Submit verification
      const verifyRes = await fetch(`${API_URL}/api/verify/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: account.address,
          signature,
          message,
          telegramId: testCase.telegramId,
          telegramHandle: testCase.handle,
        }),
      });
      
      const verifyData = await verifyRes.json();
      console.log(`   ✓ Verification: ${verifyData.success ? "Success" : "Failed"}`);
    }
    
    // Step 3: Check final status
    console.log("\n3️⃣ Checking final status...");
    const statusAfter = await fetch(`${API_URL}/api/verify/status/${testCase.telegramId}`);
    const finalStatus = await statusAfter.json();
    if (finalStatus.linked) {
      console.log(`   ✓ Linked to: ${finalStatus.accountAddress}`);
      console.log(`   ✓ Handle: @${finalStatus.telegramHandle}`);
    }
  }

  console.log("\n4️⃣ Testing bot message handling...");
  console.log("   The bot would now process messages like:");
  console.log("   - 'What's my balance?'");
  console.log("   - 'Send 10 MockUSD to 0x...'");
  console.log("   - 'Swap 50 MockUSD for MockToken'");
  
  console.log("\n✅ Bot flow test completed!");
  console.log("\n📝 Next steps:");
  console.log("1. Message @risechain_bot on Telegram");
  console.log("2. Send /link to get your personal link");
  console.log("3. Complete the verification in your browser");
  console.log("4. Start using natural language commands!");
}

testBotFlow().catch(console.error);