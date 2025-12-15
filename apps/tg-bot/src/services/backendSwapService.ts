import { Address, encodeFunctionData, parseUnits, getContract } from "viem";
import { backendTransactionService } from "./backendTransactionService.js";
import { MintableERC20ABI } from "../abi/erc20.js";
import { UniswapV2RouterABI } from "../abi/swap.js";
import { risePublicClient } from "../config/backendRiseClient.js";
import { TOKENS } from "../types/index.js";
import type { TransactionCall, SwapParams, SwapResult } from "../types/index.js";
export { TOKENS };

// Uniswap contracts
const UNISWAP_ROUTER = "0x6c10B45251F5D3e650bcfA9606c662E695Af97ea" as Address;

/**
 * Backend Swap Service
 * 
 * Uses backendTransactionService for execution.
 */
class BackendSwapService {

  /**
   * Execute swap (matching wallet-demo's useSwap pattern)
   */
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const { fromToken, toToken, amount, userAddress, slippagePercent = 0.5 } = params;

    console.log(`Executing swap`);
    console.log(`   ${amount} ${fromToken} → ${toToken}`);
    console.log(`   User: ${userAddress}`);
    console.log(`   Slippage: ${slippagePercent}%`)

    try {
      // Check liquidity and get expected output before attempting swap
      const fromTokenInfo = TOKENS[fromToken];
      const toTokenInfo = TOKENS[toToken];
      const amountIn = parseUnits(amount, fromTokenInfo.decimals);

      console.log(`Checking pool liquidity for ${fromToken}/${toToken}...`);

      let expectedOut: bigint | undefined;

      try {
        const routerContract = getContract({
          address: UNISWAP_ROUTER,
          abi: UniswapV2RouterABI,
          client: risePublicClient,
        });

        const amountsOut = await routerContract.read.getAmountsOut([
          amountIn,
          [fromTokenInfo.address, toTokenInfo.address]
        ]);

        expectedOut = amountsOut[1];

        console.log(`Pool liquidity check:`, {
          amountIn: amount + " " + fromToken,
          amountInWei: amountIn.toString(),
          expectedOut: expectedOut.toString(),
          expectedOutFormatted: (Number(expectedOut) / 1e18).toFixed(4) + " " + toToken,
          hasLiquidity: expectedOut > 0n
        });

        if (expectedOut === 0n) {
          return {
            success: false,
            data: null,
            error: `No liquidity in ${fromToken}/${toToken} pool! Expected output is 0. Please add liquidity to the pool first.`,
            errorType: "unknown"
          };
        }
      } catch (liquidityError) {
        console.error(`Liquidity check failed:`, liquidityError);
        return {
          success: false,
          data: null,
          error: `Could not verify pool liquidity: ${liquidityError instanceof Error ? liquidityError.message : String(liquidityError)}`,
          errorType: "unknown"
        };
      }

      // Build transaction calls with actual expected output (if available)
      const calls = this.buildSwapCalls({ ...params, expectedOut });
      console.log(`Built ${calls.length} transaction calls`);

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
    const { fromToken, toToken, amount, userAddress, slippagePercent = 0.5, expectedOut } = params;

    const fromTokenInfo = TOKENS[fromToken];
    const toTokenInfo = TOKENS[toToken];

    const amountIn = parseUnits(amount, fromTokenInfo.decimals);

    // Calculate amountOutMin from actual AMM quote (not from input amount)
    // This ensures slippage protection is based on expected output, not input
    let amountOutMin: bigint;
    if (expectedOut && expectedOut > 0n) {
      // Use actual pool quote with slippage protection
      amountOutMin = (expectedOut * BigInt(Math.floor((100 - slippagePercent) * 100))) / 10000n;
      console.log(`Using actual pool quote for slippage:`, {
        expectedOut: expectedOut.toString(),
        slippage: `${slippagePercent}%`,
        amountOutMin: amountOutMin.toString(),
        formatted: `${(Number(amountOutMin) / 1e18).toFixed(4)} ${toToken}`
      });
    } else {
      // No pool quote available - fail safe rather than proceed with no protection
      throw new Error("Could not verify pool liquidity. Swap aborted for safety.");
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

    const calls: TransactionCall[] = [];

    // 1. Approve call (approve max amount for convenience)
    const maxAmount = parseUnits("50", fromTokenInfo.decimals); 
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