import "dotenv/config";
import { backendTransactionService } from "../src/services/backendTransactionService.js";
import { Address, encodeFunctionData, parseUnits, getAddress, decodeAbiParameters, parseAbiParameters, keccak256, toHex } from "viem";

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

// Delegation contract ABI for precalls
const DelegationABI = [
  {
    type: "function",
    name: "authorize",
    inputs: [
      { name: "key", type: "bytes32" },
      { name: "keyData", type: "tuple", components: [
        { name: "pubKeyX", type: "uint256" },
        { name: "pubKeyY", type: "uint256" },
        { name: "keyType", type: "uint8" },
        { name: "scheme", type: "uint8" }
      ]},
      { name: "expiry", type: "uint64" }
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setCanExecute",
    inputs: [
      { name: "key", type: "bytes32" },
      { name: "target", type: "address" },
      { name: "selector", type: "bytes4" },
      { name: "canExecute", type: "bool" }
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setSpendLimit",
    inputs: [
      { name: "key", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "limit", type: "uint256" },
      { name: "period", type: "uint64" }
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Precall Decoder to understand stored permissions
 */
class PrecallDecoder {
  private userAddress: Address;

  constructor(userAddress: Address) {
    this.userAddress = userAddress;
  }

  /**
   * Trigger an error to capture encodedPreCalls data
   */
  async captureEncodedPrecalls(): Promise<string[] | null> {
    try {
      const dummyCall = {
        to: TOKENS.MockUSD.address,
        data: "0x",
      };

      await backendTransactionService.execute(
        {
          calls: [dummyCall],
          requiredPermissions: { calls: [TOKENS.MockUSD.address.toLowerCase()] }
        },
        this.userAddress
      );
      
      return null;
    } catch (error: any) {
      console.log("🔍 Searching for encodedPreCalls in error...");
      
      // Extract encodedPreCalls from error message - more robust parsing
      const errorStr = error.message || error.toString();
      
      // Look for the encodedPreCalls array pattern
      const preCallsMatch = errorStr.match(/"encodedPreCalls":\s*(\[.*?\])/s);
      if (preCallsMatch) {
        try {
          // Parse the JSON array
          const encodedPreCalls = JSON.parse(preCallsMatch[1]);
          console.log(`✅ Found ${encodedPreCalls.length} encodedPreCalls`);
          
          // Log first few characters of each for verification
          encodedPreCalls.forEach((call: string, i: number) => {
            console.log(`   ${i + 1}: ${call.substring(0, 20)}...`);
          });
          
          return encodedPreCalls;
        } catch (parseError) {
          console.log("❌ Failed to parse encodedPreCalls JSON:", parseError);
          console.log("Raw match:", preCallsMatch[1].substring(0, 200));
        }
      } else {
        console.log("❌ No encodedPreCalls pattern found");
        // Try a simpler approach - look for hex strings that look like precalls
        const hexMatches = errorStr.match(/0x[0-9a-fA-F]{100,}/g);
        if (hexMatches && hexMatches.length > 0) {
          console.log(`🔍 Found ${hexMatches.length} potential precall hex strings`);
          return hexMatches;
        }
      }
      
      return null;
    }
  }

  /**
   * Decode a single precall hex data - these are complex bundled transactions
   */
  decodePrecallData(callData: string, index: number) {
    console.log(`\n🔍 Decoding precall ${index + 1}: ${callData.substring(0, 50)}...`);
    console.log(`   Full length: ${callData.length} characters`);
    
    if (!callData.startsWith('0x') || callData.length < 10) {
      console.log("❌ Invalid calldata format");
      return null;
    }

    try {
      // These appear to be complex ABI-encoded structures
      // Let's try to decode as a bundle transaction structure
      console.log("🧩 Attempting to decode as bundle transaction...");
      
      // First, try to decode the outer structure
      // Based on the data, this looks like it contains multiple nested elements
      
      // Let's try to parse the initial structure
      const outerDecoded = decodeAbiParameters(
        parseAbiParameters("bytes32, address, uint256, uint256"),
        callData as `0x${string}`
      );
      
      console.log("📊 Outer structure attempt:", {
        param1: outerDecoded[0],
        param2: outerDecoded[1], 
        param3: outerDecoded[2],
        param4: outerDecoded[3]
      });
      
      return { type: "bundle", data: outerDecoded, raw: callData };
      
    } catch (outerError) {
      console.log("❌ Outer structure decode failed, trying nested approach...");
      
      try {
        // Try to decode as a more complex nested structure
        // Looking at the error output, these seem to contain authorization data
        const nestedDecoded = decodeAbiParameters(
          parseAbiParameters("bytes32, address, bytes, uint256, bytes"),
          callData as `0x${string}`
        );
        
        console.log("📊 Nested structure:", {
          hash: nestedDecoded[0],
          address: nestedDecoded[1],
          dataLength: nestedDecoded[2].length,
          number: nestedDecoded[3],
          moreDataLength: nestedDecoded[4].length
        });
        
        return { type: "nested", data: nestedDecoded, raw: callData };
        
      } catch (nestedError) {
        console.log("❌ Nested decode failed, analyzing raw structure...");
        
        // Extract some key information from the hex
        const info = {
          length: callData.length,
          startsWithZeros: callData.slice(0, 20),
          containsAddress: this.extractAddressesFromHex(callData),
          selectors: this.extractSelectorsFromHex(callData)
        };
        
        console.log("📊 Raw analysis:", info);
        
        return { type: "complex", info, raw: callData };
      }
    }
  }

  /**
   * Extract potential addresses from hex data
   */
  extractAddressesFromHex(hex: string): string[] {
    const addresses = [];
    // Look for 20-byte sequences that might be addresses
    const addressPattern = /000000000000000000000000([a-fA-F0-9]{40})/g;
    let match;
    while ((match = addressPattern.exec(hex)) !== null) {
      addresses.push(`0x${match[1]}`);
    }
    return addresses;
  }

  /**
   * Extract potential function selectors from hex data
   */
  extractSelectorsFromHex(hex: string): string[] {
    const selectors = [];
    // Look for 4-byte function selectors
    const selectorPattern = /([a-fA-F0-9]{8})000000000000000000000000/g;
    let match;
    while ((match = selectorPattern.exec(hex)) !== null) {
      selectors.push(`0x${match[1]}`);
    }
    return selectors;
  }

  /**
   * Analyze all precalls to understand permission structure
   */
  async analyzeStoredPrecalls() {
    console.log("🚀 Starting Precall Analysis");
    console.log("============================\n");

    console.log("👤 User Address:", this.userAddress);
    console.log("🔧 Backend session key:", backendTransactionService.getInfo().backendSigner);
    console.log("");

    // Step 1: Capture encodedPreCalls
    console.log("📊 Step 1: Capturing stored precalls...");
    const encodedPreCalls = await this.captureEncodedPrecalls();
    
    if (!encodedPreCalls || encodedPreCalls.length === 0) {
      console.log("❌ No precalls found to decode");
      return;
    }
    
    console.log(`✅ Found ${encodedPreCalls.length} precalls to decode\n`);

    // Step 2: Decode each precall
    console.log("🔍 Step 2: Decoding precall structure...");
    const decodedPrecalls = [];
    
    for (let i = 0; i < encodedPreCalls.length; i++) {
      console.log(`\n--- Precall ${i + 1}/${encodedPreCalls.length} ---`);
      const decoded = this.decodePrecallData(encodedPreCalls[i], i);
      if (decoded) {
        decodedPrecalls.push(decoded);
      }
    }

    // Step 3: Summary
    console.log("\n📋 Precall Analysis Summary");
    console.log("============================");
    console.log(`Total precalls: ${encodedPreCalls.length}`);
    console.log(`Successfully decoded: ${decodedPrecalls.length}`);
    
    const typeCount = decodedPrecalls.reduce((acc: any, precall) => {
      acc[precall.type] = (acc[precall.type] || 0) + 1;
      return acc;
    }, {});
    
    console.log("Precall types found:", typeCount);
    
    // Step 4: Recommendations
    console.log("\n💡 Next Steps:");
    if (decodedPrecalls.some(p => p.type === "authorize")) {
      console.log("✅ Found key authorization - session key is properly granted");
    }
    if (decodedPrecalls.some(p => p.type === "setCanExecute")) {
      console.log("✅ Found permission grants - specific functions are authorized");
    }
    if (decodedPrecalls.some(p => p.type === "setSpendLimit")) {
      console.log("✅ Found spend limits - token spending is controlled");
    }
    if (decodedPrecalls.some(p => p.type === "transfer" || p.type === "approve")) {
      console.log("🎯 Found transaction calls - these should be replicated exactly");
    }
    
    console.log("\n🚀 To consume precalls successfully:");
    console.log("1. Match the exact transaction structure found in precalls");
    console.log("2. Use the same amounts, addresses, and function calls");
    console.log("3. Ensure session key has proper permissions for all calls");
    
    return decodedPrecalls;
  }
}

async function testPrecallDecoding() {
  const userAddress = getAddress("0x07b780E6D4D7177bd596e7caBf2725a471E685Dc");
  const decoder = new PrecallDecoder(userAddress);
  
  const results = await decoder.analyzeStoredPrecalls();
  
  if (results && results.length > 0) {
    console.log("\n🎉 Successfully decoded precall structure!");
    console.log("Now we understand exactly what permissions were granted.");
  }
}

testPrecallDecoding().catch(console.error);