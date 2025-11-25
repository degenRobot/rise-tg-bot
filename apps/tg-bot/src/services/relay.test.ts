import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prepareCalls } from './relay';
import * as RelayActions from 'rise-wallet/viem/RelayActions';
import * as Key from 'rise-wallet/viem/Key';
import { Address } from 'viem';

// Mock rise-wallet dependencies
vi.mock('rise-wallet/viem/RelayActions', () => ({
  getCapabilities: vi.fn(),
  prepareCalls: vi.fn(),
  sendPreparedCalls: vi.fn(),
}));

vi.mock('rise-wallet/viem/Key', () => ({
  toRelay: vi.fn((key) => key),
}));

describe('RelayService', () => {
  const mockClient = {
    request: vi.fn(),
    chain: { id: 11155931 },
  } as any;

  const mockAccount = {
    address: '0x123',
  } as any;

  const mockCalls = [
    { to: '0xabc' as Address, value: 100n },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    (RelayActions.getCapabilities as any).mockResolvedValue({
      contracts: { orchestrator: { address: '0xorch' } },
      fees: { tokens: [] },
    });
  });

  describe('prepareCalls', () => {
    it('should construct correct params with permissionId', async () => {
      // Mock successful request
      mockClient.request.mockResolvedValue({
        digest: '0xdigest',
        context: { some: 'context' },
      });

      await prepareCalls(mockClient, {
        account: mockAccount,
        chain: mockClient.chain,
        calls: mockCalls,
        permissionId: 'perm_123',
      });

      // Verify client.request was called with correct params
      expect(mockClient.request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'wallet_prepareCalls',
        params: [expect.objectContaining({
          capabilities: expect.objectContaining({
            permissions: {
              id: 'perm_123'
            }
          })
        })]
      }));
    });

    it('should handle authorizeKeys for session keys', async () => {
      const mockKey = { role: 'session', publicKey: '0xkey' };
      
      await prepareCalls(mockClient, {
        account: mockAccount,
        chain: mockClient.chain,
        calls: mockCalls,
        authorizeKeys: [mockKey] as any[],
      });

      // Verify orchestrator address was fetched
      expect(RelayActions.getCapabilities).toHaveBeenCalled();
      
      // Verify toRelay was called
      expect(Key.toRelay).toHaveBeenCalled();
    });

    it('should handle fee token inference', async () => {
      const mockKey = {
        permissions: {
          spend: [{ token: '0xfee' }]
        }
      };

      await prepareCalls(mockClient, {
        account: mockAccount,
        chain: mockClient.chain,
        calls: mockCalls,
        key: mockKey as any,
      });

      expect(mockClient.request).toHaveBeenCalledWith(expect.objectContaining({
        params: [expect.objectContaining({
          capabilities: expect.objectContaining({
            meta: expect.objectContaining({
              feeToken: '0xfee'
            })
          })
        })]
      }));
    });
  });
});

