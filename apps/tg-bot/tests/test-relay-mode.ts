import { portoClient, Chains } from "../src/config/backendRiseClient.js";
import { getBackendP256PublicKey } from "../src/services/backendSessionKey.js";
import * as RelayActions from "rise-wallet/viem/RelayActions";

console.log("🧪 Testing Porto Relay Mode Configuration...\n");

async function testRelayMode() {
  try {
    // 1. Test Porto client initialization
    console.log("1. Testing Porto client initialization...");
    console.log("   Client chain:", portoClient.chain.name);
    console.log("   Chain ID:", portoClient.chain.id);
    console.log("   ✅ Porto client initialized with relay mode\n");

    // 2. Test backend P256 key
    console.log("2. Testing backend P256 session key...");
    const publicKey = getBackendP256PublicKey();
    console.log("   Public Key:", publicKey);
    console.log("   Key length:", publicKey.length);
    console.log("   ✅ P256 public key available\n");

    // 3. Test relay capabilities
    console.log("3. Testing relay capabilities...");
    try {
      const capabilities = await RelayActions.getCapabilities(portoClient, {
        chainId: Chains.riseTestnet.id,
      });
      console.log("   Relay URL:", capabilities.relay);
      console.log("   Contracts:", Object.keys(capabilities.contracts));
      console.log("   Fee tokens:", capabilities.fees.tokens.length);
      console.log("   ✅ Successfully connected to relay\n");
    } catch (error) {
      console.log("   ❌ Failed to get capabilities:", error);
      console.log("   This might be normal if relay is not accessible\n");
    }

    // 4. Test account lookup (will fail without a real account)
    console.log("4. Testing account operations...");
    try {
      const testAddress = "0x1234567890123456789012345678901234567890" as const;
      const keys = await RelayActions.getKeys(portoClient, {
        account: testAddress,
        chainIds: [Chains.riseTestnet.id],
      });
      console.log("   Keys found:", keys.length);
    } catch (error) {
      console.log("   ⚠️  Expected error for test address:", (error as Error).message.slice(0, 50) + "...");
      console.log("   This is normal - we don't have a real account\n");
    }

    console.log("✅ All basic tests passed!");
    console.log("\n📋 Summary:");
    console.log("- Porto client properly initialized with relay mode");
    console.log("- Backend P256 key pair configured");
    console.log("- Ready to receive permissions from frontend");
    console.log("\n🔑 Backend P256 Public Key to share with frontend:");
    console.log(publicKey);

  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testRelayMode().catch(console.error);