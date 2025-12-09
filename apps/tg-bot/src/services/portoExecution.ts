import type { Address, Hex } from "viem";
import { portoClient } from "../config/backendRiseClient.js";
import { findActivePermissionForBackendKey, findPermissionForBackendKey } from "./permissionStore.js";
import { getOrCreateBackendSessionKey, getBackendP256PublicKey } from "./backendSessionKey.js";
import * as RelayActions from "rise-wallet/viem/RelayActions";

export type Call = {
  to: Address;
  data?: Hex;
  value?: bigint;
};

export type ExecutionErrorType =
  | "expired_session"
  | "unauthorized"
  | "no_permission"
  | "network_error"
  | "unknown";

export interface ExecutionResult {
  success: boolean;
  callsId: string;
  transactionHashes?: string[];
  error?: any;
  errorType?: ExecutionErrorType;
}

/**
 * Execute transactions using stored permissions via Porto SDK
 * Uses Porto.create with mode: relay - the SDK handles precall storage automatically
 */
export async function executeWithBackendPermission(params: {
  walletAddress: Address;
  calls: Call[];
}): Promise<ExecutionResult> {
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
      // Check if it's expired
      const expiredPermission = findPermissionForBackendKey({
        walletAddress,
        backendPublicKey: backendPublicKey,
      });

      if (expiredPermission && expiredPermission.expiry <= Date.now() / 1000) {
        throw new Error("Session key expired");
      }

      throw new Error(`No active permission found for backend key ${backendPublicKey.slice(0, 10)}... on wallet ${walletAddress}`);
    }

    console.log(`✅ Found active permission: ${permission.id}`);

    // 2) Use the backend P256 session key
    console.log("🔑 Using backend P256 session key...");

    console.log(`📋 Preparing and sending calls via Rise Wallet SDK...`);

    // 3) Use Rise Wallet relay actions - Porto will check permissions on-chain
    const result = await RelayActions.sendCalls(portoClient, {
      account: { address: walletAddress } as any,
      calls: calls.map(c => ({
        to: c.to,
        data: c.data,
        value: c.value,
      })),
      key: backendSessionKey,
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

        // Extract transaction hash from receipts
        if (statusResult?.receipts && Array.isArray(statusResult.receipts)) {
          transactionHashes = statusResult.receipts
            .map((r: any) => r.transactionHash)
            .filter((h: any) => h);
          console.log(`✅ Found ${transactionHashes.length} transaction hash(es):`, transactionHashes);
        } else if (statusResult?.transactionHash) {
          transactionHashes = [statusResult.transactionHash];
          console.log(`✅ Found transaction hash:`, transactionHashes[0]);
        }
      } catch (statusError) {
        console.log("⚠️  Could not fetch transaction status (non-critical):", statusError);
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
      errorType = "unauthorized";
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
