import { type Address } from "viem";
import { z } from "zod";

// Verification message schema
export const VerificationMessageSchema = z.object({
  telegramId: z.string(),
  telegramHandle: z.string(),
  timestamp: z.number(),
  nonce: z.string(),
});

export type VerificationMessage = z.infer<typeof VerificationMessageSchema>;

// Database schema for verified links (conceptual)
export interface VerifiedLink {
  id: string;
  telegramId: string;
  telegramHandle: string;
  accountAddress: Address;
  verifiedAt: Date;
  signature: string;
  messageHash: string;
  active: boolean;
}

import { storage } from './storage.js';

// Removed in-memory store - now using file storage

/**
 * Generate a verification message for the user to sign
 */
export function createVerificationMessage(
  telegramId: string,
  telegramHandle: string
): { message: string; data: VerificationMessage } {
  const data: VerificationMessage = {
    telegramId,
    telegramHandle,
    timestamp: Date.now(),
    nonce: Math.random().toString(36).substring(2, 15),
  };

  const message = `RISE Telegram Bot Verification\n\n` +
    `I am linking my wallet to Telegram account @${telegramHandle} (ID: ${telegramId})\n\n` +
    `Timestamp: ${data.timestamp}\n` +
    `Nonce: ${data.nonce}\n\n` +
    `This signature proves I control this wallet and authorize the RISE bot to execute transactions on my behalf.`;

  return { message, data };
}

/**
 * Verify a signature and link accounts
 */
export async function verifyAndLinkAccount(params: {
  address: Address;
  signature: `0x${string}`;
  message: string;
  telegramId: string;
  telegramHandle: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("Starting verification for:", {
      address: params.address,
      telegramHandle: params.telegramHandle,
      telegramId: params.telegramId,
    });

    // Simple signature verification without contract calls
    console.log("Verifying signature...");
    
    // Use recoverMessageAddress to verify
    const { recoverMessageAddress } = await import("viem");
    const recoveredAddress = await recoverMessageAddress({
      message: params.message,
      signature: params.signature,
    });
    
    console.log("Recovered address:", recoveredAddress);
    console.log("Expected address:", params.address);
    
    const isValid = recoveredAddress.toLowerCase() === params.address.toLowerCase();

    console.log("Signature verification result:", isValid);

    if (!isValid) {
      return { success: false, error: "Invalid signature" };
    }

    // Parse and validate the message content
    const messageLines = params.message.split('\n');
    console.log("Message lines:", messageLines);
    const handleMatch = messageLines[2]?.match(/@(\w+) \(ID: (\d+)\)/);
    console.log("Handle match:", handleMatch);
    
    if (!handleMatch) {
      console.error("Failed to parse message - no match found");
      return { success: false, error: "Failed to parse verification message" };
    }
    
    if (handleMatch[1] !== params.telegramHandle) {
      console.error(`Handle mismatch: expected ${params.telegramHandle}, got ${handleMatch[1]}`);
      return { success: false, error: "Telegram handle does not match message" };
    }
    
    if (handleMatch[2] !== params.telegramId) {
      console.error(`ID mismatch: expected ${params.telegramId}, got ${handleMatch[2]}`);
      return { success: false, error: "Telegram ID does not match message" };
    }

    // Check for existing link
    const existingLink = await storage.getVerifiedLink(params.telegramId);
    if (existingLink && existingLink.active) {
      // Deactivate old link
      existingLink.active = false;
      await storage.saveVerifiedLink(existingLink);
    }

    // Store new verified link
    const linkId = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const verifiedLink: VerifiedLink = {
      id: linkId,
      telegramId: params.telegramId,
      telegramHandle: params.telegramHandle,
      accountAddress: params.address,
      verifiedAt: new Date(),
      signature: params.signature,
      messageHash: params.message,
      active: true,
    };

    await storage.saveVerifiedLink(verifiedLink);

    return { success: true };
  } catch (error) {
    console.error("Verification error:", error);
    return { success: false, error: "Verification failed" };
  }
}

/**
 * Get verified account for a Telegram user
 */
export async function getVerifiedAccount(telegramId: string): Promise<VerifiedLink | null> {
  const link = await storage.getVerifiedLink(telegramId);
  return link && link.active ? link : null;
}

/**
 * Check if a Telegram user has a verified account
 */
export async function isAccountVerified(telegramId: string): Promise<boolean> {
  const link = await getVerifiedAccount(telegramId);
  return !!link;
}

/**
 * Revoke account verification
 */
export async function revokeVerification(telegramId: string): Promise<boolean> {
  return await storage.revokeVerifiedLink(telegramId);
}