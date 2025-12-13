import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeWithBackendPermission, Call } from './portoExecution';
import * as permissionStore from './permissionStore';
import * as Key from 'rise-wallet/viem/Key';
import { Address } from 'viem';

// Mock dependencies
vi.mock('./permissionStore', () => ({
  findActivePermissionForBackendKey: vi.fn(),
  findPermissionForBackendKey: vi.fn(),
}));

vi.mock('rise-wallet/viem/Key', () => ({
  fromP256: vi.fn(),
}));

// Mock RelayActions
vi.mock('rise-wallet/viem/RelayActions', () => ({
  sendCalls: vi.fn(),
}));

// Mock Porto client
vi.mock('../config/backendRiseClient.js', () => ({
  portoClient: {},
}));

// Import the mocked modules
import * as RelayActions from 'rise-wallet/viem/RelayActions';

describe('PortoExecution Service', () => {
  const mockWalletAddress = '0xuser' as Address;
  const mockBackendKey = {
    privateKey: '0xpriv',
    publicKey: '0xpub',
    type: 'p256' as const,
  };
  const mockCalls: Call[] = [
    { to: '0xtarget' as Address, value: 100n },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (Key.fromP256 as any).mockReturnValue({
      publicKey: '0xpub',
      type: 'p256',
      permissions: { id: '0xperm' }
    });
  });

  it('should execute successfully when permission is active', async () => {
    // Mock active permission
    (permissionStore.findActivePermissionForBackendKey as any).mockReturnValue({
      id: '0xperm',
      expiry: Date.now() / 1000 + 3600, // 1 hour future
    });

    // Mock sendCalls success
    vi.mocked(RelayActions.sendCalls).mockResolvedValue([
      { hash: '0xtxhash', id: '0xcallsid' }
    ] as any);

    const result = await executeWithBackendPermission({
      walletAddress: mockWalletAddress,
      calls: mockCalls,
      backendSessionKey: mockBackendKey,
    });

    expect(result.success).toBe(true);
    expect(result.callsId).toBe('0xcallsid');
    expect(result.transactionHashes).toEqual(['0xtxhash']);
    expect(RelayActions.sendCalls).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      calls: mockCalls,
    }));
  });

  it('should return no_permission error when no permission found', async () => {
    // Mock no active permission
    (permissionStore.findActivePermissionForBackendKey as any).mockReturnValue(null);
    // Mock no expired permission either
    (permissionStore.findPermissionForBackendKey as any).mockReturnValue(null);

    const result = await executeWithBackendPermission({
      walletAddress: mockWalletAddress,
      calls: mockCalls,
      backendSessionKey: mockBackendKey,
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('no_permission');
    expect(result.error).toContain('No active permission found');
  });

  it('should return expired_session error when permission is expired', async () => {
    // Mock no active permission
    (permissionStore.findActivePermissionForBackendKey as any).mockReturnValue(null);
    // Mock expired permission
    (permissionStore.findPermissionForBackendKey as any).mockReturnValue({
      id: '0xperm',
      expiry: Date.now() / 1000 - 3600, // 1 hour ago
    });

    const result = await executeWithBackendPermission({
      walletAddress: mockWalletAddress,
      calls: mockCalls,
      backendSessionKey: mockBackendKey,
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('expired_session');
    expect(result.error).toContain('Session key expired');
  });

  it('should return unauthorized error when sendCalls fails with Unauthorized', async () => {
    // Mock active permission
    (permissionStore.findActivePermissionForBackendKey as any).mockReturnValue({
      id: '0xperm',
      expiry: Date.now() / 1000 + 3600,
    });

    // Mock sendCalls failure
    vi.mocked(RelayActions.sendCalls).mockRejectedValue(new Error('Reason: Unauthorized'));

    const result = await executeWithBackendPermission({
      walletAddress: mockWalletAddress,
      calls: mockCalls,
      backendSessionKey: mockBackendKey,
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('unauthorized');
    expect(result.error).toContain('Unauthorized');
  });

  it('should return unauthorized error for Invalid precall', async () => {
    // Mock active permission
    (permissionStore.findActivePermissionForBackendKey as any).mockReturnValue({
      id: '0xperm',
      expiry: Date.now() / 1000 + 3600,
    });

    // Mock sendCalls failure
    vi.mocked(RelayActions.sendCalls).mockRejectedValue(new Error('Invalid precall'));

    const result = await executeWithBackendPermission({
      walletAddress: mockWalletAddress,
      calls: mockCalls,
      backendSessionKey: mockBackendKey,
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('unauthorized');
    expect(result.error).toContain('Invalid precall');
  });

  it('should return network_error for network issues', async () => {
    // Mock active permission
    (permissionStore.findActivePermissionForBackendKey as any).mockReturnValue({
      id: '0xperm',
      expiry: Date.now() / 1000 + 3600,
    });

    // Mock sendCalls failure
    vi.mocked(RelayActions.sendCalls).mockRejectedValue(new Error('Network error: failed to fetch'));

    const result = await executeWithBackendPermission({
      walletAddress: mockWalletAddress,
      calls: mockCalls,
      backendSessionKey: mockBackendKey,
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('network_error');
  });
});

