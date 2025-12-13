import type { Address } from "viem";
import type { ExecutionErrorType } from "./transactions.js";

/**
 * Swap Types
 * Used for token swap operations via Uniswap
 * Change these according to your needs
 */

export const TOKENS = {
  MockUSD: {
    address: "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50" as Address,
    decimals: 18,
    symbol: "MockUSD",
  },
  MockToken: {
    address: "0x6166a6e02b4CF0e1E0397082De1B4fc9CC9D6ceD" as Address,
    decimals: 18,
    symbol: "MockToken",
  },
} as const;

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
