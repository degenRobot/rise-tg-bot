import "dotenv/config";
import { P256 } from "ox";
import { storePermission } from "../src/services/permissionStore.js";
import { getAddress } from "viem";

// Get the correct backend session key
const backendPrivateKey = process.env.BACKEND_SIGNER_PRIVATE_KEY!;
const backendAddress = process.env.BACKEND_SIGNER_ADDRESS!;

async function getCorrectBackendKey() {
  console.log("🔑 Deriving correct backend session key...");
  console.log("=" .repeat(50));
  
  console.log(`📋 Backend address (from env): ${backendAddress}`);
  console.log(`🔐 Private key (first 10 chars): ${backendPrivateKey.slice(0, 10)}...`);
  
  // Derive P256 public key the same way the backend does
  const publicKeyBytes = P256.getPublicKey({ 
    privateKey: backendPrivateKey 
  });
  
  // Convert to hex format (same as backend logic)
  const keyBytes = publicKeyBytes instanceof Uint8Array ? 
    publicKeyBytes : 
    new Uint8Array([
      ...publicKeyBytes.x.toString(16).padStart(64, '0').match(/.{2}/g)!.map(x => parseInt(x, 16)), 
      ...publicKeyBytes.y.toString(16).padStart(64, '0').match(/.{2}/g)!.map(x => parseInt(x, 16))
    ]);
  
  const publicKeyHex = `0x${Buffer.from(keyBytes).toString('hex')}`;
  
  console.log(`\n🔑 Derived public key: ${publicKeyHex}`);
  console.log(`📏 Key length: ${publicKeyHex.length} characters`);
  console.log(`🎯 This is what should be stored as the permission key`);
  
  // Now update the stored permission with the correct public key
  const REAL_WALLET = getAddress("0x8Fb415fb0D62668fdfE63705919068fe551D1Ec6");
  const REAL_PERMISSION_ID = "0x038aebdbdecd7f4604fd6902b40be063e5fc3f7b" as `0x${string}`;
  const EXPIRY = 1764065704;
  
  console.log(`\n📦 Updating stored permission with correct public key...`);
  
  storePermission({
    walletAddress: REAL_WALLET,
    telegramId: "frontend_user",
    telegramHandle: "frontend_user",
    permission: {
      id: REAL_PERMISSION_ID,
      expiry: EXPIRY,
      keyPublicKey: publicKeyHex, // Use the correct derived public key
      keyType: "p256",
      permissions: {
        calls: [
          { to: undefined, signature: undefined } // Allow any calls
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
  
  console.log("✅ Permission updated with correct public key!");
  
  return publicKeyHex;
}

getCorrectBackendKey().catch(console.error);