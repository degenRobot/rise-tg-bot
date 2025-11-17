import { Address, Hex, encodeFunctionData } from "viem";
import { config, walletClient, publicClient } from "../config/client.js";

// Types matching wallet-demo exactly
export type TransactionCall = {
  to: Hex;
  data?: Hex;
  value?: bigint;
};

export type TransactionProps = {
  calls: TransactionCall[];
  requiredPermissions?: {
    calls?: string[];
  };
};

export type TransactionData = {
  hash: string;
  success: boolean;
  usedSessionKey?: boolean;
  keyId?: string;
  totalTransactions?: number;
};

export type ExecutionResult = {
  success: boolean;
  error: any;
  data: TransactionData | null;
};

/**
 * Transaction service that mimics wallet-demo's useTransaction hook
 * Uses backend signer as a "session key" to execute transactions on behalf of users
 */
class TransactionService {
  
  /**
   * Main execute function (equivalent to useTransaction.execute)
   * Executes transactions using the backend signer as session key
   */
  async execute(props: TransactionProps): Promise<ExecutionResult> {
    console.log("🚀 Executing transactions using backend session key...");
    const { calls, requiredPermissions } = props;

    try {
      // Log transaction details (matching wallet-demo pattern)
      console.log("📋 Transaction details:");
      console.log("- Calls:", calls.length);
      console.log("- Required permissions:", requiredPermissions?.calls);
      console.log("- Backend signer:", config.backendSigner.address);

      // Note: Gas is sponsored by RISE wallet, so no balance check needed
      console.log(`🎉 Using gas-sponsored transactions via RISE wallet`);

      // Execute the transaction(s) using backend signer
      // This mimics the "executeWithSessionKey" behavior but uses direct signing
      const result = await this.executeWithBackendSigner(calls);
      
      return {
        success: true,
        error: null,
        data: { ...result, usedSessionKey: true }
      };

    } catch (error) {
      console.error("❌ Transaction execution failed:", error);
      return {
        success: false,
        error,
        data: null
      };
    }
  }

  /**
   * Execute transactions with backend signer (equivalent to executeWithSessionKey)
   * This function mimics the wallet-demo session key execution but uses backend private key
   */
  private async executeWithBackendSigner(calls: TransactionCall[]): Promise<TransactionData> {
    console.log("🔑 Executing with backend signer (session key equivalent)...");

    try {
      // For single transaction
      if (calls.length === 1) {
        const call = calls[0];
        console.log(`📤 Sending single transaction to ${call.to}`);
        
        const hash = await walletClient.sendTransaction({
          to: call.to,
          data: call.data || "0x",
          value: call.value || 0n,
        });

        console.log(`✅ Transaction sent: ${hash}`);
        
        return {
          hash,
          success: true,
          usedSessionKey: true,
          totalTransactions: 1
        };
      }

      // For multiple transactions (batch execution)
      // In a real session key implementation, these would be atomic
      // For now, we execute sequentially
      const hashes: string[] = [];
      
      console.log(`📋 Executing ${calls.length} transactions sequentially...`);
      
      for (let i = 0; i < calls.length; i++) {
        const call = calls[i];
        console.log(`📤 Transaction ${i + 1}/${calls.length} to ${call.to}`);
        
        const hash = await walletClient.sendTransaction({
          to: call.to,
          data: call.data || "0x",
          value: call.value || 0n,
        });

        hashes.push(hash);
        console.log(`✅ Transaction ${i + 1} sent: ${hash}`);
        
        // Small delay between transactions to avoid nonce issues
        if (i < calls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`🎉 All ${calls.length} transactions completed successfully`);
      
      return {
        hash: hashes[hashes.length - 1], // Return last hash for compatibility
        success: true,
        usedSessionKey: true,
        totalTransactions: hashes.length
      };

    } catch (error) {
      console.error("❌ Backend signer execution failed:", error);
      throw error;
    }
  }

  /**
   * Check if backend signer can execute transactions (permissions check)
   */
  async canExecute(props: TransactionProps): Promise<{ canExecute: boolean; reason?: string }> {
    try {
      // Gas is sponsored by RISE wallet, so no balance check needed
      // In a real implementation, we'd check session key permissions here
      // For now, we assume backend signer has all necessary permissions
      return { canExecute: true };
      
    } catch (error) {
      return {
        canExecute: false,
        reason: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Get backend signer info (for debugging)
   */
  getSignerInfo() {
    return {
      address: config.backendSigner.address,
      chainId: config.chain.id,
      rpcUrl: config.rpcUrl,
      hasPrivateKey: !!config.backendSigner.account.key
    };
  }
}

// Export singleton instance (matches wallet-demo hook pattern)
export const transactionService = new TransactionService();