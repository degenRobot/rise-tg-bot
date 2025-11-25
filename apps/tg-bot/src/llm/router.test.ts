import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLlmRouter } from './router';
import OpenAI from 'openai';
import { z } from 'zod';

// Mock OpenAI
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('openai', () => {
  return {
    default: class OpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      constructor() {}
    },
  };
});

// Mock dependencies - Use exact paths including extensions if needed
vi.mock('../tools/apiCaller.js', () => ({
  apiCaller: {
    getBalances: { execute: vi.fn() },
    getTransactionHistory: { execute: vi.fn() },
    getWalletSummary: { execute: vi.fn() },
  },
}));

vi.mock('../tools/eventWatcher.js', () => ({
  eventWatcher: {
    createAlert: { execute: vi.fn() },
    listAlerts: { execute: vi.fn() },
  },
}));

vi.mock('../services/verification.js', () => ({
  getVerifiedAccount: vi.fn(),
}));

vi.mock('../services/backendSwapService.js', () => ({
  backendSwapService: {
    executeSwap: vi.fn(),
  },
  TOKENS: {
    MockUSD: { address: '0xusd', decimals: 18, symbol: 'MockUSD' },
    MockToken: { address: '0xtoken', decimals: 18, symbol: 'MockToken' },
  }
}));

vi.mock('../services/backendTransactionService.js', () => ({
  backendTransactionService: {
    execute: vi.fn(),
  },
}));

describe('LLMRouter', () => {
  let router: ReturnType<typeof createLlmRouter>;

  beforeEach(() => {
    router = createLlmRouter();
    vi.clearAllMocks();
  });

  it('should parse swap intent correctly', async () => {
    // Mock LLM response
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            tool: 'swap',
            params: {
              fromToken: 'MockUSD',
              toToken: 'MockToken',
              amount: '10',
            }
          })
        }
      }]
    });

    // Mock verification
    const { getVerifiedAccount } = await import('../services/verification.js');
    (getVerifiedAccount as any).mockResolvedValue({ active: true });

    // Mock swap service
    const { backendSwapService } = await import('../services/backendSwapService.js');
    (backendSwapService.executeSwap as any).mockResolvedValue({
      success: true,
      data: { hash: '0xhash' }
    });

    const response = await router.handleMessage({
      telegramId: '123',
      text: 'swap 10 MockUSD for MockToken',
      userAddress: '0xuser' as any,
      sessionKey: {},
    });

    expect(response).toContain('Successfully swapped');
    expect(backendSwapService.executeSwap).toHaveBeenCalledWith(expect.objectContaining({
      fromToken: 'MockUSD',
      toToken: 'MockToken',
      amount: '10',
    }));
  });

  it('should parse transfer intent correctly', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            tool: 'transfer',
            params: {
              tokenSymbol: 'MockUSD',
              to: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
              amount: '5',
            }
          })
        }
      }]
    });

    const { getVerifiedAccount } = await import('../services/verification.js');
    (getVerifiedAccount as any).mockResolvedValue({ active: true });

    const { backendTransactionService } = await import('../services/backendTransactionService.js');
    (backendTransactionService.execute as any).mockResolvedValue({
      success: true,
      data: { hash: '0xhash' }
    });

    const response = await router.handleMessage({
      telegramId: '123',
      text: 'send 5 MockUSD to 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      userAddress: '0xuser' as any,
      sessionKey: {},
    });

    expect(response).toContain('Successfully transferred');
    expect(backendTransactionService.execute).toHaveBeenCalled();
  });

  it('should handle invalid LLM response gracefully', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: 'Not a JSON string'
        }
      }]
    });

    const response = await router.handleMessage({
      telegramId: '123',
      text: 'blah blah',
    });

    expect(response).toContain('invalid response format');
  });

  it('should require verification for transactions', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            tool: 'mint',
            params: {
              tokenSymbol: 'MockUSD',
            }
          })
        }
      }]
    });

    const { getVerifiedAccount } = await import('../services/verification.js');
    (getVerifiedAccount as any).mockResolvedValue(null);

    const response = await router.handleMessage({
      telegramId: '123',
      text: 'mint MockUSD',
    });

    expect(response).toContain('needs to be verified');
  });

  it('should return correct error message for expired session', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            tool: 'mint',
            params: { tokenSymbol: 'MockUSD' }
          })
        }
      }]
    });

    const { getVerifiedAccount } = await import('../services/verification.js');
    (getVerifiedAccount as any).mockResolvedValue({ active: true });

    const { backendTransactionService } = await import('../services/backendTransactionService.js');
    (backendTransactionService.execute as any).mockResolvedValue({
      success: false,
      error: 'Session key expired',
      errorType: 'expired_session',
    });

    const response = await router.handleMessage({
      telegramId: '123',
      text: 'mint MockUSD',
      userAddress: '0xuser' as any,
      sessionKey: {},
    });

    expect(response).toContain('session key has expired');
    expect(response).toContain('https://rise-bot.com/grant');
  });

  it('should return correct error message for no permissions', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            tool: 'transfer',
            params: {
              tokenSymbol: 'MockUSD',
              to: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
              amount: '10',
            }
          })
        }
      }]
    });

    const { getVerifiedAccount } = await import('../services/verification.js');
    (getVerifiedAccount as any).mockResolvedValue({ active: true });

    const { backendTransactionService } = await import('../services/backendTransactionService.js');
    (backendTransactionService.execute as any).mockResolvedValue({
      success: false,
      error: 'No active permission',
      errorType: 'no_permission',
    });

    const response = await router.handleMessage({
      telegramId: '123',
      text: 'transfer 10 MockUSD',
      userAddress: '0xuser' as any,
      sessionKey: {},
    });

    expect(response).toContain("haven't granted permission");
    expect(response).toContain('https://rise-bot.com/grant');
  });

  it('should return correct error message for unauthorized action (swap)', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            tool: 'swap',
            params: {
              fromToken: 'MockUSD',
              toToken: 'MockToken',
              amount: '10',
            }
          })
        }
      }]
    });

    const { getVerifiedAccount } = await import('../services/verification.js');
    (getVerifiedAccount as any).mockResolvedValue({ active: true });

    const { backendSwapService } = await import('../services/backendSwapService.js');
    (backendSwapService.executeSwap as any).mockResolvedValue({
      success: false,
      error: 'Unauthorized',
      errorType: 'unauthorized',
    });

    const response = await router.handleMessage({
      telegramId: '123',
      text: 'swap 10 MockUSD',
      userAddress: '0xuser' as any,
      sessionKey: {},
    });

    expect(response).toContain('Unauthorized: You don\'t have the required permissions');
    expect(response).toContain('https://rise-bot.com/grant');
  });
});
