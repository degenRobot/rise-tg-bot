import type { Address, Hex } from "viem";
import { portoClient } from "../config/backendRiseClient.js";
import { findActivePermissionForBackendKey, findPermissionForBackendKey } from "./permissionStore.js";
import * as Key from "rise-wallet/viem/Key";
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
  backendSessionKey: {
    privateKey: string;
    publicKey: string;
    type: "p256";
  };
}): Promise<ExecutionResult> {
  const { walletAddress, calls, backendSessionKey } = params;

  console.log("🔑 Executing with backend permission for:", {
    wallet: walletAddress,
    callsCount: calls.length,
    backendKey: backendSessionKey.publicKey.slice(0, 20) + "...",
  });

  try {
    // 1) Find the active permission for this wallet + backend key
    let permission = findActivePermissionForBackendKey({
      walletAddress,
      backendPublicKey: backendSessionKey.publicKey,
    });

    if (!permission) {
      // Check if it's expired
      const expiredPermission = findPermissionForBackendKey({
        walletAddress,
        backendPublicKey: backendSessionKey.publicKey,
      });

      if (expiredPermission && expiredPermission.expiry <= Date.now() / 1000) {
        throw new Error("Session key expired");
      }

      throw new Error(`No active permission found for backend key ${backendSessionKey.publicKey.slice(0, 10)}... on wallet ${walletAddress}`);
    }

    console.log(`✅ Found active permission: ${permission.id}`);

    // 2) Create the session key object
    console.log("🔑 Creating session key from backend private key...");

    const sessionKey = Key.fromP256({
      privateKey: backendSessionKey.privateKey as Hex,
      role: 'session',
      expiry: permission.expiry || 0,
      permissions: {
        id: permission.id, // Use the stored permission ID
      }
    });

    console.log(`📋 Preparing and sending calls via Rise Wallet SDK...`);

    // 3) Use Rise Wallet relay actions - the SDK handles everything
    const result = await RelayActions.sendCalls(portoClient, {
      account: { address: walletAddress } as any,
      calls: calls.map(c => ({
        to: c.to,
        data: c.data,
        value: c.value,
      })),
      key: sessionKey,
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
          backendPublicKey: backendSessionKey.publicKey,
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
