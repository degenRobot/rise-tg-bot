import type { Express, Request, Response } from "express";
import type { Address } from "viem";
import { PERMISSION_TEMPLATES } from "../types/index.js";

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
  app.get("/api/users/by-telegram/:telegramId", (req: Request, res: Response) => {
    const telegramId = req.params.telegramId;
    
    // Look up by telegram ID first
    const entry = userStore.get(`telegram:${telegramId}`);
    if (!entry) return res.status(404).json({ error: "Not linked" });
    
    res.json(entry);
  });

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
}