import * as Key from "rise-wallet/viem/Key";
import type { Hex } from "ox";
import { backendSigner } from "../config/backendRiseClient.js";

// Store the backend session key
let backendSessionKey: Key.Key | null = null;

/**
 * Get or create the backend P256 session key
 * Uses the P256 private key from environment variables
 */
export function getOrCreateBackendSessionKey(params: {
  expiry?: number;
  permissions?: Key.from.Value['permissions'];
} = {}): Key.Key {
  if (backendSessionKey && (!backendSessionKey.expiry || backendSessionKey.expiry > Date.now() / 1000)) {
    return backendSessionKey;
  }
  
  const { expiry, permissions } = params;
  
  // Use the P256 private key from env
  // Now BACKEND_SIGNER_PRIVATE_KEY contains a P256 private key
  backendSessionKey = Key.fromP256({
    privateKey: backendSigner.privateKey as Hex.Hex,
    role: 'session',
    expiry: expiry || Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days default
    permissions,
  });
  
  console.log(`🔑 Created backend P256 session key:`, {
    publicKey: backendSessionKey.publicKey,
    type: backendSessionKey.type,
    role: backendSessionKey.role,
    expiry: new Date((backendSessionKey.expiry || 0) * 1000),
  });
  
  return backendSessionKey;
}

/**
 * Get the backend P256 public key to share with frontend
 * This is what the frontend will use to grant permissions
 * Note: Now this just returns the public key from env since we have a P256 key pair
 */
export function getBackendP256PublicKey(): string {
  // BACKEND_SIGNER_ADDRESS now contains the P256 public key
  return backendSigner.address;
}

/**
 * Store the generated session key to a file for persistence
 * This is useful for development to avoid regenerating keys
 */
export async function persistBackendSessionKey(): Promise<void> {
  if (!backendSessionKey) {
    throw new Error("No backend session key to persist");
  }
  
  // In production, you might want to store this in a secure key management service
  // For development, we'll just log it
  console.log(`💾 Backend session key details for persistence:`, {
    publicKey: backendSessionKey.publicKey,
    // Never log private keys in production!
    privateKey: process.env.NODE_ENV === 'development' ? backendSessionKey.privateKey() : '[REDACTED]',
  });
}