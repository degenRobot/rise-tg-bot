import { type Address, type Hex, hashMessage, getAddress } from "viem";
import { verifyMessage, verifyHash } from "viem/actions";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { risePublicClient } from "../config/backendRiseClient.js";
import {
  saveVerifiedLink,
  getVerifiedLink,
  revokeVerifiedLink,
  type VerifiedLink,
} from './verifiedLinksStore.js';

// Verification message schema
export const VerificationMessageSchema = z.object({
  telegramId: z.string(),
  telegramHandle: z.string(),
  timestamp: z.number(),
  nonce: z.string(),
});

export type VerificationMessage = z.infer<typeof VerificationMessageSchema>;

// Re-export VerifiedLink type for convenience
export type { VerifiedLink };

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
    nonce: randomBytes(16).toString('hex'),
  };

  const message = `RISE Telegram Bot Verification\n\n` +
    `I am linking my wallet to Telegram account @${telegramHandle} (ID: ${telegramId})\n\n` +
    `Timestamp: ${data.timestamp}\n` +
    `Nonce: ${data.nonce}\n\n` +
    `This signature proves I control this wallet and authorize the RISE bot to execute transactions on my behalf.`;

  return { message, data };
}


// Verify signature using viem's universal verification
async function verifySignatureWithViem(
  address: Address,
  message: string,
  signature: Hex
): Promise<boolean> {
  try {
    console.log("Verifying with viem's verifyMessage...");
    // Use public client actions
    const isValid = await verifyMessage(risePublicClient, {
      address: getAddress(address),
      message,
      signature
    });
    
    console.log("Viem verification result:", isValid);
    return isValid;
  } catch (error) {
    console.error("Viem signature verification failed:", error);
    
    // Fallback to hash-based verification for complex signatures
    try {
      console.log("Trying fallback hash verification...");
      const messageHash = hashMessage(message);

      const isValid = await verifyHash(risePublicClient, {
        address: getAddress(address),
        hash: messageHash,
        signature
      });
      
      console.log("Hash verification result:", isValid);
      return isValid;
    } catch (hashError) {
      console.error("Hash verification also failed:", hashError);
      return false;
    }
  }
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
      signatureLength: params.signature.length
    });

    // Verify signature using viem (handles both EOA and smart wallets via EIP-1271)
    const isValid = await verifySignatureWithViem(
      params.address,
      params.message,
      params.signature
    );
    

    if (!isValid) {
      return { success: false, error: "Invalid signature - signature verification failed" };
    }
    
    console.log("✅ Signature verification passed!");

    // Parse and validate the message content
    const messageLines = params.message.split('\n');
    const handleMatch = messageLines[2]?.match(/@(\w+) \(ID: (\d+)\)/);
    
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
    const existingLink = getVerifiedLink(params.telegramId);
    if (existingLink && existingLink.active) {
      // Deactivate old link
      existingLink.active = false;
      saveVerifiedLink(existingLink);
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

    saveVerifiedLink(verifiedLink);

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
  const link = getVerifiedLink(telegramId);
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
  return revokeVerifiedLink(telegramId);
}
