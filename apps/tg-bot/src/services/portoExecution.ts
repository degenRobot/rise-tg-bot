import type { Address } from "viem";
import { portoClient } from "../config/backendRiseClient.js";
import { findActivePermissionForBackendKey } from "./permissionStore.js";
import { getOrCreateBackendSessionKey, getBackendP256PublicKey } from "./backendSessionKey.js";
import * as RelayActions from "rise-wallet/viem/RelayActions";
import type { Call, ExecutionResult, ExecutionErrorType } from "../types/index.js";

// Porto status codes
const PORTO_STATUS = {
  PENDING: 100,           // Transaction pending
  SUCCESS: 200,           // Transaction successful
  OFFCHAIN_FAILURE: 300,  // Porto/wallet rejected the transaction
  ONCHAIN_REVERT: 400,    // Transaction reverted on-chain completely
  PARTIAL_REVERT: 500     // Some calls in the batch failed
} as const;

/**
 * Execute transactions using stored permissions via Porto SDK
 * Uses Porto.create with mode: relay - the SDK handles precall storage automatically
 */
export async function executeWithBackendPermission(params: {
  walletAddress: Address;
  calls: Call[];
}, retryCount = 0): Promise<ExecutionResult> {
  const { walletAddress, calls } = params;

  // Get the backend session key (P256)
  const backendSessionKey = getOrCreateBackendSessionKey();
  const backendPublicKey = getBackendP256PublicKey();

  console.log("🔑 Executing with backend permission for:", {
    wallet: walletAddress,
    callsCount: calls.length,
    backendKey: backendPublicKey.slice(0, 20) + "...",
  });

  try {
    // 1) Find the active permission for this wallet + backend key
    let permission = findActivePermissionForBackendKey({
      walletAddress,
      backendPublicKey: backendPublicKey,
    });

    if (!permission) {
      throw new Error(`No active permission found for backend key ${backendPublicKey.slice(0, 10)}... on wallet ${walletAddress}`);
    }

    console.log(`✅ Found active permission: ${permission.id}`);

    // 2) Use the backend session key with the permission details
    console.log("🔑 Using backend session key with permission...");

    // Create a session key with the full permission details
    const sessionKey = {
      ...backendSessionKey,
      expiry: permission.expiry || backendSessionKey.expiry || 0,
      permissions: permission.permissions, // Include the actual permissions (calls, spend)
    };

    console.log(`📋 Preparing and sending calls via Rise Wallet SDK...`);

    // Log the exact calls being sent
    const formattedCalls = calls.map(c => ({
      to: c.to,
      data: c.data,
      value: c.value || 0n, // Must be bigint, not string
    }));
    console.log("📤 Calls being sent:", formattedCalls.map(c => ({
      to: c.to,
      data: c.data,
      value: c.value.toString()
    })));

    // 3) Use Rise Wallet relay actions - the SDK handles everything
    // Create an account object with our session key
    const account = {
      address: walletAddress,
      keys: [sessionKey], // Include the session key in the account
    } as any;

    const result = await RelayActions.sendCalls(portoClient, {
      account,
      calls: formattedCalls,
      // The SDK will find the session key from account.keys
    });

    console.log("📦 Send calls result:", result);

    // Process result
    let callsId = "unknown";
    let transactionHashes: string[] = [];

    if (Array.isArray(result) && result.length > 0) {
      const firstResult = result[0];
      callsId = firstResult.id || firstResult.callsId || firstResult.hash || "unknown";

      if (firstResult.transactionHashes) {
        transactionHashes = firstResult.transactionHashes;
      } else if (firstResult.hash) {
        transactionHashes = [firstResult.hash];
      }
    } else if (result && typeof result === 'object') {
      callsId = (result as any).id || (result as any).callsId || (result as any).hash || "unknown";
      transactionHashes = (result as any).transactionHashes || ((result as any).hash ? [(result as any).hash] : []);
    }

    console.log(`📦 Calls ID: ${callsId}`);

    // NEW: Get actual transaction hash using wallet_getCallsStatus
    if (callsId && callsId !== "unknown") {
      try {
        console.log(`🔍 Getting transaction status for calls ID: ${callsId}`);
        // Try different param formats - RPC might expect just the ID string
        const statusResult = await (portoClient as any).request({
          method: 'wallet_getCallsStatus',
          params: [callsId], // Pass ID directly as string, not wrapped in object
        });

        console.log("📊 Calls status result:", statusResult);

        // Check status code
        if (statusResult?.status === PORTO_STATUS.OFFCHAIN_FAILURE) {
          // Offchain failure - Porto rejected the transaction
          throw new Error("Transaction rejected by wallet.");
        } else if (statusResult?.status === PORTO_STATUS.ONCHAIN_REVERT) {
          throw new Error("Transaction reverted completely");
        } else if (statusResult?.status === PORTO_STATUS.PARTIAL_REVERT) {
          // Status 500 might be due to lazy permission registration
          // Retry once if this is the first attempt
          if (retryCount === 0) {
            console.log("⚠️  Status 500 detected - retrying once (may be due to lazy permission registration)...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            return executeWithBackendPermission({ walletAddress, calls }, 1);
          }
          throw new Error("Transaction partially reverted (status 500)");
        }

        // Extract transaction hash from receipts
        if (statusResult?.receipts && Array.isArray(statusResult.receipts) && statusResult.receipts.length > 0) {
          transactionHashes = statusResult.receipts
            .map((r: any) => r.transactionHash)
            .filter((h: any) => h);
          console.log(`✅ Found ${transactionHashes.length} transaction hash(es):`, transactionHashes);
        } else if (statusResult?.transactionHash) {
          transactionHashes = [statusResult.transactionHash];
          console.log(`✅ Found transaction hash:`, transactionHashes[0]);
        }

        // If no transaction hashes found, this is likely a failure
        if (transactionHashes.length === 0 && statusResult?.status !== PORTO_STATUS.PENDING && statusResult?.status !== PORTO_STATUS.SUCCESS) {
          throw new Error(`Transaction failed with status ${statusResult?.status || 'unknown'}: No transaction hash available`);
        }
      } catch (statusError) {
        console.error("❌ Failed to fetch transaction status:", statusError);
        throw statusError;
      }
    }

    console.log("✅ Backend permission execution successful!");

    return {
      success: true,
      callsId,
      transactionHashes,
    };

  } catch (error) {
    console.error("❌ Backend permission execution failed:", error);

    let errorMessage = error instanceof Error ? error.message : String(error);
    let errorType: ExecutionErrorType = "unknown";

    if (errorMessage.includes("Session key expired")) {
      errorType = "expired_session";
    } else if (errorMessage.includes("No active permission found")) {
      errorType = "no_permission";
    } else if (errorMessage.includes("Unauthorized") || errorMessage.includes("Invalid precall") || errorMessage.includes("permission mismatch")) {
      errorType = "unauthorized" as const;
       // Improve error message for unauthorized
       if (errorMessage.includes("Invalid precall")) {
        errorMessage = `Invalid precall or permission mismatch. Permission ID: ${findActivePermissionForBackendKey({
          walletAddress,
          backendPublicKey: backendPublicKey,
        })?.id}`;
      }
    } else if (errorMessage.includes("Network") || errorMessage.includes("fetch")) {
      errorType = "network_error";
    }

    return {
      success: false,
      callsId: "error",
      error: errorMessage,
      errorType,
    };
  }
}
