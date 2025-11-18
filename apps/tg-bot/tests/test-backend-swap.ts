import "dotenv/config";
import { backendTransactionService } from "../src/services/backendTransactionService.js";
import { Address, encodeFunctionData, parseUnits, getAddress } from "viem";

// ABIs from wallet-demo
const MintableERC20ABI = [
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
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
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

// Token configuration from wallet-demo
const TOKENS = {
  MockUSD: {
    address: "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50" as `0x${string}`,
    decimals: 18,
    symbol: "MockUSD",
    name: "Mock USD",
  },
  MockToken: {
    address: "0x6166a6e02b4CF0e1E0397082De1B4fc9CC9D6ceD" as `0x${string}`,
    decimals: 18,
    symbol: "MockToken",
    name: "Mock Token",
  },
} as const;

// UniswapV2 contract addresses from wallet-demo
const UNISWAP_CONTRACTS = {
  factory: "0xf6A86076ce8e9A2ff628CD3a728FcC5876FA70C6" as `0x${string}`,
  router: "0x6c10B45251F5D3e650bcfA9606c662E695Af97ea" as `0x${string}`,
  pair: "0xf8da515e51e5B1293c2430d406aE41E6e5B9C992" as `0x${string}`,
};

async function testBackendSwap() {
  console.log("🔄 Testing Backend Swap (Replicating wallet-demo useSwap)");
  console.log("========================================================\n");

  // Test with user who actually granted permissions
  const userAddress = getAddress("0x07b780E6D4D7177bd596e7caBf2725a471E685Dc");
  console.log("👤 User Address:", userAddress);
  console.log("🔧 Backend service info:");
  console.log(backendTransactionService.getInfo());
  console.log("");

  // Swap parameters (small swap like wallet-demo)
  const fromToken = TOKENS.MockUSD;
  const toToken = TOKENS.MockToken;
  const amountIn = parseUnits("0.1", fromToken.decimals); // 0.1 MockUSD
  const amountOutMin = parseUnits("0.05", toToken.decimals); // Min 0.05 MockToken
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes from now
  
  console.log("💱 Swap Parameters:");
  console.log("- From:", fromToken.symbol, `(${fromToken.address})`);
  console.log("- To:", toToken.symbol, `(${toToken.address})`);
  console.log("- Amount In:", amountIn.toString(), `(${fromToken.decimals} decimals)`);
  console.log("- Min Amount Out:", amountOutMin.toString(), `(${toToken.decimals} decimals)`);
  console.log("- Deadline:", deadline.toString());
  console.log("- Router:", UNISWAP_CONTRACTS.router);
  console.log("");

  try {
    // Step 1: Create approve call (like wallet-demo onSwap with shouldApprove: true)
    console.log("📝 Step 1: Creating approve call...");
    const maxAmount = parseUnits("50", fromToken.decimals); // Same as wallet-demo
    
    const approveCall = {
      to: fromToken.address,
      data: encodeFunctionData({
        abi: MintableERC20ABI,
        functionName: "approve",
        args: [UNISWAP_CONTRACTS.router, maxAmount],
      }),
    };

    console.log("✅ Approve call created:");
    console.log("- To:", approveCall.to);
    console.log("- Data:", approveCall.data);
    console.log("");

    // Step 2: Create swap call (exact same as wallet-demo)
    console.log("📝 Step 2: Creating swap call...");
    const swapCall = {
      to: UNISWAP_CONTRACTS.router,
      data: encodeFunctionData({
        abi: UniswapV2RouterABI,
        functionName: "swapExactTokensForTokens",
        args: [
          amountIn,
          amountOutMin,
          [fromToken.address, toToken.address],
          userAddress,
          deadline,
        ],
      }),
    };

    console.log("✅ Swap call created:");
    console.log("- To:", swapCall.to);
    console.log("- Data:", swapCall.data);
    console.log("");

    // Step 3: Execute both calls in a single transaction (like wallet-demo)
    console.log("🚀 Step 3: Executing approve + swap transaction...");
    const calls = [approveCall, swapCall];
    
    const transactionProps = {
      calls,
      requiredPermissions: {
        calls: [
          fromToken.address.toLowerCase(), // For approve
          UNISWAP_CONTRACTS.router.toLowerCase() // For swap
        ]
      }
    };

    console.log("📋 Transaction details:");
    console.log("- Total calls:", calls.length);
    console.log("- Required permissions:", transactionProps.requiredPermissions.calls);
    console.log("");

    const result = await backendTransactionService.execute(transactionProps, userAddress);
    
    console.log("📊 Transaction execution result:");
    console.log("- Success:", result.success);
    console.log("- Used session key:", result.data?.usedSessionKey);
    console.log("- Hash:", result.data?.hash);
    console.log("- Total transactions:", result.data?.totalTransactions);
    
    if (result.error) {
      console.log("\n❌ Error details:");
      console.log(result.error);
    } else {
      console.log("\n✅ Swap completed successfully!");
      console.log("🎉 Backend swap flow works exactly like wallet-demo!");
    }
    
  } catch (error) {
    console.error("❌ Backend swap failed:", error);
  }
}

testBackendSwap().catch(console.error);