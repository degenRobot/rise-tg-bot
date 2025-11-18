import { tool } from "@opencode-ai/plugin";
import { Address, encodeFunctionData, parseEther, parseUnits } from "viem";
import { MintableERC20ABI } from "../abi/erc20.js";
import { UniswapV2RouterABI } from "../abi/swap.js";
import { z } from "zod";
import "dotenv/config";

const TOKENS = {
  MockUSD: {
    address: (process.env.MOCK_USD_ADDRESS || "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50") as Address,
    decimals: 18,
    symbol: "MockUSD",
    name: "Mock USD",
  },
  MockToken: {
    address: (process.env.MOCK_TOKEN_ADDRESS || "0x6166a6e02b4CF0e1E0397082De1B4fc9CC9D6ceD") as Address,
    decimals: 18,
    symbol: "MockToken",
    name: "Mock Token",
  },
} as const;

const UNISWAP_CONTRACTS = {
  factory: (process.env.UNISWAP_FACTORY_ADDRESS || "0xf6A86076ce8e9A2ff628CD3a728FcC5876FA70C6") as Address,
  router: (process.env.UNISWAP_ROUTER_ADDRESS || "0x6c10B45251F5D3e650bcfA9606c662E695Af97ea") as Address,
  pair: (process.env.UNISWAP_PAIR_ADDRESS || "0xf8da515e51e5B1293c2430d406aE41E6e5B9C992") as Address,
};

export const mintTool = tool({
  description: "Mint tokens from a mintable ERC20 contract",
  args: {
    tokenSymbol: tool.schema.enum(["MockUSD", "MockToken"]).describe("Token symbol to mint"),
  },
  async execute(args, context) {
    const token = TOKENS[args.tokenSymbol];
    if (!token) {
      return JSON.stringify({ error: "Invalid token symbol" });
    }

    const call = {
      to: token.address,
      data: encodeFunctionData({
        abi: MintableERC20ABI,
        functionName: "mintOnce",
        args: [],
      }),
      requiredPermissions: { calls: [token.address.toLowerCase()] }
    };

    return JSON.stringify({
      success: true,
      tool: "mint",
      params: {
        tokenSymbol: args.tokenSymbol,
        tokenAddress: token.address
      },
      call
    });
  }
});

export const transferTool = tool({
  description: "Transfer native RISE tokens or ERC20 tokens to another address",
  args: {
    tokenSymbol: tool.schema.enum(["RISE", "MockUSD", "MockToken"]).describe("Token to transfer (RISE for native token)"),
    to: tool.schema.string().describe("Recipient address"),
    amount: tool.schema.string().describe("Amount to transfer (in human readable format, e.g., '0.1', '10.5')"),
  },
  async execute(args) {
    const to = args.to as Address;
    
    if (args.tokenSymbol === "RISE") {
      // Native token transfer
      const value = parseEther(args.amount);
      const call = {
        to,
        value,
        requiredPermissions: { calls: [] }
      };

      return {
        success: true,
        tool: "transfer",
        params: {
          tokenSymbol: args.tokenSymbol,
          to,
          amount: args.amount,
          value: value.toString()
        },
        call
      };
    } else {
      // ERC20 transfer
      const token = TOKENS[args.tokenSymbol];
      if (!token) {
        return { error: "Invalid token symbol" };
      }

      const amount = parseUnits(args.amount, token.decimals);
      const call = {
        to: token.address,
        data: encodeFunctionData({
          abi: MintableERC20ABI,
          functionName: "transfer",
          args: [to, amount],
        }),
        requiredPermissions: { calls: [token.address.toLowerCase()] }
      };

      return {
        success: true,
        tool: "transfer",
        params: {
          tokenSymbol: args.tokenSymbol,
          tokenAddress: token.address,
          to,
          amount: args.amount,
          amountWei: amount.toString()
        },
        call
      };
    }
  }
});

export const swapTool = tool({
  description: "Swap tokens using UniswapV2 router",
  args: {
    fromToken: tool.schema.enum(["MockUSD", "MockToken"]).describe("Token to swap from"),
    toToken: tool.schema.enum(["MockUSD", "MockToken"]).describe("Token to swap to"),
    amount: tool.schema.string().describe("Amount to swap (in human readable format)"),
    recipient: tool.schema.string().optional().describe("Recipient address (defaults to sender)"),
    slippagePercent: tool.schema.number().optional().describe("Slippage tolerance in percent (default 0.5%)"),
  },
  async execute(args) {
    const fromTokenInfo = TOKENS[args.fromToken];
    const toTokenInfo = TOKENS[args.toToken];
    
    if (!fromTokenInfo || !toTokenInfo) {
      return { error: "Invalid token symbols" };
    }

    if (args.fromToken === args.toToken) {
      return { error: "Cannot swap token to itself" };
    }

    const amountIn = parseUnits(args.amount, fromTokenInfo.decimals);
    const slippage = args.slippagePercent ?? 0.5;
    const amountOutMin = (amountIn * BigInt(Math.floor((100 - slippage) * 100))) / 10000n;
    
    // Set deadline to 20 minutes from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    const path = [fromTokenInfo.address, toTokenInfo.address];
    const to = (args.recipient as Address) || "0x0000000000000000000000000000000000000000"; // Will be replaced with actual user address

    const calls = [
      // First approve the router to spend tokens
      {
        to: fromTokenInfo.address,
        data: encodeFunctionData({
          abi: MintableERC20ABI,
          functionName: "approve",
          args: [UNISWAP_CONTRACTS.router, amountIn],
        }),
      },
      // Then perform the swap
      {
        to: UNISWAP_CONTRACTS.router,
        data: encodeFunctionData({
          abi: UniswapV2RouterABI,
          functionName: "swapExactTokensForTokens",
          args: [amountIn, amountOutMin, path, to, deadline],
        }),
      }
    ];

    return {
      success: true,
      tool: "swap",
      params: {
        fromToken: args.fromToken,
        toToken: args.toToken,
        amount: args.amount,
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMin.toString(),
        slippage: slippage,
        deadline: deadline.toString(),
        recipient: to
      },
      calls,
      requiredPermissions: {
        calls: [fromTokenInfo.address.toLowerCase(), UNISWAP_CONTRACTS.router.toLowerCase()]
      }
    };
  }
});

export const transactionBuilder = {
  mint: mintTool,
  transfer: transferTool,
  swap: swapTool
};