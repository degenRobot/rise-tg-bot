import { Address, createPublicClient, createWalletClient, http } from "viem";
import { riseTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";


// Environment variables
const RISE_RPC_URL = process.env.RISE_RPC_URL || "https://testnet.riselabs.xyz";
const BACKEND_SIGNER_PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY as `0x${string}`;
const BACKEND_SIGNER_ADDRESS = process.env.BACKEND_SIGNER_ADDRESS as Address;

if (!BACKEND_SIGNER_PRIVATE_KEY) {
  throw new Error("BACKEND_SIGNER_PRIVATE_KEY environment variable is required");
}
if (!BACKEND_SIGNER_ADDRESS) {
  throw new Error("BACKEND_SIGNER_ADDRESS environment variable is required");
}

// Create account from private key (session key equivalent)
export const backendAccount = privateKeyToAccount(BACKEND_SIGNER_PRIVATE_KEY);
console.log("here's the backend account: ", backendAccount)

// Public client for reading blockchain state
export const publicClient = createPublicClient({
  chain: riseTestnet,
  transport: http(RISE_RPC_URL),
});

// Wallet client for signing transactions (session key equivalent)
export const walletClient = createWalletClient({
  account: backendAccount,
  chain: riseTestnet,
  transport: http(RISE_RPC_URL),
});

// Export configuration for easy access
export const config = {
  chain: riseTestnet,
  rpcUrl: RISE_RPC_URL,
  backendSigner: {
    address: BACKEND_SIGNER_ADDRESS,
    account: backendAccount,
  },
  clients: {
    public: publicClient,
    wallet: walletClient,
  }
};

// Verify configuration on import
console.log(`🔧 Backend client configured for RISE Testnet`);
console.log(`🔑 Backend signer: ${BACKEND_SIGNER_ADDRESS}`);
console.log(`🌐 RPC URL: ${RISE_RPC_URL}`);

// Validate that private key matches configured address
if (backendAccount.address.toLowerCase() !== BACKEND_SIGNER_ADDRESS.toLowerCase()) {
  throw new Error(
    `Backend signer address mismatch: private key generates ${backendAccount.address}, but configured address is ${BACKEND_SIGNER_ADDRESS}`
  );
}