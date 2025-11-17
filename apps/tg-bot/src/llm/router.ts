import OpenAI from "openai";
import { transactionBuilder } from "../tools/transactionBuilder.js";
import { apiCaller } from "../tools/apiCaller.js";
import { eventWatcher } from "../tools/eventWatcher.js";
import { getVerifiedAccount } from "../services/verification.js";
import { z } from "zod";
import { Address, createPublicClient, http, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { TransactionCall } from "../types/index.js";

const RISE_RPC_URL = process.env.RISE_RPC_URL!;
const BACKEND_SIGNER_PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY as `0x${string}`;
const BACKEND_SIGNER_ADDRESS = process.env.BACKEND_SIGNER_ADDRESS as Address;

// OpenRouter configuration
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});

// Define the chain configuration
const riseTestnet = {
  id: 717175,
  name: "RISE Testnet",
  network: "rise-testnet",
  nativeCurrency: {
    name: "RISE",
    symbol: "RISE",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [RISE_RPC_URL] },
    public: { http: [RISE_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "RISE Explorer", url: "https://testnet-explorer.riselabs.xyz" },
  },
} as const;

const publicClient = createPublicClient({
  chain: riseTestnet,
  transport: http(RISE_RPC_URL),
});

const account = privateKeyToAccount(BACKEND_SIGNER_PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: riseTestnet,
  transport: http(RISE_RPC_URL),
});

// Tool schemas for structured outputs
const ToolCallSchema = z.discriminatedUnion("tool", [
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

type ToolCall = z.infer<typeof ToolCallSchema>;

export function createLlmRouter() {
  return {
    async handleMessage(opts: { 
      telegramId: string; 
      text: string; 
      userAddress?: Address;
      sessionKey?: any;
    }): Promise<string> {
      const { telegramId, text, userAddress, sessionKey } = opts;

      try {
        // Ask the model to choose a tool + params
        const response = await openai.chat.completions.create({
          model: "openai/gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a transaction router for the RISE chain Telegram bot. 
                User identity is bound to a RISE account. 
                Available tools:
                - mint: Mint MockUSD or MockToken
                - transfer: Send RISE (native), MockUSD, or MockToken
                - swap: Swap between MockUSD and MockToken
                - get_balances: Check token balances
                - get_transactions: View transaction history
                - get_positions: View DeFi positions
                - get_wallet_summary: Get total portfolio value
                - create_alert, list_alerts, remove_alert: Manage alerts
                
                Return a JSON object describing which tool to call and its params.
                For queries, use the user's address: ${userAddress || "address not provided"}`,
            },
            {
              role: "user",
              content: text,
            },
          ],
          response_format: {
            type: "json_object",
          },
        });

        const content = response.choices[0].message.content;
        if (!content) {
          return "Sorry, I couldn't understand your request. Please try again.";
        }

        const parsed = ToolCallSchema.parse(JSON.parse(content));

        // Handle query tools
        if (parsed.tool === "get_balances") {
          const result = await apiCaller.getBalances.execute({
            address: parsed.params.address || userAddress || "",
          });
          if (result.error) return `Error: ${result.error}`;
          
          let message = `💰 **Wallet Balances**\n`;
          message += `Total Value: ${result.totalUsdValue}\n\n`;
          result.balances.forEach((b: any) => {
            message += `${b.token}: ${b.balance} (${b.usdValue})\n`;
          });
          return message;
        }

        if (parsed.tool === "get_transactions") {
          const result = await apiCaller.getTransactionHistory.execute({
            address: parsed.params.address || userAddress || "",
            limit: parsed.params.limit,
          });
          if (result.error) return `Error: ${result.error}`;
          
          let message = `📋 **Recent Transactions**\n`;
          message += `Total: ${result.totalCount} transactions\n\n`;
          result.transactions.slice(0, 5).forEach((tx: any) => {
            message += `${tx.success ? "✅" : "❌"} ${tx.timestamp}\n`;
            message += `Hash: ${tx.txHash.slice(0, 10)}...\n`;
            tx.calls.forEach((call: any) => {
              if (call.isTransfer && call.tokenSymbol) {
                message += `  → ${call.functionName} ${call.tokenSymbol}\n`;
              } else {
                message += `  → ${call.functionName || "Contract call"}\n`;
              }
            });
            message += "\n";
          });
          return message;
        }

        if (parsed.tool === "get_wallet_summary") {
          const result = await apiCaller.getWalletSummary.execute({
            address: parsed.params.address || userAddress || "",
          });
          if (result.error) return `Error: ${result.error}`;
          
          let message = `📊 **Wallet Summary**\n`;
          message += `Total Portfolio Value: ${result.totalValue}\n\n`;
          message += `💎 Tokens: ${result.breakdown.tokens.value} (${result.breakdown.tokens.count} tokens)\n`;
          message += `🏦 DeFi Positions: ${result.breakdown.protocols.value} (${result.breakdown.protocols.count} positions)\n`;
          return message;
        }

        // Handle transaction tools - check verification first
        const requiresVerification = ["mint", "transfer", "swap"].includes(parsed.tool);
        
        if (requiresVerification) {
          // Check if account is verified
          const verifiedAccount = await getVerifiedAccount(telegramId);
          if (!verifiedAccount) {
            return "⚠️ Your account needs to be verified before executing transactions.\n\nPlease use /link to verify your wallet ownership.";
          }

          // Check if permissions are granted
          if (!sessionKey) {
            return "⚠️ You need to grant permissions to the bot.\n\nPlease complete the wallet linking process at /link.";
          }
        }

        if (parsed.tool === "mint") {
          const result = await transactionBuilder.mint.execute(parsed.params);
          if (result.error) return `Error: ${result.error}`;

          return `🪙 Minting ${parsed.params.tokenSymbol}...\n\nTransaction prepared. Confirming with your session key...`;
        }

        if (parsed.tool === "transfer") {
          const result = await transactionBuilder.transfer.execute(parsed.params);
          if (result.error) return `Error: ${result.error}`;

          return `💸 Transferring ${parsed.params.amount} ${parsed.params.tokenSymbol} to ${parsed.params.to.slice(0, 10)}...\n\nTransaction prepared. Confirming with your session key...`;
        }

        if (parsed.tool === "swap") {
          const result = await transactionBuilder.swap.execute(parsed.params);
          if (result.error) return `Error: ${result.error}`;

          return `🔄 Swapping ${parsed.params.amount} ${parsed.params.fromToken} for ${parsed.params.toToken}...\n\nTransaction prepared. Confirming with your session key...`;
        }

        // Handle alert tools
        if (parsed.tool === "create_alert") {
          const result = await eventWatcher.createAlert.execute(parsed.params);
          if (result.error) return `Error: ${result.error}`;
          
          return `🔔 Alert created!\n\nID: ${result.alertId}\nType: ${parsed.params.type}\n\n${result.message}`;
        }

        if (parsed.tool === "list_alerts") {
          const result = await eventWatcher.listAlerts.execute({});
          if (result.error) return `Error: ${result.error}`;
          
          if (result.count === 0) {
            return "📭 You don't have any active alerts.";
          }
          
          let message = `🔔 **Active Alerts** (${result.count})\n\n`;
          result.alerts.forEach((alert: any) => {
            message += `ID: ${alert.id}\nType: ${alert.type}\nCreated: ${alert.createdAt}\n\n`;
          });
          return message;
        }

        return "I couldn't understand your request. Try asking about balances, transactions, or making transfers.";

      } catch (error) {
        console.error("LLM Router error:", error);
        return "Sorry, I encountered an error processing your request. Please try again.";
      }
    },
  };
}