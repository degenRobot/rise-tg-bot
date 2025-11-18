import { tool } from "@opencode-ai/plugin";
import { Address } from "viem";

const POINTS_API_URL = process.env.POINTS_API_URL || "https://points-api.marble.live";

export const getBalancesTool = tool({
  description: "Get token balances for a wallet address including USD values",
  args: {
    address: tool.schema.string().describe("Wallet address to query"),
  },
  async execute(args, context) {
    try {
      const address = args.address.toLowerCase();
      const response = await fetch(`${POINTS_API_URL}/balances/${address}`);
      
      if (!response.ok) {
        return JSON.stringify({ error: `Failed to fetch balances: ${response.statusText}` });
      }

      const balances = await response.json();
      
      // Format balances for display
      const formattedBalances = balances.map((b: any) => ({
        token: b.symbol || b.tokenId,
        balance: b.balanceFormatted,
        usdValue: b.usdValue ? `$${b.usdValue.toFixed(2)}` : "N/A",
        price: b.price ? `$${b.price.toFixed(2)}` : "N/A",
      }));

      const totalUsdValue = balances.reduce((sum: number, b: any) => sum + (b.usdValue || 0), 0);

      return JSON.stringify({
        success: true,
        address,
        balances: formattedBalances,
        totalUsdValue: `$${totalUsdValue.toFixed(2)}`,
        count: balances.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ error: `API error: ${errorMessage}` });
    }
  },
});

export const getTransactionHistoryTool = tool({
  description: "Get recent transaction history for a wallet address",
  args: {
    address: tool.schema.string().describe("Wallet address to query"),
    limit: tool.schema.number().optional().describe("Number of transactions to fetch (default: 10)"),
  },
  async execute(args, context) {
    try {
      const address = args.address.toLowerCase();
      const limit = args.limit || 10;
      const response = await fetch(`${POINTS_API_URL}/calls/${address}?limit=${limit}`);
      
      if (!response.ok) {
        return JSON.stringify({ error: `Failed to fetch transactions: ${response.statusText}` });
      }

      const data = await response.json();
      const { intents, totalCount, pagination } = data;
      
      // Format transactions for display
      const formattedTxs = intents.map((intent: any) => ({
        txHash: intent.txHash,
        blockNumber: intent.blockNumber,
        timestamp: new Date(Number(intent.timestamp) * 1000).toLocaleString(),
        success: intent.success,
        paymentAmount: intent.paymentAmount || "0",
        paymentToken: intent.paymentToken || "N/A",
        callsCount: intent.calls.length,
        calls: intent.calls.map((call: any) => ({
          to: call.to,
          functionName: call.functionName || "Unknown",
          value: call.value || "0",
          isTransfer: call.isTransfer,
          tokenSymbol: call.tokenSymbol,
        })),
      }));

      return JSON.stringify({
        success: true,
        address,
        transactions: formattedTxs,
        totalCount,
        hasMore: pagination.hasMore,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ error: `API error: ${errorMessage}` });
    }
  },
});

export const getPortfolioPositionsTool = tool({
  description: "Get DeFi protocol positions for a wallet address",
  args: {
    address: tool.schema.string().describe("Wallet address to query"),
  },
  async execute(args, context) {
    try {
      const address = args.address.toLowerCase();
      const response = await fetch(`${POINTS_API_URL}/positions/${address}`);
      
      if (!response.ok) {
        return JSON.stringify({ error: `Failed to fetch positions: ${response.statusText}` });
      }

      const data = await response.json();
      const { positions, totalValue } = data;
      
      // Format positions for display
      const formattedPositions = positions.map((p: any) => ({
        protocol: p.protocol.name,
        type: p.positionType.name,
        assetPair: p.assetPair,
        usdValue: `$${p.usdValue.toFixed(2)}`,
        apy: p.apy ? `${p.apy.toFixed(2)}%` : "N/A",
        change24h: p.change24h ? `$${p.change24h.toFixed(2)}` : "N/A",
        changePercent: p.changePercent24h ? `${p.changePercent24h.toFixed(2)}%` : "N/A",
      }));

      return JSON.stringify({
        success: true,
        address,
        positions: formattedPositions,
        totalValue: `$${totalValue.toFixed(2)}`,
        count: positions.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ error: `API error: ${errorMessage}` });
    }
  },
});

export const getWalletSummaryTool = tool({
  description: "Get a comprehensive wallet summary including total value across tokens and DeFi positions",
  args: {
    address: tool.schema.string().describe("Wallet address to query"),
  },
  async execute(args, context) {
    try {
      const address = args.address.toLowerCase();
      const response = await fetch(`${POINTS_API_URL}/wallet-summary/${address}`);
      
      if (!response.ok) {
        return JSON.stringify({ error: `Failed to fetch wallet summary: ${response.statusText}` });
      }

      const summary = await response.json();

      return JSON.stringify({
        success: true,
        address: summary.account,
        totalValue: summary.formattedTotal,
        breakdown: {
          tokens: {
            value: `$${summary.breakdown.tokens.value.toFixed(2)}`,
            count: summary.breakdown.tokens.count,
          },
          protocols: {
            value: `$${summary.breakdown.protocols.value.toFixed(2)}`,
            count: summary.breakdown.protocols.count,
          },
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ error: `API error: ${errorMessage}` });
    }
  },
});

export const apiCaller = {
  getBalances: getBalancesTool,
  getTransactionHistory: getTransactionHistoryTool,
  getPortfolioPositions: getPortfolioPositionsTool,
  getWalletSummary: getWalletSummaryTool,
};