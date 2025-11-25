import fs from "node:fs";
import path from "node:path";
import type { Address } from "viem";

export interface StoredPermission {
  id: `0x${string}`;
  expiry: number;
  keyPublicKey: string;
  keyType: "p256";
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

const PERMISSIONS_FILE = path.join(process.cwd(), "data", "permissions.json");

function readPermissionsFile(): UserPermissions[] {
  if (!fs.existsSync(PERMISSIONS_FILE)) {
    // Create directory if it doesn't exist
    fs.mkdirSync(path.dirname(PERMISSIONS_FILE), { recursive: true });
    return [];
  }
  try {
    const data = fs.readFileSync(PERMISSIONS_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading permissions file:", error);
    return [];
  }
}

function writePermissionsFile(data: UserPermissions[]) {
  try {
    fs.mkdirSync(path.dirname(PERMISSIONS_FILE), { recursive: true });
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing permissions file:", error);
    throw error;
  }
}

/**
 * Store permission data from frontend sync
 */
export function storePermission(params: {
  walletAddress: Address;
  telegramId?: string;
  telegramHandle?: string;
  permission: Omit<StoredPermission, 'userAddress' | 'grantedAt'>;
}): void {
  const { walletAddress, telegramId, telegramHandle, permission } = params;
  const allUsers = readPermissionsFile();
  
  // Find or create user record
  let userRecord = allUsers.find(
    u => u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
  
  if (!userRecord) {
    userRecord = {
      walletAddress,
      telegramId,
      telegramHandle,
      permissions: [],
      lastSync: Date.now(),
    };
    allUsers.push(userRecord);
  } else {
    // Update user info
    if (telegramId) userRecord.telegramId = telegramId;
    if (telegramHandle) userRecord.telegramHandle = telegramHandle;
    userRecord.lastSync = Date.now();
  }
  
  // Add new permission (remove any existing with same ID)
  userRecord.permissions = userRecord.permissions.filter(p => p.id !== permission.id);
  
  const completePermission: StoredPermission = {
    ...permission,
    userAddress: walletAddress,
    grantedAt: Date.now(),
  };
  
  userRecord.permissions.push(completePermission);
  
  writePermissionsFile(allUsers);
  
  console.log(`✅ Stored permission ${permission.id} for user ${walletAddress}`);
}

/**
 * Find active permission for backend key
 */
export function findActivePermissionForBackendKey(params: {
  walletAddress: Address;
  backendPublicKey: string;
  now?: number;
}): StoredPermission | null {
  const { walletAddress, backendPublicKey, now = Date.now() / 1000 } = params;
  const allUsers = readPermissionsFile();
  
  const userRecord = allUsers.find(
    u => u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
  
  if (!userRecord) {
    console.log(`❌ No user record found for ${walletAddress}`);
    return null;
  }
  
  // Find active permissions for the backend key
  const activePermissions = userRecord.permissions.filter(p => {
    const isNotExpired = p.expiry > now;
    const isBackendKey = p.keyPublicKey.toLowerCase() === backendPublicKey.toLowerCase();
    
    if (!isNotExpired) {
      console.log(`⏰ Permission ${p.id} expired at ${new Date(p.expiry * 1000)}`);
    }
    if (!isBackendKey) {
      console.log(`🔑 Permission ${p.id} is for different key: ${p.keyPublicKey.slice(0, 10)}...`);
    }
    
    return isNotExpired && isBackendKey;
  });
  
  if (activePermissions.length === 0) {
    console.log(`❌ No active permissions found for backend key ${backendPublicKey.slice(0, 10)}... on wallet ${walletAddress}`);
    return null;
  }
  
  // Return the most recent one
  const mostRecent = activePermissions.sort((a, b) => b.grantedAt - a.grantedAt)[0];
  
  console.log(`✅ Found active permission ${mostRecent.id} for backend key`);
  return mostRecent;
}

/**
 * Find permission for backend key (ignoring expiry)
 */
export function findPermissionForBackendKey(params: {
  walletAddress: Address;
  backendPublicKey: string;
}): StoredPermission | null {
  const { walletAddress, backendPublicKey } = params;
  const allUsers = readPermissionsFile();
  
  const userRecord = allUsers.find(
    u => u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
  
  if (!userRecord) return null;
  
  // Find permissions for the backend key
  const permissions = userRecord.permissions.filter(p => 
    p.keyPublicKey.toLowerCase() === backendPublicKey.toLowerCase()
  );
  
  if (permissions.length === 0) return null;
  
  // Return the most recent one
  return permissions.sort((a, b) => b.grantedAt - a.grantedAt)[0];
}

/**
 * Get all permissions for a user
 */
export function getUserPermissions(walletAddress: Address): UserPermissions | null {
  const allUsers = readPermissionsFile();
  
  return allUsers.find(
    u => u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  ) || null;
}

/**
 * Get permissions by Telegram ID
 */
export function getPermissionsByTelegramId(telegramId: string): UserPermissions | null {
  const allUsers = readPermissionsFile();
  
  return allUsers.find(u => u.telegramId === telegramId) || null;
}

/**
 * Remove expired permissions
 */
export function cleanupExpiredPermissions(): number {
  const allUsers = readPermissionsFile();
  const now = Date.now() / 1000;
  let removedCount = 0;
  
  allUsers.forEach(user => {
    const beforeCount = user.permissions.length;
    user.permissions = user.permissions.filter(p => {
      if (p.expiry <= now) {
        console.log(`🧹 Removing expired permission ${p.id} (expired at ${new Date(p.expiry * 1000)})`);
        removedCount++;
        return false;
      }
      return true;
    });
  });
  
  if (removedCount > 0) {
    writePermissionsFile(allUsers);
    console.log(`✅ Cleaned up ${removedCount} expired permissions`);
  }
  
  return removedCount;
}

/**
 * Debug: List all stored permissions
 */
export function debugListPermissions(): void {
  const allUsers = readPermissionsFile();
  const now = Date.now() / 1000;
  
  console.log("\n📋 Stored Permissions Debug:");
  console.log("=" .repeat(50));
  
  if (allUsers.length === 0) {
    console.log("No stored permissions found.");
    return;
  }
  
  allUsers.forEach((user, userIndex) => {
    console.log(`\n👤 User ${userIndex + 1}:`);
    console.log(`   Wallet: ${user.walletAddress}`);
    console.log(`   Telegram: ${user.telegramHandle || 'N/A'} (${user.telegramId || 'N/A'})`);
    console.log(`   Last Sync: ${new Date(user.lastSync)}`);
    console.log(`   Permissions: ${user.permissions.length}`);
    
    user.permissions.forEach((perm, permIndex) => {
      const isExpired = perm.expiry <= now;
      const status = isExpired ? "❌ EXPIRED" : "✅ ACTIVE";
      
      console.log(`     ${permIndex + 1}. ${status}`);
      console.log(`        ID: ${perm.id}`);
      console.log(`        Key: ${perm.keyPublicKey.slice(0, 20)}...`);
      console.log(`        Expires: ${new Date(perm.expiry * 1000)}`);
      console.log(`        Calls: ${perm.permissions?.calls?.length || 0}`);
      console.log(`        Spend: ${perm.permissions?.spend?.length || 0}`);
    });
  });
  
  console.log("=" .repeat(50));
}