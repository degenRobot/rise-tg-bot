import { createClient, http, createPublicClient } from "viem";
import { Chains, Porto } from "rise-wallet";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env from monorepo root
config({ path: resolve(process.cwd(), "../../.env") });

// Backend signer configuration
const BACKEND_SIGNER_PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY as `0x${string}`;
const BACKEND_SIGNER_ADDRESS = process.env.BACKEND_SIGNER_ADDRESS as `0x${string}`;

if (!BACKEND_SIGNER_PRIVATE_KEY) {
  throw new Error("BACKEND_SIGNER_PRIVATE_KEY environment variable is required");
}
if (!BACKEND_SIGNER_ADDRESS) {
  throw new Error("BACKEND_SIGNER_ADDRESS environment variable is required");
}

/**
 * Backend RISE Client Configuration
 *
 * Uses Porto.create with mode: relay as recommended by Hasan.
 * The SDK handles precall storage and management automatically.
 */

// Create Porto client for backend use with relay mode
// Note: Porto.create needs to be called differently - using defaultConfig.relay transport
export const portoClient = createClient({
  chain: Chains.riseTestnet,
  transport: Porto.defaultConfig.relay,
});

// Regular viem client for basic blockchain operations (with public actions)
export const risePublicClient = createPublicClient({
  chain: Chains.riseTestnet,
  transport: http("https://testnet.riselabs.xyz"),
});

// Backend session key configuration
export const backendSessionKey = {
  privateKey: BACKEND_SIGNER_PRIVATE_KEY,
  address: BACKEND_SIGNER_ADDRESS,
  publicKey: "", // Will be derived from private key
  type: "p256" as const,
};

console.log(`🔧 Backend RISE client configured with Porto.create (relay mode)`);
console.log(`🔑 Backend signer: ${BACKEND_SIGNER_ADDRESS}`);
console.log(`⛓️  Chain: ${Chains.riseTestnet.name} (${Chains.riseTestnet.id})`);

export { Chains };