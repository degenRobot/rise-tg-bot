import { promises as fs } from 'fs';
import path from 'path';
import type { Address } from 'viem';
import type { VerifiedLink } from './verification.js';

// Base directory for data storage
const DATA_DIR = process.env.DATA_DIR || './data';

// Ensure data directories exist
async function ensureDirectories() {
  const dirs = [
    DATA_DIR,
    path.join(DATA_DIR, 'verified-links'),
    path.join(DATA_DIR, 'permissions'),
    path.join(DATA_DIR, 'conversations'),
    path.join(DATA_DIR, 'messages'),
    path.join(DATA_DIR, 'tool-executions'),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// JSON file operations with error handling
async function readJSON<T>(filepath: string): Promise<T | null> {
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeJSON<T>(filepath: string, data: T): Promise<void> {
  const tempPath = `${filepath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
  await fs.rename(tempPath, filepath); // Atomic write
}

async function deleteFile(filepath: string): Promise<boolean> {
  try {
    await fs.unlink(filepath);
    return true;
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

// Storage interfaces
export interface StoredPermission {
  id: string;
  telegramId: string;
  accountAddress: Address;
  templateId: string;
  expiry: number;
  backendKeyAddress: Address;
  permissionsJson: any;
  createdAt: number;
  revokedAt?: number;
}

export interface StoredConversation {
  id: string;
  userId: string;
  startedAt: number;
  lastActiveAt: number;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool';
  content: any;
  createdAt: number;
}

export interface StoredToolExecution {
  id: string;
  conversationId: string;
  toolName: string;
  request: any;
  response?: any;
  success: boolean;
  createdAt: number;
  txHash?: string;
}

// Storage service
export class FileStorageService {
  constructor() {
    ensureDirectories().catch(console.error);
  }

  // Verified Links
  async saveVerifiedLink(link: VerifiedLink): Promise<void> {
    const filepath = path.join(DATA_DIR, 'verified-links', `${link.telegramId}.json`);
    await writeJSON(filepath, link);
  }

  async getVerifiedLink(telegramId: string): Promise<VerifiedLink | null> {
    const filepath = path.join(DATA_DIR, 'verified-links', `${telegramId}.json`);
    return readJSON<VerifiedLink>(filepath);
  }

  async revokeVerifiedLink(telegramId: string): Promise<boolean> {
    const link = await this.getVerifiedLink(telegramId);
    if (link) {
      link.active = false;
      await this.saveVerifiedLink(link);
      return true;
    }
    return false;
  }

  async getAllVerifiedLinks(): Promise<VerifiedLink[]> {
    const dir = path.join(DATA_DIR, 'verified-links');
    try {
      const files = await fs.readdir(dir);
      const links = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async f => {
            const data = await readJSON<VerifiedLink>(path.join(dir, f));
            return data;
          })
      );
      return links.filter((link): link is VerifiedLink => link !== null);
    } catch {
      return [];
    }
  }

  // Permissions
  async savePermission(permission: StoredPermission): Promise<void> {
    const filepath = path.join(DATA_DIR, 'permissions', `${permission.id}.json`);
    await writeJSON(filepath, permission);
  }

  async getPermission(id: string): Promise<StoredPermission | null> {
    const filepath = path.join(DATA_DIR, 'permissions', `${id}.json`);
    return readJSON<StoredPermission>(filepath);
  }

  async getPermissionsByUser(telegramId: string): Promise<StoredPermission[]> {
    const dir = path.join(DATA_DIR, 'permissions');
    try {
      const files = await fs.readdir(dir);
      const permissions = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async f => {
            const data = await readJSON<StoredPermission>(path.join(dir, f));
            return data;
          })
      );
      return permissions
        .filter((p): p is StoredPermission => p !== null && p.telegramId === telegramId)
        .filter(p => !p.revokedAt && p.expiry > Date.now());
    } catch {
      return [];
    }
  }

  // Conversations
  async saveConversation(conversation: StoredConversation): Promise<void> {
    const filepath = path.join(DATA_DIR, 'conversations', `${conversation.id}.json`);
    await writeJSON(filepath, conversation);
  }

  async getConversation(id: string): Promise<StoredConversation | null> {
    const filepath = path.join(DATA_DIR, 'conversations', `${id}.json`);
    return readJSON<StoredConversation>(filepath);
  }

  async getOrCreateConversation(userId: string): Promise<StoredConversation> {
    // Try to find active conversation
    const dir = path.join(DATA_DIR, 'conversations');
    try {
      const files = await fs.readdir(dir);
      const conversations = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async f => {
            const data = await readJSON<StoredConversation>(path.join(dir, f));
            return data;
          })
      );
      
      const activeConv = conversations
        .filter((c): c is StoredConversation => c !== null && c.userId === userId)
        .sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0];

      if (activeConv && Date.now() - activeConv.lastActiveAt < 30 * 60 * 1000) { // 30 min timeout
        activeConv.lastActiveAt = Date.now();
        await this.saveConversation(activeConv);
        return activeConv;
      }
    } catch {}

    // Create new conversation
    const newConv: StoredConversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    await this.saveConversation(newConv);
    return newConv;
  }

  // Messages
  async saveMessage(message: StoredMessage): Promise<void> {
    const filepath = path.join(DATA_DIR, 'messages', `${message.id}.json`);
    await writeJSON(filepath, message);
  }

  async getMessagesByConversation(conversationId: string): Promise<StoredMessage[]> {
    const dir = path.join(DATA_DIR, 'messages');
    try {
      const files = await fs.readdir(dir);
      const messages = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async f => {
            const data = await readJSON<StoredMessage>(path.join(dir, f));
            return data;
          })
      );
      return messages
        .filter((m): m is StoredMessage => m !== null && m.conversationId === conversationId)
        .sort((a, b) => a.createdAt - b.createdAt);
    } catch {
      return [];
    }
  }

  // Tool Executions
  async saveToolExecution(execution: StoredToolExecution): Promise<void> {
    const filepath = path.join(DATA_DIR, 'tool-executions', `${execution.id}.json`);
    await writeJSON(filepath, execution);
  }

  async getToolExecutionsByConversation(conversationId: string): Promise<StoredToolExecution[]> {
    const dir = path.join(DATA_DIR, 'tool-executions');
    try {
      const files = await fs.readdir(dir);
      const executions = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async f => {
            const data = await readJSON<StoredToolExecution>(path.join(dir, f));
            return data;
          })
      );
      return executions
        .filter((e): e is StoredToolExecution => e !== null && e.conversationId === conversationId)
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return [];
    }
  }

  // Backup and restore utilities
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(DATA_DIR, 'backups', timestamp);
    await fs.mkdir(backupDir, { recursive: true });

    // Copy all data files
    const dirs = ['verified-links', 'permissions', 'conversations', 'messages', 'tool-executions'];
    for (const dir of dirs) {
      const srcDir = path.join(DATA_DIR, dir);
      const destDir = path.join(backupDir, dir);
      await fs.mkdir(destDir, { recursive: true });
      
      try {
        const files = await fs.readdir(srcDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.copyFile(path.join(srcDir, file), path.join(destDir, file));
          }
        }
      } catch {}
    }

    return timestamp;
  }

  // Stats for monitoring
  async getStats(): Promise<{
    verifiedLinks: number;
    activePermissions: number;
    conversations: number;
    messages: number;
    toolExecutions: number;
  }> {
    const countFiles = async (dir: string): Promise<number> => {
      try {
        const files = await fs.readdir(path.join(DATA_DIR, dir));
        return files.filter(f => f.endsWith('.json')).length;
      } catch {
        return 0;
      }
    };

    return {
      verifiedLinks: await countFiles('verified-links'),
      activePermissions: await countFiles('permissions'),
      conversations: await countFiles('conversations'),
      messages: await countFiles('messages'),
      toolExecutions: await countFiles('tool-executions'),
    };
  }
}

// Singleton instance
export const storage = new FileStorageService();