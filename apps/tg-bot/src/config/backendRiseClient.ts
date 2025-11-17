import { createClient, http } from "viem";
import { Chains, Porto } from "rise-wallet";
import "dotenv/config";

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
 * Uses direct relay client approach since wagmi connectors are designed for browser environments.
 * However, we now use the exact parameter structure from wallet-demo.
 */

// Create direct relay client for backend use
export const riseRelayClient = createClient({
  transport: Porto.defaultConfig.relay,
});

// Regular viem client for basic blockchain operations (wallet-demo line 17-19)
export const risePublicClient = createClient({
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

console.log(`🔧 Backend RISE client configured (direct relay approach)`);
console.log(`🔑 Backend signer: ${BACKEND_SIGNER_ADDRESS}`);
console.log(`⛓️  Chain: ${Chains.riseTestnet.name} (${Chains.riseTestnet.id})`);
console.log(`🌐 Using relay client: ${typeof Porto.defaultConfig.relay}`);

export { Chains };