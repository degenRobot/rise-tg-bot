import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyAndLinkAccount, createVerificationMessage } from './verification';
import { verifyMessage, verifyHash } from 'viem/actions';
import { storage } from './storage';

// Mock dependencies
vi.mock('viem/actions', () => ({
  verifyMessage: vi.fn(),
  verifyHash: vi.fn(),
}));

vi.mock('../config/backendRiseClient.js', () => ({
  risePublicClient: {
    getBytecode: vi.fn(),
  },
}));

vi.mock('./storage', () => ({
  storage: {
    getVerifiedLink: vi.fn(),
    saveVerifiedLink: vi.fn(),
    revokeVerifiedLink: vi.fn(),
  },
}));

describe('VerificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createVerificationMessage', () => {
    it('should create a correctly formatted message', () => {
      const result = createVerificationMessage('123', 'user');
      expect(result.message).toContain('RISE Telegram Bot Verification');
      expect(result.message).toContain('user (ID: 123)');
      expect(result.data.telegramId).toBe('123');
      expect(result.data.nonce).toBeDefined();
    });
  });

  describe('verifyAndLinkAccount', () => {
    const mockParams = {
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`, // Valid checksum address
      signature: '0xsig' as `0x${string}`,
      message: 'RISE Telegram Bot Verification\n\nI am linking my wallet to Telegram account @user (ID: 123)\n\nTimestamp: 123\nNonce: abc\n\nThis signature proves I control this wallet and authorize the RISE bot to execute transactions on my behalf.',
      telegramId: '123',
      telegramHandle: 'user',
    };

    it('should successfully verify valid EOA signature', async () => {
      // Mock viem verification success
      (verifyMessage as any).mockResolvedValue(true);
      
      const result = await verifyAndLinkAccount(mockParams);

      expect(result.success).toBe(true);
      expect(verifyMessage).toHaveBeenCalled();
      expect(storage.saveVerifiedLink).toHaveBeenCalled();
    });

    it('should fail if viem verification fails', async () => {
      (verifyMessage as any).mockResolvedValue(false);
      (verifyHash as any).mockResolvedValue(false);

      const result = await verifyAndLinkAccount(mockParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('signature verification failed');
    });

    it('should fail if message content does not match params', async () => {
      (verifyMessage as any).mockResolvedValue(true);

      const result = await verifyAndLinkAccount({
        ...mockParams,
        telegramHandle: 'otheruser', // Mismatch
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Telegram handle does not match message');
    });

    it('should handle smart wallet verification fallback', async () => {
      const { riseRelayClient } = await import('../config/backendRiseClient.js');
      (riseRelayClient.getBytecode as any).mockResolvedValue('0xcode'); // Is contract
      
      (verifyMessage as any).mockResolvedValue(false); // Viem fails initially
      
      // Fallback logic for long signatures
      const longSig = '0x' + 'a'.repeat(1002) as `0x${string}`;
      
      const result = await verifyAndLinkAccount({
        ...mockParams,
        signature: longSig,
      });

      expect(result.success).toBe(true); // Fallback passed
    });
  });
});

