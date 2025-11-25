import type { Address, Hex } from "viem";
import { riseRelayClient } from "../config/backendRiseClient.js";
import { findActivePermissionForBackendKey, findPermissionForBackendKey } from "./permissionStore.js";
import { P256, Signature } from "ox";
import * as RelayService from "./relay.js";
import * as Key from "rise-wallet/viem/Key";

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
 * Execute transactions using stored permissions via Porto relay
 * Uses the refactored RelayService for robust handling
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

    // 2) Prepare calls using RelayService
    console.log("📋 Preparing calls via RelayService...");

    // Construct the signing key
    const signingKey = Key.fromP256({
      privateKey: backendSessionKey.privateKey as Hex,
      role: 'session',
      expiry: permission.expiry || 0,
    });

    const prepareResult = await RelayService.prepareCalls(riseRelayClient as any, {
      account: { address: walletAddress } as any, // Minimal account object
      chain: riseRelayClient.chain!,
      calls: calls.map(c => ({
        to: c.to,
        data: c.data,
        value: c.value,
      })),
      key: signingKey,
      permissionId: permission.id,
      // We don't need to pass authorizeKeys unless we're authorizing NEW keys
      // We are using an EXISTING key
    });

    const { context, digest } = prepareResult;

    if (!digest) {
      throw new Error("No digest returned from prepareCalls");
    }

    console.log(`📝 Digest to sign: ${digest}`);

    // 3) Sign the digest
    console.log("✍️ Signing with backend P256 key...");
    
    // We can use Key.sign from rise-wallet, which handles wrapping if needed
    // But RelayService.prepareCalls might return a digest that expects raw signature?
    // rise-wallet's prepareCalls returns a digest that should be signed.
    // Let's use Key.sign to be safe and consistent with rise-wallet patterns
    
    const signature = await Key.sign(signingKey, {
      payload: digest,
      address: null, // Not used for P256 usually, or handled by library
    });

    console.log(`✅ Generated signature: ${signature.slice(0, 20)}...`);

    // 4) Send prepared calls
    console.log("📤 Sending prepared calls...");

    const result = await RelayService.sendPreparedCalls(riseRelayClient as any, {
      context,
      signature,
      key: signingKey,
    });

    console.log("📦 Send prepared calls result:", result);

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
