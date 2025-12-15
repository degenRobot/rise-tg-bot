import type { Address } from "viem";
import type { ExecutionErrorType } from "./transactions.js";
import { CONTRACT_REGISTRY } from "@rise-bot/shared";

/**
 * Swap Types
 * Used for token swap operations via Uniswap
 * Change these according to your needs
 */

// Re-export TOKENS from shared registry for backward compatibility
export const TOKENS = CONTRACT_REGISTRY.tokens;

export type TokenSymbol = keyof typeof TOKENS;

export type SwapParams = {
  fromToken: TokenSymbol;
  toToken: TokenSymbol;
  amount: string;
  userAddress: Address;
  slippagePercent?: number;
  expectedOut?: bigint; // Expected output from pool (for accurate slippage calculation)
};

export type SwapResult = {
  success: boolean;
  data: unknown;
  error: Error | string | null;
  errorType?: ExecutionErrorType;
};
