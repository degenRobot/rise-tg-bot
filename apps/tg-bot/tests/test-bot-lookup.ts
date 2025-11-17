import "dotenv/config";

async function testBotLookup() {
  console.log("🤖 Testing Bot Account Lookup");
  console.log("=============================\n");

  const telegramId = "1628036245"; // The ID from our real test
  const apiUrl = `http://localhost:${process.env.PORT || 8008}/api/users/by-telegram/${telegramId}`;
  
  console.log(`Testing bot lookup for Telegram ID: ${telegramId}`);
  console.log(`API URL: ${apiUrl}`);
  console.log("");

  try {
    console.log("Making request to bot lookup endpoint...");
    const response = await fetch(apiUrl);
    
    console.log("Response status:", response.status);
    console.log("Response headers:", Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const userData = await response.json();
      console.log("\n✅ Bot lookup successful!");
      console.log("User data:", JSON.stringify(userData, null, 2));
      console.log("");
      console.log("Key fields for bot:");
      console.log("- Account Address:", userData.accountAddress);
      console.log("- Telegram Handle:", userData.telegramHandle);
      console.log("- Verified:", userData.verified);
      console.log("- Session Key:", userData.sessionKey || "Not set");
      
    } else {
      const errorData = await response.json().catch(() => ({ error: "Could not parse error response" }));
      console.log("\n❌ Bot lookup failed!");
      console.log("Error:", errorData);
      
      if (response.status === 404) {
        console.log("\n🔍 Debugging 404 error:");
        console.log("1. Check if verification completed successfully");
        console.log("2. Verify the Telegram ID matches exactly");
        console.log("3. Check if verification storage is working");
        console.log("");
        console.log("To debug, run: npm run test:end-to-end");
      }
    }
  } catch (error) {
    console.error("\n💥 Request failed:", error.message);
    console.log("\nPossible issues:");
    console.log("1. Backend server not running (run: npm run dev)");
    console.log("2. Network connectivity issue");
    console.log("3. Port mismatch");
  }
}

testBotLookup().catch(console.error);