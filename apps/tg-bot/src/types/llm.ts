import { z } from "zod";

/**
 * LLM Types
 * Zod schemas and types for LLM tool calling and structured outputs
 */

// Tool schemas for structured outputs
export const ToolCallSchema = z.discriminatedUnion("tool", [
  // Transaction tools
  z.object({
    tool: z.literal("mint"),
    params: z.object({
      tokenSymbol: z.enum(["MockUSD", "MockToken"]),
    }),
  }),
  z.object({
    tool: z.literal("transfer"),
    params: z.object({
      tokenSymbol: z.enum(["RISE", "MockUSD", "MockToken"]),
      to: z.string(),
      amount: z.string(),
    }),
  }),
  z.object({
    tool: z.literal("swap"),
    params: z.object({
      fromToken: z.enum(["MockUSD", "MockToken"]),
      toToken: z.enum(["MockUSD", "MockToken"]),
      amount: z.string(),
      recipient: z.string().optional(),
      slippagePercent: z.number().optional(),
    }),
  }),
  // Query tools
  z.object({
    tool: z.literal("get_address"),
    params: z.object({}),
  }),
  z.object({
    tool: z.literal("get_balances"),
    params: z.object({
      address: z.string(),
    }),
  }),
  z.object({
    tool: z.literal("get_transactions"),
    params: z.object({
      address: z.string(),
      limit: z.number().optional(),
    }),
  }),
  z.object({
    tool: z.literal("get_positions"),
    params: z.object({
      address: z.string(),
    }),
  }),
  z.object({
    tool: z.literal("get_wallet_summary"),
    params: z.object({
      address: z.string(),
    }),
  }),
  // Alert tools
  z.object({
    tool: z.literal("create_alert"),
    params: z.object({
      type: z.enum(["balance_threshold", "new_transaction", "price_change", "position_change"]),
      config: z.object({
        address: z.string().optional(),
        token: z.string().optional(),
        threshold: z.number().optional(),
        direction: z.enum(["above", "below"]).optional(),
      }),
    }),
  }),
  z.object({
    tool: z.literal("list_alerts"),
    params: z.object({}),
  }),
  z.object({
    tool: z.literal("remove_alert"),
    params: z.object({
      alertId: z.string(),
    }),
  }),
]);

export type ToolCall = z.infer<typeof ToolCallSchema>;
