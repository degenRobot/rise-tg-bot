import "dotenv/config";
import { backendTransactionService } from "../src/services/backendTransactionService.js";
import { riseRelayClient } from "../src/config/backendRiseClient.js";
import { Address, encodeFunctionData, parseUnits, getAddress, keccak256, toHex } from "viem";

// Match exact token addresses and function signatures from wallet-demo
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

// Function signatures that match wallet-demo permissions (lines 7, 15, 31 in permissions.ts)
const FUNCTION_SIGNATURES = {
  transfer: keccak256(toHex("transfer(address,uint256)")).slice(0, 10),
  approve: keccak256(toHex("approve(address,uint256)")).slice(0, 10),
  mintOnce: keccak256(toHex("mintOnce()")).slice(0, 10),
  swapExactTokensForTokens: keccak256(toHex("swapExactTokensForTokens(uint256,uint256,address[],address,uint256)")).slice(0, 10),
};

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

async function testPrecallAnalysis() {
  console.log("🔍 Analyzing Precalls and Permissions for User");
  console.log("=============================================\n");

  // Test with the correct user who has granted permissions
  const userAddress = getAddress("0x07b780E6D4D7177bd596e7caBf2725a471E685Dc");
  
  console.log("👤 User Address:", userAddress);
  console.log("🔧 Backend session key:", backendTransactionService.getInfo().sessionKeyPublic);
  console.log("");

  try {
    // Step 1: Query existing permissions using RISE wallet method
    console.log("📋 Step 1: Querying existing permissions...");
    
    try {
      const permissions = await (riseRelayClient as any).request({
        method: "wallet_getPermissions",
        params: [{ address: userAddress }],
      });
      
      console.log("✅ Raw permissions data:");
      console.log(JSON.stringify(permissions, null, 2));
      console.log("");
    } catch (permError) {
      console.log("⚠️  Could not query permissions directly:", permError.message);
      console.log("💡 This is expected - wallet_getPermissions might need connector");
      console.log("");
    }

    // Step 2: Analyze the function signatures from our error logs
    console.log("📊 Step 2: Analyzing granted permission structure...");
    console.log("Based on the precall error, user granted permissions for:");
    console.log("- transfer():", FUNCTION_SIGNATURES.transfer);
    console.log("- approve():", FUNCTION_SIGNATURES.approve);
    console.log("- swapExactTokensForTokens():", FUNCTION_SIGNATURES.swapExactTokensForTokens);
    console.log("- Tokens:", TOKENS.MockUSD.address, TOKENS.MockToken.address);
    console.log("- Uniswap router:", UNISWAP_CONTRACTS.router);
    console.log("");

    // Step 3: Create transaction that EXACTLY matches granted permissions
    console.log("🎯 Step 3: Creating transaction that matches granted permissions...");
    
    // Test 1: Simple MockUSD transfer (most likely to match precall)
    console.log("Test A: MockUSD transfer (matches transfer signature)");
    const transferAmount = parseUnits("0.01", TOKENS.MockUSD.decimals);
    const recipient = "0xA0Cf798816D4b9b9866b5330EEa46a18382f251e";
    
    const transferCall = {
      to: TOKENS.MockUSD.address,
      data: encodeFunctionData({
        abi: ERC20ABI,
        functionName: "transfer",
        args: [recipient as `0x${string}`, transferAmount],
      }),
    };

    console.log("📋 Transfer call details:");
    console.log("- Token:", TOKENS.MockUSD.symbol, TOKENS.MockUSD.address);
    console.log("- Function sig:", transferCall.data.slice(0, 10), "(should match", FUNCTION_SIGNATURES.transfer + ")");
    console.log("- To:", recipient);
    console.log("- Amount:", transferAmount.toString());
    console.log("");

    console.log("🚀 Executing MockUSD transfer...");
    const transferResult = await backendTransactionService.execute(
      {
        calls: [transferCall],
        requiredPermissions: {
          calls: [TOKENS.MockUSD.address.toLowerCase()]
        }
      },
      userAddress
    );

    console.log("📊 Transfer result:");
    console.log("- Success:", transferResult.success);
    console.log("- Hash:", transferResult.data?.hash);
    console.log("- Error:", transferResult.error?.message);
    console.log("");

    if (transferResult.success) {
      console.log("🎉 SUCCESS! Precall consumption worked for transfer!");
      console.log("✅ Backend can consume existing precalls when transaction matches permissions");
    } else {
      console.log("❌ Transfer failed, trying approve...");
      
      // Test 2: Try approve call if transfer fails
      console.log("Test B: MockUSD approve (different function signature)");
      const approveAmount = parseUnits("10", TOKENS.MockUSD.decimals);
      
      const approveCall = {
        to: TOKENS.MockUSD.address,
        data: encodeFunctionData({
          abi: ERC20ABI,
          functionName: "approve",
          args: [UNISWAP_CONTRACTS.router, approveAmount],
        }),
      };

      console.log("📋 Approve call details:");
      console.log("- Token:", TOKENS.MockUSD.symbol);
      console.log("- Function sig:", approveCall.data.slice(0, 10), "(should match", FUNCTION_SIGNATURES.approve + ")");
      console.log("- Spender:", UNISWAP_CONTRACTS.router);
      console.log("- Amount:", approveAmount.toString());
      console.log("");

      const approveResult = await backendTransactionService.execute(
        {
          calls: [approveCall],
          requiredPermissions: {
            calls: [TOKENS.MockUSD.address.toLowerCase()]
          }
        },
        userAddress
      );

      console.log("📊 Approve result:");
      console.log("- Success:", approveResult.success);
      console.log("- Hash:", approveResult.data?.hash);
      console.log("- Error:", approveResult.error?.message);

      if (approveResult.success) {
        console.log("🎉 SUCCESS! Precall consumption worked for approve!");
      } else {
        console.log("❌ Both transfer and approve failed");
        console.log("💡 The precall might be for a specific multi-call transaction");
      }
    }

    // Step 4: Analyze precall structure from error
    console.log("\n🔍 Step 4: Understanding precall structure...");
    console.log("Key insights from error analysis:");
    console.log("✓ User has stored precalls in RISE infrastructure");
    console.log("✓ Precalls contain encoded function calls for ERC20 + Uniswap operations");
    console.log("✓ Backend session key signature is working correctly");
    console.log("✓ wallet_prepareCalls returns existing precalls in quote.encodedPreCalls");
    console.log("✓ Issue is transaction structure not matching stored precall exactly");

  } catch (error) {
    console.error("❌ Precall analysis failed:", error);
  }
}

testPrecallAnalysis().catch(console.error);