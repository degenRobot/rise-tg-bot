import type { Address, Hex } from "viem";
import { riseRelayClient } from "../config/backendRiseClient.js";
import { findActivePermissionForBackendKey } from "./permissionStore.js";
import { P256, Signature } from "ox";

export type Call = {
  to: Address;
  data?: Hex;
  value?: bigint;
};

export interface ExecutionResult {
  success: boolean;
  callsId: string;
  transactionHashes?: string[];
  error?: any;
}

/**
 * Execute transactions using stored permissions via Porto relay
 * This follows the pattern from the fix plan - use capabilities.permissions.id
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
    const permission = findActivePermissionForBackendKey({
      walletAddress,
      backendPublicKey: backendSessionKey.publicKey,
    });

    if (!permission) {
      throw new Error(`No active permission found for backend key ${backendSessionKey.publicKey.slice(0, 10)}... on wallet ${walletAddress}`);
    }

    console.log(`✅ Found active permission: ${permission.id}`);
    console.log(`   Expires: ${new Date(permission.expiry * 1000)}`);
    console.log(`   Calls allowed: ${permission.permissions?.calls?.length || 0}`);
    console.log(`   Spend limits: ${permission.permissions?.spend?.length || 0}`);

    // 2) Prepare calls using the permission ID (this is the key fix!)
    console.log("📋 Calling wallet_prepareCalls with permission ID...");
    
    const prepareParams = [{
      address: walletAddress,
      from: walletAddress, // Required from field
      chainId: "0x" + (11155931).toString(16), // RISE Testnet chain ID in hex
      calls: calls.map(call => ({
        to: call.to,
        data: call.data,
        value: call.value ? `0x${call.value.toString(16)}` : undefined,
      })),
      capabilities: {
        // This is the crucial fix - reference the existing permission by ID
        permissions: {
          id: permission.id,
        },
        // Include required meta field
        meta: {
          feePayer: walletAddress, // User pays fees
          feeToken: "0x0000000000000000000000000000000000000000", // ETH as fee token
        },
      },
      key: {
        type: backendSessionKey.type,
        publicKey: backendSessionKey.publicKey,
        prehash: false, // Boolean indicating whether to pre-hash message
      },
    }];

    console.log("📡 Prepare params:", {
      address: walletAddress,
      callsCount: calls.length,
      permissionId: permission.id,
      keyType: backendSessionKey.type,
      keyPublic: backendSessionKey.publicKey.slice(0, 20) + "...",
    });

    const prepared = await (riseRelayClient as any).request({
      method: "wallet_prepareCalls",
      params: prepareParams,
    });

    console.log("✅ Prepare calls response keys:", prepared ? Object.keys(prepared) : "null");
    
    const { context, digest } = prepared;
    
    if (!digest) {
      throw new Error("No digest returned from wallet_prepareCalls");
    }

    console.log(`📝 Digest to sign: ${digest}`);

    // 3) Sign the digest using backend P256 key
    console.log("✍️ Signing with backend P256 key...");
    
    const digestBytes = digest.startsWith('0x') ? 
      digest.slice(2) : 
      digest;

    const signature = Signature.toHex(
      P256.sign({
        payload: digest as `0x${string}`,
        privateKey: backendSessionKey.privateKey as Address,
      })
    );

    console.log(`✅ Generated signature: ${signature.slice(0, 20)}...`);

    // 4) Send the prepared calls
    console.log("📤 Calling wallet_sendPreparedCalls...");
    
    const sendParams = [{
      context,
      signature,
      // Include key information
      key: {
        type: backendSessionKey.type,
        publicKey: backendSessionKey.publicKey,
        prehash: false,
      },
    }];

    const result = await (riseRelayClient as any).request({
      method: "wallet_sendPreparedCalls", 
      params: sendParams,
    });

    console.log("📦 Send prepared calls result:", result);

    // Process result (Porto returns different formats)
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
      callsId = result.id || result.callsId || result.hash || "unknown";
      transactionHashes = result.transactionHashes || (result.hash ? [result.hash] : []);
    }

    console.log("✅ Backend permission execution successful!");
    console.log(`   Calls ID: ${callsId}`);
    console.log(`   Transaction hashes: ${transactionHashes.length}`);

    return {
      success: true,
      callsId,
      transactionHashes,
    };

  } catch (error) {
    console.error("❌ Backend permission execution failed:", error);
    
    // Provide helpful error context
    let errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes("Invalid precall")) {
      errorMessage = `Invalid precall: The stored permission may not match the transaction structure. Permission ID: ${findActivePermissionForBackendKey({
        walletAddress,
        backendPublicKey: backendSessionKey.publicKey,
      })?.id || 'not found'}`;
    } else if (errorMessage.includes("duplicate call")) {
      errorMessage = `Duplicate call detected. This may indicate a precall consumption issue.`;
    }

    return {
      success: false,
      callsId: "error",
      error: errorMessage,
    };
  }
}