import * as Key from "rise-wallet/viem/Key";
import * as Hex from "ox/Hex";

console.log("\n🔑 Generating new P256 session key...\n");

// Generate random P256 private key
const randomBytes = new Uint8Array(32);
crypto.getRandomValues(randomBytes);
const privateKey = Hex.fromBytes(randomBytes);

// Create P256 key
const key = Key.fromP256({
  privateKey: privateKey as `0x${string}`,
  role: 'session',
  expiry: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365, // 1 year
});

console.log("✅ Generated P256 Key:");
console.log("Private Key:", privateKey);
console.log("Public Key:", key.publicKey);
console.log("\n📝 Add this to your .env file:");
console.log(`BACKEND_SIGNER_PRIVATE_KEY=${privateKey}`);
console.log("\n📝 And this to frontend .env.local:");
console.log(`NEXT_PUBLIC_BACKEND_KEY_ADDRESS=${key.publicKey}`);
