import type { Address, Hex } from "viem";

/**
 * Transaction Types
 * Used across the application for transaction execution
 */

export type TransactionCall = {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
};

export type Call = {
  to: Address;
  data?: Hex;
  value?: bigint;
};

export type TransactionProps = {
  calls: TransactionCall[];
  requiredPermissions?: {
    calls?: string[];
  };
};

export type TransactionData = {
  hash: string;
  callsId?: string;
  success: boolean;
  usedSessionKey?: boolean;
  keyId?: string;
  totalTransactions?: number;
};

export type ExecutionErrorType =
  | "expired_session"
  | "unauthorized"
  | "no_permission"
  | "network_error"
  | "unknown";

export interface ExecutionResult {
  success: boolean;
  callsId: string;
  transactionHashes?: string[];
  error?: any;
  errorType?: ExecutionErrorType;
}

export interface ServiceExecutionResult {
  success: boolean;
  error?: Error | string | null;
  errorType?: ExecutionErrorType;
  data: TransactionData | null;
  transactionHashes?: string[];
}
