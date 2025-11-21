import "dotenv/config";
import { storePermission, findActivePermissionForBackendKey, debugListPermissions } from "../src/services/permissionStore.js";
import { getAddress } from "viem";

// Real data from the frontend logs
const REAL_WALLET = getAddress("0x8Fb415fb0D62668fdfE63705919068fe551D1Ec6");
const REAL_PERMISSION_ID = "0x038aebdbdecd7f4604fd6902b40be063e5fc3f7b" as `0x${string}`;
const BACKEND_KEY = process.env.BACKEND_SIGNER_ADDRESS!;
const EXPIRY = 1764065704; // From frontend logs

async function storeRealPermissionData() {
  console.log("📦 Storing real permission data from frontend logs...");
  console.log("=" .repeat(50));
  
  console.log("🔍 Real data:");
  console.log(`   Wallet: ${REAL_WALLET}`);
  console.log(`   Permission ID: ${REAL_PERMISSION_ID}`);
  console.log(`   Backend Key: ${BACKEND_KEY}`);
  console.log(`   Expiry: ${new Date(EXPIRY * 1000)}`);
  
  // Store the real permission data
  storePermission({
    walletAddress: REAL_WALLET,
    telegramId: "frontend_user", // We don't have the real telegram ID
    telegramHandle: "frontend_user",
    permission: {
      id: REAL_PERMISSION_ID,
      expiry: EXPIRY,
      keyPublicKey: BACKEND_KEY,
      keyType: "p256",
      permissions: {
        calls: [
          // Allow any calls (based on the permission structure)
          { to: undefined, signature: undefined }
        ],
        spend: [
          {
            token: "0x0000000000000000000000000000000000000000", // ETH
            limit: "100000000000000000", // 0.1 ETH
            period: "day",
          }
        ],
      },
    },
  });

  console.log("\n✅ Permission stored!");

  // Test lookup
  console.log("\n🔍 Testing permission lookup...");
  const found = findActivePermissionForBackendKey({
    walletAddress: REAL_WALLET,
    backendPublicKey: BACKEND_KEY,
  });

  if (found) {
    console.log("✅ Permission lookup successful!");
    console.log(`   Found ID: ${found.id}`);
    console.log(`   Expires: ${new Date(found.expiry * 1000)}`);
  } else {
    console.log("❌ Permission lookup failed!");
  }

  // Debug all permissions
  console.log("\n📋 All stored permissions:");
  debugListPermissions();
}

storeRealPermissionData().catch(console.error);