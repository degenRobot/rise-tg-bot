import { Chains, Porto } from "rise-wallet";
import { porto } from "rise-wallet/wagmi";
import { createClient, http } from "viem";
import { createConfig } from "wagmi";
import "dotenv/config";

// Export the porto connector instance for session key access (matching wallet-demo exactly)
export const portoConnector = porto(Porto.defaultConfig);

// Wagmi config matching wallet-demo pattern
export const config = createConfig({
  chains: [Chains.riseTestnet],
  connectors: [portoConnector],
  transports: {
    [Chains.riseTestnet.id]: http("https://testnet.riselabs.xyz"),
  },
});

// Client for reading blockchain state
export const client = createClient({
  transport: http("https://testnet.riselabs.xyz"),
});

// Environment variables for backend signer (session key)
const BACKEND_SIGNER_PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY as `0x${string}`;
const BACKEND_SIGNER_ADDRESS = process.env.BACKEND_SIGNER_ADDRESS as `0x${string}`;

if (!BACKEND_SIGNER_PRIVATE_KEY) {
  throw new Error("BACKEND_SIGNER_PRIVATE_KEY environment variable is required");
}
if (!BACKEND_SIGNER_ADDRESS) {
  throw new Error("BACKEND_SIGNER_ADDRESS environment variable is required");
}

// Backend session key configuration
export const backendSessionKey = {
  // This will be our P256 key pair for signing (simulating session key)
  privateKey: BACKEND_SIGNER_PRIVATE_KEY,
  // We'll derive the public key from the private key
  publicKey: "", // Will be computed
  type: "p256" as const,
  address: BACKEND_SIGNER_ADDRESS,
};

console.log(`🔧 RISE Wallet backend configured`);
console.log(`🔑 Backend signer address: ${BACKEND_SIGNER_ADDRESS}`);
console.log(`⛓️  Chain: ${Chains.riseTestnet.name} (${Chains.riseTestnet.id})`);
console.log(`🌐 RPC: https://testnet.riselabs.xyz`);

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}