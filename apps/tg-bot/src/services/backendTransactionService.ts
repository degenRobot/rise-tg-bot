import { Address, Hex } from "viem";
import { P256, Signature, Hex as OxHex } from "ox";
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
      const keyBytes = publicKeyBytes.prefix ? 
        new Uint8Array([...publicKeyBytes.x.toString(16).padStart(64, '0').match(/.{2}/g)!.map(x => parseInt(x, 16)), 
                        ...publicKeyBytes.y.toString(16).padStart(64, '0').match(/.{2}/g)!.map(x => parseInt(x, 16))]) :
        publicKeyBytes;
      
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
   * Execute with session key using Porto RPC schema parameter structure
   * Based on porto-rise/src/core/internal/schema/rpc.ts definitions
   */
  async executeWithSessionKey(calls: TransactionCall[], userAddress: Address): Promise<TransactionData> {
    console.log("🔑 Executing using backend session key with Porto RPC schema...");
    
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

      // Parameters according to Porto RPC schema (porto-rise/src/core/internal/schema/rpc.ts)
      const prepareParams = {
        calls: calls.map(call => ({
          to: call.to,
          data: call.data,
          value: call.value,
        })),
        chainId: OxHex.fromNumber(this.chainId),
        from: userAddress,
        atomicRequired: true,
        key: {
          expiry: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours from now
          prehash: false, // We're not prehashing the digest
          publicKey: this.sessionKey.publicKey,
          role: "normal" as const, // Backend session key is normal role
          type: "p256" as const,
        },
      };

      console.log("📋 Prepare parameters:", {
        calls: prepareParams.calls.length,
        chainId: prepareParams.chainId,
        from: prepareParams.from,
        key: prepareParams.key.publicKey.slice(0, 20) + "...",
      });

      // Prepare calls using Porto RPC schema structure
      console.log("⚡ Calling wallet_prepareCalls via relay client...");
      const prepareResponse = await this.relayClient.request({
        method: "wallet_prepareCalls",
        params: [prepareParams],
      });

      console.log("📊 Prepare response keys:", Object.keys(prepareResponse));
      console.log("🎯 Digest to sign:", prepareResponse.digest);

      // Sign the intent with P256
      console.log("✍️  Signing with P256...");
      const signature = Signature.toHex(
        P256.sign({
          payload: prepareResponse.digest as `0x${string}`,
          privateKey: this.sessionKey.privateKey as Address,
        })
      );

      console.log("📝 Generated signature:", signature.slice(0, 20) + "...");

      // Send prepared calls using Porto RPC schema structure
      console.log("📤 Calling wallet_sendPreparedCalls via relay client...");
      const sendParams = {
        capabilities: prepareResponse.capabilities,
        chainId: prepareResponse.chainId,
        context: prepareResponse.context,
        key: prepareResponse.key,
        signature,
      };

      const result = await this.relayClient.request({
        method: "wallet_sendPreparedCalls",
        params: [sendParams],
      });

      // Process result (should be array according to Porto RPC schema)
      let resp = result;
      if (Array.isArray(result) && result.length !== 0) {
        resp = result[0];
      }

      console.log("✅ Backend session key execution successful!");
      console.log("📊 Result:", resp);

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