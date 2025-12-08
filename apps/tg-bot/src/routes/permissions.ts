import type { Express, Request, Response } from "express";
import type { Address } from "viem";
import { P256 } from "ox";
import { PERMISSION_TEMPLATES } from "../types/index.js";
import { 
  createVerificationMessage, 
  verifyAndLinkAccount, 
  getVerifiedAccount,
  revokeVerification 
} from "../services/verification.js";
import {
  storePermission,
  findActivePermissionForBackendKey,
  getUserPermissions,
  getPermissionsByTelegramId,
  cleanupExpiredPermissions,
  debugListPermissions,
  revokePermission,
  type StoredPermission
} from "../services/permissionStore.js";

const backendKeyAddress = process.env.BACKEND_SIGNER_ADDRESS as Address;
const backendPrivateKey = process.env.BACKEND_SIGNER_PRIVATE_KEY!;

// Derive the P256 public key for frontend use
function getBackendP256PublicKey(): string {
  const publicKeyBytes = P256.getPublicKey({ 
    privateKey: backendPrivateKey 
  });
  
  // Convert to hex format
  const keyBytes = publicKeyBytes instanceof Uint8Array ? 
    publicKeyBytes : 
    new Uint8Array([
      ...publicKeyBytes.x.toString(16).padStart(64, '0').match(/.{2}/g)!.map(x => parseInt(x, 16)), 
      ...publicKeyBytes.y.toString(16).padStart(64, '0').match(/.{2}/g)!.map(x => parseInt(x, 16))
    ]);
  
  return `0x${Buffer.from(keyBytes).toString('hex')}`;
}

// Very naive in-memory store for prototype
const userStore = new Map<
  string,
  {
    telegramId?: string;
    accountAddress: Address;
    templateId: string;
    expiry: number;
  }
>();

export function registerPermissionRoutes(app: Express) {
  // Used by frontend to render the dropdown
  app.get("/api/permissions/config", (_req: Request, res: Response) => {
    res.json({
      backendKeyAddress: getBackendP256PublicKey(), // Return P256 public key, not EOA address
      templates: PERMISSION_TEMPLATES,
    });
  });

  // Called by frontend AFTER grantPermissions succeeds
  app.post("/api/permissions/sync", (req: Request, res: Response) => {
    try {
      const { accountAddress, backendKeyAddress, expiry, telegramId, telegramUsername, permissionDetails } = req.body as {
        accountAddress: Address;
        backendKeyAddress: Address;
        expiry: number;
        telegramId?: string;
        telegramUsername?: string;
        permissionDetails?: {
          id: `0x${string}`;
          keyPublicKey: string;
          permissions?: {
            calls?: Array<{ to?: string; signature?: string }>;
            spend?: Array<{ limit: string; period: string; token?: string }>;
          };
        };
      };

      console.log("📥 Permission sync request:", {
        accountAddress,
        backendKeyAddress,
        telegramId,
        telegramUsername,
        expiry,
        hasPermissionDetails: !!permissionDetails,
        permissionId: permissionDetails?.id,
      });

      // Store legacy format for compatibility
      userStore.set(accountAddress.toLowerCase(), {
        accountAddress,
        telegramId,
        templateId: "custom",
        expiry,
      });

      if (telegramId) {
        userStore.set(`telegram:${telegramId}`, {
          accountAddress,
          telegramId,
          templateId: "custom",
          expiry,
        });
      }

      // Store detailed permission data if provided
      if (permissionDetails) {
        storePermission({
          walletAddress: accountAddress,
          telegramId,
          telegramHandle: telegramUsername,
          permission: {
            id: permissionDetails.id,
            expiry,
            keyPublicKey: permissionDetails.keyPublicKey,
            keyType: "p256",
            permissions: permissionDetails.permissions,
          },
        });

        console.log("✅ Stored detailed permission data");
      } else {
        console.log("⚠️  No detailed permission data provided - using legacy sync");
      }

      // Cleanup expired permissions
      const cleaned = cleanupExpiredPermissions();
      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} expired permissions during sync`);
      }

      res.json({ ok: true });

    } catch (error) {
      console.error("❌ Permission sync error:", error);
      res.status(500).json({ error: "Failed to sync permissions" });
    }
  });

  // Called by frontend AFTER revokePermissions succeeds
  app.post("/api/permissions/revoke", (req: Request, res: Response) => {
    try {
      const { accountAddress, permissionId } = req.body as {
        accountAddress: Address;
        permissionId: `0x${string}`;
      };

      console.log("🗑️  Permission revoke request:", {
        accountAddress,
        permissionId,
      });

      if (!accountAddress || !permissionId) {
        return res.status(400).json({ error: "accountAddress and permissionId are required" });
      }

      const revoked = revokePermission({
        walletAddress: accountAddress,
        permissionId,
      });

      if (revoked) {
        res.json({ ok: true, message: "Permission revoked from backend storage" });
      } else {
        res.status(404).json({ error: "Permission not found in backend storage" });
      }

    } catch (error) {
      console.error("❌ Permission revoke error:", error);
      res.status(500).json({ error: "Failed to revoke permission" });
    }
  });

  // Lookup used by Telegram bot/LLM layer
  app.get("/api/users/by-telegram/:telegramId", async (req: Request, res: Response) => {
    const telegramId = req.params.telegramId;
    
    console.log(`Bot looking up user for Telegram ID: ${telegramId}`);
    
    // Check if account is verified (primary source of truth)
    const verifiedAccount = await getVerifiedAccount(telegramId);
    
    if (!verifiedAccount) {
      console.log(`No verified account found for Telegram ID: ${telegramId}`);
      return res.status(404).json({ error: "Not linked" });
    }
    
    console.log(`Found verified account:`, {
      address: verifiedAccount.accountAddress,
      handle: verifiedAccount.telegramHandle,
      verifiedAt: verifiedAccount.verifiedAt
    });
    
    // Also check permissions store for additional data
    const permissionsEntry = userStore.get(`telegram:${telegramId}`);
    
    // Get detailed permissions data
    const detailedPermissions = getPermissionsByTelegramId(telegramId);
    
    res.json({
      accountAddress: verifiedAccount.accountAddress,
      telegramId: verifiedAccount.telegramId,
      telegramHandle: verifiedAccount.telegramHandle,
      templateId: permissionsEntry?.templateId || "custom",
      expiry: permissionsEntry?.expiry || 0,
      verified: true,
      verificationDetails: {
        verifiedAt: verifiedAccount.verifiedAt,
        telegramHandle: verifiedAccount.telegramHandle,
      },
      // Include session key if available from permissions
      sessionKey: (permissionsEntry as any)?.sessionKey,
      // Include detailed permission data for backend transaction service
      permissions: detailedPermissions ? {
        activeCount: detailedPermissions.permissions.filter(p => p.expiry > Date.now() / 1000).length,
        totalCount: detailedPermissions.permissions.length,
        lastSync: detailedPermissions.lastSync,
        // Include the most recent active permission for the backend key
        backendPermission: findActivePermissionForBackendKey({
          walletAddress: verifiedAccount.accountAddress,
          backendPublicKey: backendKeyAddress, // Current backend key
        }),
      } : null,
    });
  });

  // Generate verification message
  app.post("/api/verify/message", (req: Request, res: Response) => {
    const { telegramId, telegramHandle } = req.body as {
      telegramId: string;
      telegramHandle: string;
    };

    if (!telegramId || !telegramHandle) {
      return res.status(400).json({ error: "telegramId and telegramHandle are required" });
    }

    const { message, data } = createVerificationMessage(telegramId, telegramHandle);
    
    res.json({
      message,
      data,
    });
  });

  // Verify signature and link accounts
  app.post("/api/verify/signature", async (req: Request, res: Response) => {
    const { address, signature, message, telegramId, telegramHandle } = req.body as {
      address: Address;
      signature: `0x${string}`;
      message: string;
      telegramId: string;
      telegramHandle: string;
    };

    console.log("Verify signature request:", {
      address,
      signaturePreview: signature?.substring(0, 10) + "...",
      signatureFull: signature,
      signatureLength: signature?.length,
      messageLength: message?.length,
      telegramId,
      telegramHandle,
    });

    if (!address || !signature || !message || !telegramId || !telegramHandle) {
      console.error("Missing required fields:", {
        hasAddress: !!address,
        hasSignature: !!signature,
        hasMessage: !!message,
        hasTelegramId: !!telegramId,
        hasTelegramHandle: !!telegramHandle,
      });
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await verifyAndLinkAccount({
      address,
      signature,
      message,
      telegramId,
      telegramHandle,
    });

    console.log("Verification result:", result);

    if (result.success) {
      res.json({ 
        success: true, 
        message: "Account successfully verified and linked" 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }
  });

  // Revoke verification
  app.post("/api/verify/revoke", async (req: Request, res: Response) => {
    const { telegramId } = req.body as { telegramId: string };

    if (!telegramId) {
      return res.status(400).json({ error: "telegramId is required" });
    }

    const revoked = await revokeVerification(telegramId);
    
    res.json({
      success: revoked,
      message: revoked ? "Verification revoked" : "No active verification found"
    });
  });

  // Check verification status
  app.get("/api/verify/status/:telegramId", async (req: Request, res: Response) => {
    const { telegramId } = req.params;
    
    const verifiedAccount = await getVerifiedAccount(telegramId);
    
    if (verifiedAccount) {
      res.json({
        linked: true,
        accountAddress: verifiedAccount.accountAddress,
        telegramHandle: verifiedAccount.telegramHandle,
        verifiedAt: verifiedAccount.verifiedAt,
      });
    } else {
      res.json({
        linked: false,
      });
    }
  });

  // Debug: List all permissions
  app.get("/api/permissions/debug/list", (_req: Request, res: Response) => {
    try {
      debugListPermissions();
      const cleaned = cleanupExpiredPermissions();
      res.json({ 
        message: "Permission debug info logged to console",
        expiredCleaned: cleaned,
      });
    } catch (error) {
      console.error("Debug list error:", error);
      res.status(500).json({ error: "Failed to list permissions" });
    }
  });

  // Get detailed permissions for a wallet
  app.get("/api/permissions/wallet/:address", (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const permissions = getUserPermissions(address as Address);
      
      if (!permissions) {
        return res.status(404).json({ error: "No permissions found for wallet" });
      }
      
      const now = Date.now() / 1000;
      const activePermissions = permissions.permissions.filter(p => p.expiry > now);
      
      res.json({
        walletAddress: permissions.walletAddress,
        telegramId: permissions.telegramId,
        telegramHandle: permissions.telegramHandle,
        lastSync: new Date(permissions.lastSync),
        totalPermissions: permissions.permissions.length,
        activePermissions: activePermissions.length,
        permissions: permissions.permissions.map(p => ({
          id: p.id,
          keyPublicKey: p.keyPublicKey.slice(0, 20) + "...",
          expiry: new Date(p.expiry * 1000),
          isActive: p.expiry > now,
          callsCount: p.permissions?.calls?.length || 0,
          spendCount: p.permissions?.spend?.length || 0,
          grantedAt: new Date(p.grantedAt),
        })),
        // Check if there's an active permission for current backend key
        hasBackendPermission: !!findActivePermissionForBackendKey({
          walletAddress: address as Address,
          backendPublicKey: backendKeyAddress,
        }),
      });
    } catch (error) {
      console.error("Get wallet permissions error:", error);
      res.status(500).json({ error: "Failed to get wallet permissions" });
    }
  });

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
}