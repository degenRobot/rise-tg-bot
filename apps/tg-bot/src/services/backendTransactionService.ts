import { Address } from "viem";
import { risePublicClient } from "../config/backendRiseClient.js";
import { executeWithBackendPermission, type Call, type ExecutionErrorType } from "./portoExecution.js";

// Types matching wallet-demo exactly
export type TransactionCall = {
  to: `0x${string}`;
  data?: `0x${string}`;
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
  errorType?: ExecutionErrorType;
  data: TransactionData | null;
};

/**
 * Backend Transaction Service
 * 
 * Uses Porto SDK with relay mode and stored permissions.
 * The backend uses a shared P256 session key for all users.
 */
class BackendTransactionService {
  private publicClient = risePublicClient;
  private chainId = 11155931; // RISE Testnet

  /**
   * Main execute function using stored permissions
   * This replaces the old manual precall approach
   */
  async execute(props: TransactionProps, userAddress: Address): Promise<ExecutionResult> {
    console.log("🚀 Backend executing transaction (using stored permissions)...");
    const { calls, requiredPermissions } = props;

    try {
      // Convert calls to Porto format
      const portoCalls: Call[] = calls.map(call => ({
        to: call.to,
        data: call.data,
        value: call.value,
      }));

      // Use the new Porto execution helper (it handles session key internally)
      const result = await executeWithBackendPermission({
        walletAddress: userAddress,
        calls: portoCalls,
      });

      if (result.success) {
        return {
          success: true,
          error: null,
          data: {
            hash: result.callsId,
            success: true,
            usedSessionKey: true,
            keyId: result.callsId,
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
        error,
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
      relayMode: true,
      portoSdkVersion: "rise-wallet",
    };
  }
}

// Export singleton instance
export const backendTransactionService = new BackendTransactionService();