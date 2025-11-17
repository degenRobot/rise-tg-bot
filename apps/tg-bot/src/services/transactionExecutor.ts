import { Address, createWalletClient, http, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { TransactionCall } from "../types/index.js";

const RISE_RPC_URL = process.env.RISE_RPC_URL!;
const BACKEND_SIGNER_PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY as `0x${string}`;
const BACKEND_SIGNER_ADDRESS = process.env.BACKEND_SIGNER_ADDRESS as Address;

// Define the chain configuration
const riseTestnet = {
  id: 11155931,
  name: "RISE Testnet",
  network: "rise-testnet",
  nativeCurrency: {
    name: "RISE",
    symbol: "RISE",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [RISE_RPC_URL] },
    public: { http: [RISE_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "RISE Explorer", url: "https://testnet-explorer.riselabs.xyz" },
  },
} as const;

export interface ExecutionResult {
  success: boolean;
  hash?: string;
  error?: string;
  usedSessionKey?: boolean;
  data?: any;
}

export interface ExecuteParams {
  calls: TransactionCall[];
  userAddress: Address;
  requiredPermissions?: {
    calls?: string[];
  };
}

class TransactionExecutor {
  private walletClient;
  private account;

  constructor() {
    this.account = privateKeyToAccount(BACKEND_SIGNER_PRIVATE_KEY);
    this.walletClient = createWalletClient({
      account: this.account,
      chain: riseTestnet,
      transport: http(RISE_RPC_URL),
    });

    console.log(`🔑 Transaction executor initialized with backend signer: ${BACKEND_SIGNER_ADDRESS}`);
  }

  /**
   * Execute transactions using the backend signer key (session key pattern)
   * This simulates the executeWithSessionKey pattern from wallet-demo
   */
  async executeWithSessionKey(params: ExecuteParams): Promise<ExecutionResult> {
    const { calls, userAddress } = params;
    
    try {
      console.log(`🚀 Executing ${calls.length} transaction(s) for user ${userAddress} using backend signer`);
      
      // Validate that we have the correct backend signer
      if (this.account.address.toLowerCase() !== BACKEND_SIGNER_ADDRESS.toLowerCase()) {
        throw new Error(`Backend signer address mismatch: ${this.account.address} !== ${BACKEND_SIGNER_ADDRESS}`);
      }

      // For single transaction, use sendTransaction
      if (calls.length === 1) {
        const call = calls[0];
        console.log(`📤 Sending single transaction to ${call.to}`);
        
        const hash = await this.walletClient.sendTransaction({
          to: call.to,
          data: call.data,
          value: call.value || 0n,
        });

        console.log(`✅ Transaction sent: ${hash}`);
        
        return {
          success: true,
          hash,
          usedSessionKey: true,
          data: { hash, usedSessionKey: true }
        };
      }

      // For multiple transactions, we need to send them sequentially
      // In a real session key implementation, these would be batched
      const hashes: string[] = [];
      
      for (let i = 0; i < calls.length; i++) {
        const call = calls[i];
        console.log(`📤 Sending transaction ${i + 1}/${calls.length} to ${call.to}`);
        
        const hash = await this.walletClient.sendTransaction({
          to: call.to,
          data: call.data,
          value: call.value || 0n,
        });

        hashes.push(hash);
        console.log(`✅ Transaction ${i + 1} sent: ${hash}`);
      }

      console.log(`🎉 All ${calls.length} transactions executed successfully`);
      
      return {
        success: true,
        hash: hashes[hashes.length - 1], // Return last hash for compatibility
        usedSessionKey: true,
        data: { 
          hashes, 
          usedSessionKey: true,
          totalTransactions: hashes.length
        }
      };

    } catch (error) {
      console.error("❌ Transaction execution failed:", error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        usedSessionKey: false,
        data: null
      };
    }
  }

  /**
   * Check if the backend signer has sufficient permissions/balance
   */
  async canExecute(params: ExecuteParams): Promise<{ canExecute: boolean; reason?: string }> {
    try {
      // Check backend signer balance
      const balance = await this.walletClient.getBalance({
        address: BACKEND_SIGNER_ADDRESS
      });

      console.log(`💰 Backend signer balance: ${balance} wei`);

      // Basic balance check - require at least 0.001 ETH for gas
      const minBalance = 1000000000000000n; // 0.001 ETH in wei
      if (balance < minBalance) {
        return {
          canExecute: false,
          reason: `Insufficient balance: ${balance} wei < ${minBalance} wei`
        };
      }

      return { canExecute: true };
      
    } catch (error) {
      console.error("❌ Failed to check execution capability:", error);
      return {
        canExecute: false,
        reason: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Get backend signer info for debugging
   */
  getSignerInfo() {
    return {
      address: this.account.address,
      configuredAddress: BACKEND_SIGNER_ADDRESS,
      chainId: riseTestnet.id,
      rpcUrl: RISE_RPC_URL
    };
  }
}

// Singleton instance
export const transactionExecutor = new TransactionExecutor();