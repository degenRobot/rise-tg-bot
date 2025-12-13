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
  backendSessionKey = Key.fromP256({
    privateKey: backendSigner.privateKey as Hex.Hex,
    role: 'session',
    expiry: expiry || Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days default
    permissions,
  });

  console.log(`Created backend P256 session key:`, {
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
 */
export function getBackendP256PublicKey(): string {
  const key = getOrCreateBackendSessionKey();
  return key.publicKey;
}
