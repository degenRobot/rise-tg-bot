import { Address } from "viem";
import { P256, Signature, Hex } from "ox";
import { riseRelayClient, backendSessionKey } from "../config/backendRiseClient.js";

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
  data: TransactionData | null;
};

/**
 * Backend Transaction Service
 * 
 * Follows the exact useTransaction pattern from wallet-demo but in backend context.
 * Uses our BACKEND_SIGNER_PRIVATE_KEY as the session key.
 */
class BackendTransactionService {
  private relayClient = riseRelayClient;
  private chainId = 11155931; // RISE Testnet
  private sessionKey: {
    privateKey: string;
    publicKey: string;
    type: "p256";
  } | null = null;

  /**
   * Initialize session key from backend signer private key
   * This matches the session key derivation in wallet-demo
   */
  private async initializeSessionKey(): Promise<void> {
    if (this.sessionKey) return;

    try {
      console.log("🔑 Initializing backend session key...");
      
      // Derive P256 public key from our backend signer private key
      const publicKeyBytes = P256.getPublicKey({ 
        privateKey: backendSessionKey.privateKey 
      });
      
      // Convert to hex format (remove 0x04 prefix if present)
      const keyBytes = publicKeyBytes instanceof Uint8Array ? 
        publicKeyBytes : 
        new Uint8Array([...publicKeyBytes.x.toString(16).padStart(64, '0').match(/.{2}/g)!.map(x => parseInt(x, 16)), 
                        ...publicKeyBytes.y.toString(16).padStart(64, '0').match(/.{2}/g)!.map(x => parseInt(x, 16))]);
      
      const publicKeyHex = `0x${Buffer.from(keyBytes).toString('hex')}`;
      
      this.sessionKey = {
        privateKey: backendSessionKey.privateKey,
        publicKey: publicKeyHex,
        type: "p256" as const,
      };

      console.log(`✅ Session key initialized: ${publicKeyHex.slice(0, 20)}...`);
    } catch (error) {
      throw new Error(`Failed to initialize session key: ${error}`);
    }
  }

  /**
   * Main execute function (matching useTransaction.execute exactly)
   * This is the entry point that matches wallet-demo's execute() function
   */
  async execute(props: TransactionProps, userAddress: Address): Promise<ExecutionResult> {
    console.log("🚀 Backend executing transaction (matching useTransaction pattern)...");
    const { calls, requiredPermissions } = props;

    try {
      await this.initializeSessionKey();
      
      // For now, always use session key execution since we have the backend signer
      // In wallet-demo, this would check permissions, but we'll assume permissions are granted
      // since we're operating on behalf of users who have already linked their wallets
      
      const result = await this.executeWithSessionKey(calls, userAddress);
      return {
        success: true,
        error: null,
        data: { ...result, usedSessionKey: true }
      };

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
   * Execute with session key matching wallet-demo's executeWithSessionKey exactly
   * Based on wallet-demo/packages/nextjs/wallet-playground/src/hooks/useTransaction.ts
   */
  async executeWithSessionKey(calls: TransactionCall[], userAddress: Address): Promise<TransactionData> {
    console.log("🔑 Executing using backend session key (wallet-demo pattern)...");
    
    if (!this.sessionKey) {
      throw new Error("Session key not initialized");
    }

    try {
      // Use direct relay client for backend (no browser connector dependency)
      if (!this.relayClient) throw new Error("No relay client available");

      console.log("📡 Using RISE relay client for wallet operations...");

      console.log("🔑 Using session key:", {
        publicKey: this.sessionKey.publicKey.slice(0, 20) + "...",
        privateKey: this.sessionKey.privateKey.slice(0, 10) + "...",
        userAddress,
        callsCount: calls.length,
      });

      // Match wallet-demo's intentParams exactly - this is the key fix!
      const intentParams = [
        {
          calls: calls.map(call => ({
            to: call.to,
            data: call.data,
            value: call.value,
          })),
          chainId: Hex.fromNumber(this.chainId), // Exact match to wallet-demo: Hex.fromNumber(chainId)
          from: userAddress,
          atomicRequired: true, // This was missing! Required by wallet-demo
          key: {
            publicKey: this.sessionKey.publicKey,
            type: "p256" as const,
            prehash: false, // Required by relay client even though wallet-demo doesn't include it
          },
          // Add capabilities field required by direct relay client
          capabilities: {
            meta: {
              feePayer: userAddress,
              feeToken: "0x0000000000000000000000000000000000000000",
            },
          },
        },
      ];

      console.log("📋 Intent parameters (wallet-demo format):", {
        calls: intentParams[0].calls.length,
        chainId: intentParams[0].chainId,
        from: intentParams[0].from,
        atomicRequired: intentParams[0].atomicRequired,
        key: intentParams[0].key.publicKey.slice(0, 20) + "...",
      });

      // Prepare calls using exact wallet-demo pattern
      console.log("⚡ Calling wallet_prepareCalls (wallet-demo pattern)...");
      const prepareResponse = await (this.relayClient as any).request({
        method: "wallet_prepareCalls",
        params: intentParams,
      });
      
      const { digest, capabilities, ...request } = prepareResponse;

      console.log("📊 Prepare response keys:", Object.keys(prepareResponse));
      console.log("📊 Request keys after destructuring:", Object.keys(request));
      console.log("🎯 Digest to sign:", digest);

      // Sign the intent with P256
      console.log("✍️  Signing with P256...");
      const signature = Signature.toHex(
        P256.sign({
          payload: digest as `0x${string}`,
          privateKey: this.sessionKey.privateKey as Address,
        })
      );

      console.log("📝 Generated signature:", signature.slice(0, 20) + "...");

      // Send prepared calls using correct Porto RPC schema
      console.log("📤 Calling wallet_sendPreparedCalls (Porto RPC schema)...");
      const sendParams = {
        // Only include capabilities if they have feeSignature
        ...(capabilities?.feeSignature ? { 
          capabilities: { feeSignature: capabilities.feeSignature } 
        } : {}),
        // Context must only include preCall and quote, not the entire massive context
        context: {
          ...(request.context?.preCall ? { preCall: request.context.preCall } : {}),
          ...(request.context?.quote ? { quote: request.context.quote } : {}),
        },
        // Key information from prepare response
        ...(request.key ? { key: request.key } : {}),
        // Our signature
        signature,
      };

      const result = await (this.relayClient as any).request({
        method: "wallet_sendPreparedCalls",
        params: [sendParams],
      });

      console.log("📦 Raw sendPreparedCalls result:", result);
      console.log("📦 Result type:", typeof result);
      console.log("📦 Result keys:", result ? Object.keys(result) : "null/undefined");

      // Process result (should be array according to Porto RPC schema)
      let resp = result;
      if (Array.isArray(result) && result.length !== 0) {
        resp = result[0];
        console.log("📦 Using first array element:", resp);
      }

      console.log("✅ Backend session key execution successful!");
      console.log("📊 Final processed result:", resp);

      return {
        hash: resp.id || resp.hash || resp.transactionHash || "unknown",
        success: true,
        usedSessionKey: true,
        totalTransactions: calls.length
      };

    } catch (error) {
      console.error("❌ Backend session key execution failed:", error);
      throw error;
    }
  }

  /**
   * Get execution info (for debugging)
   */
  getInfo() {
    return {
      client: "rise-relay-client",
      chainId: this.chainId,
      backendSigner: backendSessionKey.address,
      hasPrivateKey: !!backendSessionKey.privateKey,
      hasSessionKey: !!this.sessionKey,
      sessionKeyPublic: this.sessionKey?.publicKey?.slice(0, 20) + "..." || "Not initialized"
    };
  }
}

// Export singleton instance
export const backendTransactionService = new BackendTransactionService();