import { Address, encodeFunctionData, parseUnits } from "viem";
import { backendTransactionService, TransactionCall } from "./backendTransactionService.js";
import { MintableERC20ABI } from "../abi/erc20.js";
import { UniswapV2RouterABI } from "../abi/swap.js";
import { ExecutionErrorType } from "./portoExecution.js";

// Token configuration (matching our testnet setup)
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
};

// Uniswap contracts
const UNISWAP_ROUTER = "0x6c10B45251F5D3e650bcfA9606c662E695Af97ea" as Address;

export type SwapParams = {
  fromToken: keyof typeof TOKENS;
  toToken: keyof typeof TOKENS;
  amount: string;
  userAddress: Address;
  slippagePercent?: number;
};

export type SwapResult = {
  success: boolean;
  data: any;
  error: any;
  errorType?: ExecutionErrorType;
};

/**
 * Backend Swap Service
 * 
 * Follows the exact useSwap pattern from wallet-demo but in backend context.
 * Uses backendTransactionService for execution.
 */
class BackendSwapService {

  /**
   * Execute swap (matching wallet-demo's useSwap pattern)
   */
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const { fromToken, toToken, amount, userAddress, slippagePercent = 0.5 } = params;
    
    console.log(`🔄 Backend Swap: Executing swap`);
    console.log(`   ${amount} ${fromToken} → ${toToken}`);
    console.log(`   User: ${userAddress}`);
    console.log(`   Slippage: ${slippagePercent}%`);

    try {
      // Build transaction calls (matching wallet-demo pattern)
      const calls = this.buildSwapCalls(params);
      console.log(`📋 Built ${calls.length} transaction calls`);

      // Get required permissions for calls
      const requiredPermissions = {
        calls: [
          TOKENS[fromToken].address, // Token approval
          UNISWAP_ROUTER, // Router for swap
        ],
      };

      // Execute using backend transaction service
      const result = await backendTransactionService.execute(
        { calls, requiredPermissions }, 
        userAddress
      );
      
      if (result.success) {
        console.log("✅ Swap execution successful!");
        return {
          success: true,
          data: result.data,
          error: null
        };
      } else {
        console.error("❌ Swap execution failed:", result.error);
        return {
          success: false,
          data: null,
          error: result.error,
          errorType: result.errorType
        };
      }

    } catch (error) {
      console.error("❌ Backend swap failed:", error);
      return {
        success: false,
        data: null,
        error
      };
    }
  }

  /**
   * Build swap transaction calls (matching wallet-demo pattern)
   * This replicates the call building logic from useSwap.ts
   */
  private buildSwapCalls(params: SwapParams): TransactionCall[] {
    const { fromToken, toToken, amount, userAddress, slippagePercent = 0.5 } = params;
    
    const fromTokenInfo = TOKENS[fromToken];
    const toTokenInfo = TOKENS[toToken];
    
    const amountIn = parseUnits(amount, fromTokenInfo.decimals);
    const amountOutMin = (amountIn * BigInt(Math.floor((100 - slippagePercent) * 100))) / 10000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

    const calls: TransactionCall[] = [];

    // 1. Approve call (matching wallet-demo - approve max amount for convenience)
    const maxAmount = parseUnits("50", fromTokenInfo.decimals); // Match wallet-demo limit
    calls.push({
      to: fromTokenInfo.address,
      data: encodeFunctionData({
        abi: MintableERC20ABI,
        functionName: "approve",
        args: [UNISWAP_ROUTER, maxAmount],
      }),
    });

    // 2. Swap call
    calls.push({
      to: UNISWAP_ROUTER,
      data: encodeFunctionData({
        abi: UniswapV2RouterABI,
        functionName: "swapExactTokensForTokens",
        args: [
          amountIn,
          amountOutMin,
          [fromTokenInfo.address, toTokenInfo.address],
          userAddress, // User receives tokens
          deadline,
        ],
      }),
    });

    console.log("🔨 Built swap calls:", {
      approve: {
        token: fromTokenInfo.symbol,
        spender: "Uniswap Router",
        amount: "50 (max)",
      },
      swap: {
        amountIn: amount,
        fromToken: fromTokenInfo.symbol,
        toToken: toTokenInfo.symbol,
        recipient: userAddress,
        slippage: `${slippagePercent}%`,
      },
    });

    return calls;
  }

  /**
   * Get available tokens
   */
  getTokens() {
    return TOKENS;
  }

  /**
   * Get service info
   */
  getInfo() {
    return {
      tokens: Object.keys(TOKENS),
      router: UNISWAP_ROUTER,
      transactionService: backendTransactionService.getInfo(),
    };
  }
}

// Export singleton instance
export const backendSwapService = new BackendSwapService();