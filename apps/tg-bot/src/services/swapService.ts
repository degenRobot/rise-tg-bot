import { Address, encodeFunctionData, parseUnits } from "viem";
import { transactionService, TransactionCall } from "./transactionService.js";
import { MintableERC20ABI } from "../abi/erc20.js";
import { UniswapV2RouterABI } from "../abi/swap.js";

// Token configuration (matching wallet-demo pattern)
export type TokenConfig = {
  address: Address;
  decimals: number;
  symbol: string;
  name: string;
};

// RISE testnet token contracts
export const TOKENS: Record<string, TokenConfig> = {
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
};

// Uniswap contracts (matching current setup)
export const UNISWAP_CONTRACTS = {
  factory: (process.env.UNISWAP_FACTORY_ADDRESS || "0xf6A86076ce8e97349551C876a01a7580B1338909") as Address,
  router: (process.env.UNISWAP_ROUTER_ADDRESS || "0x6c10B45251F5D3e650bcfA9606c662E695Af97ea") as Address,
  pair: (process.env.UNISWAP_PAIR_ADDRESS || "0xf8da515e51e5B1293c2430d406aE41E6e5B9C992") as Address,
};

// Swap parameters (matching wallet-demo exactly)
export type SwapProps = {
  amountIn: bigint;
  amountOutMin: bigint;
  toAddress: Address;
  deadline: bigint;
  accountAddress: Address; // User's address (not the backend signer)
  from: TokenConfig;
  shouldApprove?: boolean;
};

export type ApproveSwapProps = {
  from: TokenConfig;
};

/**
 * Swap service that mimics wallet-demo's useSwap hook
 * Builds transaction calls and executes them via transaction service
 */
class SwapService {
  
  /**
   * Approve tokens for spending (equivalent to useSwap.onApprove)
   */
  async onApprove(props: ApproveSwapProps) {
    const { from } = props;
    
    console.log(`📝 Approving ${from.symbol} for spending...`);

    // Match wallet-demo spending limit of 50 tokens
    const maxAmount = parseUnits("50", from.decimals);

    const calls: TransactionCall[] = [];

    calls.push({
      to: from.address,
      data: encodeFunctionData({
        abi: MintableERC20ABI,
        functionName: "approve",
        args: [UNISWAP_CONTRACTS.router, maxAmount],
      }),
    });

    const response = await transactionService.execute({
      calls,
      requiredPermissions: {
        calls: [from.address.toLowerCase()],
      },
    });

    console.log("approve-service-response:: ", response);
    return response;
  }

  /**
   * Execute swap (equivalent to useSwap.onSwap)
   * Follows the exact pattern from wallet-demo
   */
  async onSwap(props: SwapProps) {
    const {
      accountAddress,
      amountIn,
      amountOutMin,
      from,
      toAddress,
      deadline,
      shouldApprove,
    } = props;

    console.log(`🔄 Executing swap: ${amountIn} ${from.symbol} → ${TOKENS[toAddress === TOKENS.MockUSD.address ? 'MockUSD' : 'MockToken'].symbol}`);
    console.log(`📊 Swap details:`, {
      amountIn: amountIn.toString(),
      amountOutMin: amountOutMin.toString(),
      from: from.symbol,
      toAddress,
      accountAddress,
      deadline: deadline.toString(),
      shouldApprove
    });

    const calls: TransactionCall[] = [];

    // Match wallet-demo spending limit of 50 tokens
    const maxAmount = parseUnits("50", from.decimals);

    // Add approval call if needed (matching wallet-demo pattern)
    if (shouldApprove) {
      calls.push({
        to: from.address,
        data: encodeFunctionData({
          abi: MintableERC20ABI,
          functionName: "approve",
          args: [UNISWAP_CONTRACTS.router, maxAmount],
        }),
      });
    }

    // Add swap call (matching wallet-demo exactly)
    calls.push({
      to: UNISWAP_CONTRACTS.router,
      data: encodeFunctionData({
        abi: UniswapV2RouterABI,
        functionName: "swapExactTokensForTokens",
        args: [
          amountIn,
          amountOutMin,
          [from.address, toAddress],
          accountAddress, // User receives the tokens, not backend signer
          deadline,
        ],
      }),
    });

    // Execute via transaction service (matches wallet-demo pattern)
    const response = await transactionService.execute({
      calls,
      requiredPermissions: {
        calls: [UNISWAP_CONTRACTS.router.toLowerCase()],
      },
    });

    console.log("swap-service-response:: ", response);
    return response;
  }

  /**
   * Helper function to build swap parameters from simple inputs
   */
  buildSwapParams(args: {
    fromToken: keyof typeof TOKENS;
    toToken: keyof typeof TOKENS;
    amount: string;
    userAddress: Address;
    slippagePercent?: number;
  }): SwapProps {
    const { fromToken, toToken, amount, userAddress, slippagePercent = 0.5 } = args;
    
    const fromTokenInfo = TOKENS[fromToken];
    const toTokenInfo = TOKENS[toToken];
    
    if (!fromTokenInfo || !toTokenInfo) {
      throw new Error("Invalid token symbols");
    }
    
    if (fromToken === toToken) {
      throw new Error("Cannot swap token to itself");
    }

    const amountIn = parseUnits(amount, fromTokenInfo.decimals);
    const amountOutMin = (amountIn * BigInt(Math.floor((100 - slippagePercent) * 100))) / 10000n;
    
    // Set deadline to 20 minutes from now (matching wallet-demo)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    return {
      amountIn,
      amountOutMin,
      toAddress: toTokenInfo.address,
      deadline,
      accountAddress: userAddress,
      from: fromTokenInfo,
      shouldApprove: true // Always approve for simplicity
    };
  }

  /**
   * Get token configuration
   */
  getTokenConfig(symbol: string): TokenConfig | undefined {
    return TOKENS[symbol];
  }

  /**
   * Get all available tokens
   */
  getAvailableTokens(): TokenConfig[] {
    return Object.values(TOKENS);
  }
}

// Export singleton instance (matches wallet-demo hook pattern)
export const swapService = new SwapService();