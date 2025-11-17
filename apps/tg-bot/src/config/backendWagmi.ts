import { Chains, Porto } from "rise-wallet";
import { porto } from "rise-wallet/wagmi";
import { createClient, http } from "viem";
import { createConfig } from "wagmi";
import "dotenv/config";

// Export the porto connector instance for session key access (matching wallet-demo exactly)
export const portoConnector = porto(Porto.defaultConfig);

// Wagmi config matching wallet-demo pattern exactly
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

// Backend signer configuration
const BACKEND_SIGNER_PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY as `0x${string}`;
const BACKEND_SIGNER_ADDRESS = process.env.BACKEND_SIGNER_ADDRESS as `0x${string}`;

if (!BACKEND_SIGNER_PRIVATE_KEY) {
  throw new Error("BACKEND_SIGNER_PRIVATE_KEY environment variable is required");
}
if (!BACKEND_SIGNER_ADDRESS) {
  throw new Error("BACKEND_SIGNER_ADDRESS environment variable is required");
}

// Backend session key (we'll create this to match wallet-demo pattern)
export const backendSessionKey = {
  privateKey: BACKEND_SIGNER_PRIVATE_KEY,
  address: BACKEND_SIGNER_ADDRESS,
  publicKey: "", // Will be derived from private key
  type: "p256" as const,
};

console.log(`🔧 Backend wagmi configured with RISE wallet`);
console.log(`🔑 Backend signer: ${BACKEND_SIGNER_ADDRESS}`);
console.log(`⛓️  Chain: ${Chains.riseTestnet.name} (${Chains.riseTestnet.id})`);

// Declare wagmi module (matching wallet-demo)
declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}