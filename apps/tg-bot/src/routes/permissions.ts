import type { Express, Request, Response } from "express";
import type { Address } from "viem";
import { PERMISSION_TEMPLATES } from "../types/index.js";
import { 
  createVerificationMessage, 
  verifyAndLinkAccount, 
  getVerifiedAccount,
  revokeVerification 
} from "../services/verification.js";

const backendKeyAddress = process.env.BACKEND_SIGNER_ADDRESS as Address;

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
      backendKeyAddress,
      templates: PERMISSION_TEMPLATES,
    });
  });

  // Called by frontend AFTER grantPermissions succeeds
  app.post("/api/permissions/sync", (req: Request, res: Response) => {
    const { accountAddress, backendKeyAddress, expiry, telegramId, telegramUsername, telegramData } = req.body as {
      accountAddress: Address;
      backendKeyAddress: Address;
      expiry: number;
      telegramId?: string;
      telegramUsername?: string;
      telegramData?: any;
    };

    // Store by wallet address
    userStore.set(accountAddress.toLowerCase(), {
      accountAddress,
      telegramId,
      templateId: "custom", // We're using custom permissions now
      expiry,
    });

    // Also store by Telegram ID for easy lookup
    if (telegramId) {
      userStore.set(`telegram:${telegramId}`, {
        accountAddress,
        telegramId,
        templateId: "custom",
        expiry,
      });
    }

    console.log("Synced permissions for:", {
      accountAddress,
      backendKeyAddress,
      telegramId,
      telegramUsername,
      expiry,
    });

    res.json({ ok: true });
  });

  // Lookup used by Telegram bot/LLM layer
  app.get("/api/users/by-telegram/:telegramId", async (req: Request, res: Response) => {
    const telegramId = req.params.telegramId;
    
    // Look up by telegram ID first
    const entry = userStore.get(`telegram:${telegramId}`);
    if (!entry) return res.status(404).json({ error: "Not linked" });
    
    // Check if account is verified
    const verifiedAccount = await getVerifiedAccount(telegramId);
    
    res.json({
      ...entry,
      verified: !!verifiedAccount,
      verificationDetails: verifiedAccount ? {
        verifiedAt: verifiedAccount.verifiedAt,
        telegramHandle: verifiedAccount.telegramHandle,
      } : null
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

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
}