import { http, createPublicClient } from "viem";
import { Chains, Porto, Mode } from "rise-wallet";
import * as RelayClient from "rise-wallet/viem/RelayClient";
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

// Create Porto instance with relay mode for backend use
export const porto = Porto.create({
  chains: [Chains.riseTestnet],
  mode: Mode.relay(),
  relay: http("https://relay.wallet.risechain.com"),
});

// Extract the viem client for RelayActions
// Use RelayClient.fromPorto to get a proper viem client with relay transport
export const portoClient = RelayClient.fromPorto(porto, {
  chainId: Chains.riseTestnet.id,
});

// Regular viem client for basic blockchain operations (with public actions)
export const risePublicClient = createPublicClient({
  chain: Chains.riseTestnet,
  transport: http("https://testnet.riselabs.xyz"),
});

// Backend signer configuration
// Note: The actual P256 session key will be generated separately
// This EOA private key is just for backend operations
export const backendSigner = {
  privateKey: BACKEND_SIGNER_PRIVATE_KEY,
  address: BACKEND_SIGNER_ADDRESS,
};

console.log(`🔧 Backend RISE client configured with Porto.create (relay mode)`);
console.log(`🔑 Backend EOA address: ${BACKEND_SIGNER_ADDRESS}`);
console.log(`⛓️  Chain: ${Chains.riseTestnet.name} (${Chains.riseTestnet.id})`);

export { Chains };