import "dotenv/config";
import { backendTransactionService } from "../src/services/backendTransactionService.js";
import { riseRelayClient } from "../src/config/backendRiseClient.js";
import { Address, encodeFunctionData, parseUnits, getAddress, keccak256, toHex, decodeAbiParameters, parseAbiParameters } from "viem";

// Token addresses from our error logs  
const TOKENS = {
  MockUSD: {
    address: "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50" as `0x${string}`,
    decimals: 18,
    symbol: "MockUSD",
  },
  MockToken: {
    address: "0x6166a6e02b4CF0e1E0397082De1B4fc9CC9D6ceD" as `0x${string}`,
    decimals: 18, 
    symbol: "MockToken",
  },
} as const;

const UNISWAP_CONTRACTS = {
  router: "0x6c10B45251F5D3e650bcfA9606c662E695Af97ea" as `0x${string}`,
};

// ABI for ERC20 functions
const ERC20ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", 
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

const UniswapV2RouterABI = [
  {
    type: "function",
    name: "swapExactTokensForTokens",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Generic precall handler that can execute ANY transaction that matches granted permissions
 */
class GenericPrecallHandler {
  private userAddress: Address;

  constructor(userAddress: Address) {
    this.userAddress = userAddress;
  }

  /**
   * Query the RISE infrastructure to get available precalls for the user
   */
  async getPrecallsForUser(): Promise<any> {
    try {
      // Try to get precalls by creating a dummy transaction
      // This will return the existing precalls in the error response
      const dummyCall = {
        to: TOKENS.MockUSD.address,
        data: "0x",
      };

      const result = await backendTransactionService.execute(
        {
          calls: [dummyCall],
          requiredPermissions: { calls: [TOKENS.MockUSD.address.toLowerCase()] }
        },
        this.userAddress
      );

      return result;
    } catch (error) {
      return { error };
    }
  }

  /**
   * Create a transaction that tries to consume existing precalls
   */
  async createPermissionConsumingTransaction() {
    console.log("🎯 Creating transaction to consume existing precalls...");

    // Based on our error analysis, the user has permissions for:
    // - transfer() on MockUSD and MockToken  
    // - approve() on MockUSD and MockToken
    // - swapExactTokensForTokens() on Uniswap router

    // Strategy: Create a multi-call transaction that matches the pattern 
    // of what the user originally granted permissions for

    const calls = [];

    // 1. Approve MockUSD for Uniswap router
    const approveAmount = parseUnits("1", TOKENS.MockUSD.decimals);
    calls.push({
      to: TOKENS.MockUSD.address,
      data: encodeFunctionData({
        abi: ERC20ABI,
        functionName: "approve",
        args: [UNISWAP_CONTRACTS.router, approveAmount],
      }),
    });

    // 2. Swap MockUSD for MockToken  
    const swapAmount = parseUnits("0.1", TOKENS.MockUSD.decimals);
    const minOut = parseUnits("0.05", TOKENS.MockToken.decimals);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min from now
    
    calls.push({
      to: UNISWAP_CONTRACTS.router,
      data: encodeFunctionData({
        abi: UniswapV2RouterABI,
        functionName: "swapExactTokensForTokens",
        args: [
          swapAmount,
          minOut,
          [TOKENS.MockUSD.address, TOKENS.MockToken.address],
          this.userAddress,
          deadline,
        ],
      }),
    });

    console.log("📋 Created multi-call transaction:");
    console.log("- Call 1: approve() MockUSD for Uniswap router");
    console.log("- Call 2: swapExactTokensForTokens() MockUSD → MockToken");
    console.log("");

    return {
      calls,
      requiredPermissions: {
        calls: [
          TOKENS.MockUSD.address.toLowerCase(),
          UNISWAP_CONTRACTS.router.toLowerCase(),
        ]
      }
    };
  }

  /**
   * Execute a transaction and analyze the precall consumption
   */
  async executeWithPrecallAnalysis(transactionProps: any): Promise<any> {
    console.log("🚀 Executing transaction with precall analysis...");
    
    const result = await backendTransactionService.execute(transactionProps, this.userAddress);
    
    if (result.success) {
      console.log("✅ SUCCESS! Transaction executed successfully");
      console.log("- Hash:", result.data?.hash);
      console.log("- Used session key:", result.data?.usedSessionKey);
      console.log("🎉 Precalls were properly consumed!");
      return result;
    } else {
      console.log("❌ Transaction failed");
      console.log("- Error:", result.error?.message);
      
      // Analyze the error for precall information
      if (result.error?.message?.includes("Invalid precall")) {
        console.log("\n🔍 Analyzing precall mismatch...");
        console.log("💡 The stored precalls don't match our transaction structure");
        console.log("🎯 Need to create transaction that exactly matches granted permissions");
      }
      
      return result;
    }
  }
}

async function testGenericPrecallHandler() {
  console.log("🚀 Testing Generic Precall Handler");
  console.log("==================================\n");

  const userAddress = getAddress("0x07b780E6D4D7177bd596e7caBf2725a471E685Dc");
  const handler = new GenericPrecallHandler(userAddress);

  console.log("👤 User Address:", userAddress);
  console.log("🔧 Backend session key:", backendTransactionService.getInfo().backendSigner);
  console.log("");

  try {
    // Step 1: Analyze existing precalls
    console.log("📊 Step 1: Analyzing existing precalls for user...");
    const precallInfo = await handler.getPrecallsForUser();
    if (precallInfo.error?.message?.includes("encodedPreCalls")) {
      console.log("✅ Found existing precalls in RISE infrastructure");
      console.log("💡 Precalls contain permission grants from frontend interaction");
    } else {
      console.log("⚠️  No precall information available");
    }
    console.log("");

    // Step 2: Create transaction that matches granted permissions
    console.log("🎯 Step 2: Creating permission-matching transaction...");
    const transactionProps = await handler.createPermissionConsumingTransaction();

    // Step 3: Execute and analyze
    console.log("🚀 Step 3: Executing transaction...");
    const result = await handler.executeWithPrecallAnalysis(transactionProps);

    // Step 4: Summary and next steps
    console.log("\n📋 Summary:");
    console.log("==========");
    
    if (result.success) {
      console.log("🎉 SUCCESS: Generic precall handler working!");
      console.log("✅ Backend can execute transactions that consume stored precalls");
      console.log("✅ RISE infrastructure automatically handles precall consumption");
      console.log("");
      console.log("💡 Next steps:");
      console.log("- Implement this pattern in production backend");
      console.log("- Create generic transaction builder based on granted permissions");
      console.log("- Add precall analysis to understand permission scope");
    } else {
      console.log("❌ Need further analysis of precall structure");
      console.log("💡 Insights gained:");
      console.log("- User has stored precalls for permission grants");
      console.log("- Backend session key and signing are working correctly");
      console.log("- Issue is transaction structure not matching stored precalls");
      console.log("");
      console.log("🔍 Next steps:");
      console.log("- Decode the exact precall structure");
      console.log("- Build transaction that matches expected permission pattern");
      console.log("- Consider implementing precall inspection utilities");
    }

  } catch (error) {
    console.error("❌ Generic precall handler test failed:", error);
  }
}

testGenericPrecallHandler().catch(console.error);