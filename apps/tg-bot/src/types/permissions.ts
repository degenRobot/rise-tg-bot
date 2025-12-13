import type { Address } from "viem";

/**
 * Permission Types
 * Used for managing user permissions and session keys
 */

export interface StoredPermission {
  id: `0x${string}`;
  expiry: number;
  keyPublicKey: string;
  keyType: "p256" | "address" | "secp256k1";
  permissions?: {
    calls?: Array<{ to?: string; signature?: string }>;
    spend?: Array<{ limit: string; period: string; token?: string }>;
  };
  grantedAt: number;
  userAddress: Address;
  telegramId?: string;
  telegramHandle?: string;
}

export interface UserPermissions {
  walletAddress: Address;
  telegramId?: string;
  telegramHandle?: string;
  permissions: StoredPermission[];
  lastSync: number;
}
