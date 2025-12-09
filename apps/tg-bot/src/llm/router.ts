import OpenAI from "openai";
import { apiCaller } from "../tools/apiCaller.js";
import { eventWatcher } from "../tools/eventWatcher.js";
import { getVerifiedAccount } from "../services/verification.js";
import { backendSwapService, TOKENS } from "../services/backendSwapService.js";
import { backendTransactionService } from "../services/backendTransactionService.js";
import { z } from "zod";
import { Address, parseUnits, encodeFunctionData } from "viem";
import { MintableERC20ABI } from "../abi/erc20.js";

// OpenRouter configuration
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
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

function getErrorResponse(errorType: string | undefined, errorMsg: any): string {
  if (errorType === 'expired_session') {
    return `⚠️ Your session key has expired. Please renew your permissions:\nhttps://rise-bot.com/grant`;
  } else if (errorType === 'no_permission') {
    return `⚠️ You haven't granted permission for this action yet. Please grant permissions:\nhttps://rise-bot.com/grant`;
  } else if (errorType === 'unauthorized') {
    return `⛔ Unauthorized: You don't have the required permissions for this action. Please update your permissions:\nhttps://rise-bot.com/grant`;
  }
  return `❌ Transaction failed: ${errorMsg instanceof Error ? errorMsg.message : String(errorMsg)}`;
}

export function createLlmRouter() {0
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
                User identity is bound to a RISE account: ${userAddress || "address not provided"}
                
                Available tools and their required JSON format:
                
                Swap tokens:
                {"tool": "swap", "params": {"fromToken": "MockUSD"|"MockToken", "toToken": "MockUSD"|"MockToken", "amount": "10.5", "slippagePercent": 0.5}}
                
                Transfer tokens:
                {"tool": "transfer", "params": {"tokenSymbol": "RISE"|"MockUSD"|"MockToken", "to": "0x123...", "amount": "10.5"}}
                
                Mint tokens (mints test tokens):
                {"tool": "mint", "params": {"tokenSymbol": "MockUSD"|"MockToken"}}
                
                Get balances (individual token balances):
                {"tool": "get_balances", "params": {"address": "${userAddress || "0x123..."}"}}

                Get wallet summary (total portfolio value, all balances, recent transactions):
                {"tool": "get_wallet_summary", "params": {"address": "${userAddress || "0x123..."}"}}

                Get transactions:
                {"tool": "get_transactions", "params": {"address": "${userAddress || "0x123..."}", "limit": 10}}

                IMPORTANT: 
                - Token names: Use exact values "MockUSD" or "MockToken"
                - Amounts: Always use strings like "10.5", never numbers
                - Addresses: Always use full 0x... format
                
                Respond with ONLY a valid JSON object, no explanations.`,
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

        console.log("🤖 LLM Raw Response:", content);
        
        let parsedJson;
        try {
          parsedJson = JSON.parse(content);
          console.log("📊 Parsed JSON:", parsedJson);
        } catch (parseError) {
          console.error("❌ Failed to parse JSON:", parseError);
          return "Sorry, I received an invalid response format. Please try again.";
        }

        const parsed = ToolCallSchema.parse(parsedJson);

        // Handle query tools
        if (parsed.tool === "get_balances") {
          const resultString = await apiCaller.getBalances.execute({
            address: parsed.params.address || userAddress || "",
          }, {
            sessionID: telegramId,
            messageID: "msg_" + Date.now(),
            agent: "telegram-bot",
            abort: new AbortController()
          });
          const result = JSON.parse(resultString);
          if (result.error) return `Error: ${result.error}`;
          
          let message = `💰 **Wallet Balances**\n`;
          if (result.success) {
            message += `Total Value: ${result.totalUsdValue}\n\n`;
            result.balances.forEach((b: any) => {
              message += `${b.token}: ${b.balance} (${b.usdValue})\n`;
            });
          }
          return message;
        }

        if (parsed.tool === "get_transactions") {
          const resultString = await apiCaller.getTransactionHistory.execute({
            address: parsed.params.address || userAddress || "",
            limit: parsed.params.limit,
          }, {
            sessionID: telegramId,
            messageID: "msg_" + Date.now(),
            agent: "telegram-bot",
            abort: new AbortController()
          });
          const result = JSON.parse(resultString);
          if (result.error) return `Error: ${result.error}`;
          
          let message = `📋 **Recent Transactions**\n`;
          if (result.success) {
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
          }
          return message;
        }

        if (parsed.tool === "get_wallet_summary") {
          const resultString = await apiCaller.getWalletSummary.execute({
            address: parsed.params.address || userAddress || "",
          }, {
            sessionID: telegramId,
            messageID: "msg_" + Date.now(),
            agent: "telegram-bot",
            abort: new AbortController()
          });
          const result = JSON.parse(resultString);
          if (result.error) return `Error: ${result.error}`;
          
          let message = `📊 **Wallet Summary**\n`;
          if (result.success) {
            message += `Total Portfolio Value: ${result.totalValue}\n\n`;
            message += `💎 Tokens: ${result.breakdown.tokens.value} (${result.breakdown.tokens.count} tokens)\n`;
            message += `🏦 DeFi Positions: ${result.breakdown.protocols.value} (${result.breakdown.protocols.count} positions)\n`;
          }
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

          // For now, allow verified accounts to see transaction details
          // TODO: Implement session permissions for full automation
          if (!sessionKey) {
            console.log("⚠️ No session key found, but account is verified. Showing transaction details instead of executing.");
          }
        }

        if (parsed.tool === "mint") {
          console.log(`🪙 Executing mint transaction for ${parsed.params.tokenSymbol}`);
          
          const token = TOKENS[parsed.params.tokenSymbol];
          if (!token) {
            return `❌ Unknown token: ${parsed.params.tokenSymbol}. Available: ${Object.keys(TOKENS).join(", ")}`;
          }

          try {
            // Use mintOnce() which mints a fixed amount (usually 100) to msg.sender
            const calls = [{
              to: token.address,
              data: encodeFunctionData({
                abi: MintableERC20ABI,
                functionName: "mintOnce",
                args: [],
              }),
            }];

            const result = await backendTransactionService.execute({
              calls,
              requiredPermissions: { calls: [token.address] }
            }, userAddress as Address);

            if (result.success) {
               return `✅ Successfully minted ${parsed.params.tokenSymbol} to your wallet!\n\nTransaction Hash: ${result.data?.hash || "unknown"}`;
            } else {
               return getErrorResponse(result.errorType, result.error);
            }
          } catch(error) {
            console.error("Mint error:", error);
            return `❌ Mint execution error: ${error instanceof Error ? error.message : String(error)}`;
          }
        }

        if (parsed.tool === "transfer") {
          console.log(`💸 Executing transfer of ${parsed.params.amount} ${parsed.params.tokenSymbol} to ${parsed.params.to}`);
          
          try {
            let calls = [];
            
            if (parsed.params.tokenSymbol === "RISE") {
              // Native transfer
              calls.push({
                to: parsed.params.to as Address,
                value: parseUnits(parsed.params.amount, 18), // RISE has 18 decimals
                data: "0x" as `0x${string}`,
              });
            } else {
              // ERC20 Transfer
              const token = TOKENS[parsed.params.tokenSymbol as keyof typeof TOKENS];
              if (!token) {
                return `❌ Unknown token: ${parsed.params.tokenSymbol}`;
              }
              
              calls.push({
                to: token.address,
                data: encodeFunctionData({
                  abi: MintableERC20ABI,
                  functionName: "transfer",
                  args: [parsed.params.to as Address, parseUnits(parsed.params.amount, token.decimals)],
                }),
              });
            }

            const result = await backendTransactionService.execute({
              calls,
              // For transfers, we need permission to call the token (or any contract for RISE transfer?)
              // Porto permissions for RISE transfer? It's a call with value.
              requiredPermissions: { 
                calls: parsed.params.tokenSymbol === "RISE" ? [] : [TOKENS[parsed.params.tokenSymbol as keyof typeof TOKENS].address] 
              }
            }, userAddress as Address);

            if (result.success) {
               return `✅ Successfully transferred ${parsed.params.amount} ${parsed.params.tokenSymbol}!\n\nTransaction Hash: ${result.data?.hash || "unknown"}`;
            } else {
               return getErrorResponse(result.errorType, result.error);
            }
          } catch(error) {
            console.error("Transfer error:", error);
            return `❌ Transfer execution error: ${error instanceof Error ? error.message : String(error)}`;
          }
        }

        if (parsed.tool === "swap") {
          console.log(`🔄 Executing swap: ${parsed.params.amount} ${parsed.params.fromToken} → ${parsed.params.toToken}`);
          
          try {
            // Execute swap using backend service (matches wallet-demo pattern)
            const swapResult = await backendSwapService.executeSwap({
              fromToken: parsed.params.fromToken,
              toToken: parsed.params.toToken, 
              amount: parsed.params.amount,
              userAddress: (userAddress || "") as Address,
              slippagePercent: parsed.params.slippagePercent || 0.5
            });

            if (!swapResult.success) {
              return getErrorResponse(swapResult.errorType, swapResult.error || swapResult.error?.message);
            }

            const totalTxs = swapResult.data?.totalTransactions || 1;
            const txHash = swapResult.data?.hash || "unknown";
            return `✅ Successfully swapped ${parsed.params.amount} ${parsed.params.fromToken} for ${parsed.params.toToken}!\n\n${totalTxs} transaction(s) executed using session key\nFinal hash: ${txHash?.slice(0, 10)}...\nCheck it on the explorer: https://explorer.testnet.riselabs.xyz/tx/${txHash}`;

          } catch (error) {
            console.error("🔄 Swap execution error:", error);
            return `❌ Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }

        // Handle alert tools
        if (parsed.tool === "create_alert") {
          const resultString = await eventWatcher.createAlert.execute(parsed.params, {
            sessionID: telegramId,
            messageID: "msg_" + Date.now(),
            agent: "telegram-bot",
            abort: new AbortController()
          });
          const result = JSON.parse(resultString);
          if (result.error) return `Error: ${result.error}`;
          
          if (result.alertId && result.message) {
            return `🔔 Alert created!\n\nID: ${result.alertId}\nType: ${parsed.params.type}\n\n${result.message}`;
          }
          return `🔔 Alert created!`;
        }

        if (parsed.tool === "list_alerts") {
          const resultString = await eventWatcher.listAlerts.execute({}, {
            sessionID: telegramId,
            messageID: "msg_" + Date.now(),
            agent: "telegram-bot",
            abort: new AbortController()
          });
          const result = JSON.parse(resultString);
          if (result.error) return `Error: ${result.error}`;
          
          if (result.count === 0) {
            return "📭 You don't have any active alerts.";
          }
          
          let message = `🔔 **Active Alerts**`;
          if (result.count) message += ` (${result.count})`;
          message += `\n\n`;
          if (result.alerts) {
            result.alerts.forEach((alert: any) => {
              message += `ID: ${alert.id}\nType: ${alert.type}\nCreated: ${alert.createdAt}\n\n`;
            });
          }
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
