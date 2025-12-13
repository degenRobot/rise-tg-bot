import fs from "node:fs";
import path from "node:path";
import type { Address } from "viem";

/**
 * Verified link between Telegram account and wallet address
 */
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

const VERIFIED_LINKS_FILE = path.join(process.cwd(), "data", "verified-links.json");

function readVerifiedLinksFile(): VerifiedLink[] {
  if (!fs.existsSync(VERIFIED_LINKS_FILE)) {
    // Create directory if it doesn't exist
    fs.mkdirSync(path.dirname(VERIFIED_LINKS_FILE), { recursive: true });
    return [];
  }
  try {
    const data = fs.readFileSync(VERIFIED_LINKS_FILE, "utf8");
    const parsed = JSON.parse(data);
    // Convert date strings back to Date objects
    return parsed.map((link: any) => ({
      ...link,
      verifiedAt: new Date(link.verifiedAt),
    }));
  } catch (error) {
    console.error("Error reading verified links file:", error);
    return [];
  }
}

function writeVerifiedLinksFile(links: VerifiedLink[]): void {
  try {
    fs.writeFileSync(VERIFIED_LINKS_FILE, JSON.stringify(links, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing verified links file:", error);
    throw error;
  }
}

/**
 * Save a verified link
 */
export function saveVerifiedLink(link: VerifiedLink): void {
  const links = readVerifiedLinksFile();

  // Remove existing link with same ID if it exists
  const filtered = links.filter(l => l.id !== link.id);

  filtered.push(link);
  writeVerifiedLinksFile(filtered);
}

/**
 * Get verified link by Telegram ID
 * Returns the most recent active link (searches in reverse order)
 */
export function getVerifiedLink(telegramId: string): VerifiedLink | null {
  const links = readVerifiedLinksFile();
  // Search in reverse to get the most recent active link first
  const found = [...links].reverse().find(l => l.telegramId === telegramId && l.active);
  return found || null;
}

/**
 * Revoke a verified link
 */
export function revokeVerifiedLink(telegramId: string): boolean {
  const links = readVerifiedLinksFile();
  const link = links.find(l => l.telegramId === telegramId);

  if (!link) {
    return false;
  }

  link.active = false;
  writeVerifiedLinksFile(links);
  return true;
}

/**
 * Get all verified links
 */
export function getAllVerifiedLinks(): VerifiedLink[] {
  return readVerifiedLinksFile();
}
