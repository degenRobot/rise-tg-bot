import type { Address } from "viem";

export type Period = "minute" | "hour" | "day" | "week" | "month" | "year";

export type SpendPermission = {
  token?: Address;
  limit: string; // hex string wei
  period: Period;
};

export type CallPermission = {
  to?: Address;
  signature?: string;
};

export type PermissionTemplate = {
  id: string;
  label: string;
  description: string;
  feeTokenSymbol?: string;
  defaultExpirySeconds: number;
  spend?: SpendPermission[];
  calls?: CallPermission[];
};

// Simple permission templates for the bot
export const PERMISSION_TEMPLATES: PermissionTemplate[] = [
  {
    id: "custom",
    label: "Custom Permissions",
    description: "User-defined permissions from the frontend",
    defaultExpirySeconds: 7 * 24 * 60 * 60, // 1 week
    spend: [],
    calls: [],
  },
];