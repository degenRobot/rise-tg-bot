import { Address } from "viem";
import { executeWithBackendPermission } from "./portoExecution.js";
import type {
  TransactionCall,
  TransactionProps,
  TransactionData,
  ServiceExecutionResult,
  Call,
} from "../types/index.js";

/**
 * Backend Transaction Service
 * 
 * Follows the exact useTransaction pattern from wallet-demo but in backend context.
 * Uses the BACKEND_SIGNER_PRIVATE_KEY as the session key.
 */
class BackendTransactionService {
  private chainId = 11155931; // RISE Testnet

  /**
   * Main execute function (using stored permissions)
   * P256 session key is handled internally by portoExecution
   */
  async execute(props: TransactionProps, userAddress: Address): Promise<ServiceExecutionResult> {
    console.log("🚀 Backend executing transaction (using stored permissions)...");
    const { calls } = props;

    try {
      // Convert calls to Porto format
      const portoCalls: Call[] = calls.map(call => ({
        to: call.to,
        data: call.data,
        value: call.value,
      }));

      // P256 session key handled internally
      const result = await executeWithBackendPermission({
        walletAddress: userAddress,
        calls: portoCalls,
      });

      if (result.success) {
        // Use actual transaction hash if available, fallback to callsId
        const actualHash = result.transactionHashes?.[0] || result.callsId;

        return {
          success: true,
          error: null,
          data: {
            hash: actualHash,
            callsId: result.callsId,
            success: true,
            usedSessionKey: true,
            totalTransactions: calls.length,
          }
        };
      } else {
        return {
          success: false,
          error: result.error,
          errorType: result.errorType,
          data: null
        };
      }

    } catch (error) {
      console.error("❌ Backend transaction execution failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        data: null
      };
    }
  }


  /**
   * Get execution info (for debugging)
   */
  getInfo() {
    return {
      client: "rise-relay-client",
      chainId: this.chainId,
      usingP256SessionKeys: true,
    };
  }
}

// Export singleton instance
export const backendTransactionService = new BackendTransactionService();