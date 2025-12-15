import { Address, keccak256, toHex } from "viem";

export type TokenInfo = {
  address: Address;
  decimals: number;
  symbol: string;
  name: string;
  notes?: string;
};

export type FunctionInfo = {
  signature: string;
  params: string[];
  returns?: string[];
  notes: string;
  stateMutability?: "view" | "pure" | "nonpayable" | "payable";
};

export type ContractInfo = {
  address: Address;
  functions: Record<string, FunctionInfo>;
};

export type ProtocolInfo = Record<string, ContractInfo>;

export const CONTRACT_REGISTRY = {
  tokens: {
    MockUSD: {
      address: "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50" as Address,
      decimals: 18,
      symbol: "MockUSD",
      name: "Mock USD",
      notes: "Test stablecoin for development"
    },
    MockToken: {
      address: "0x6166a6e02b4CF0e1E0397082De1B4fc9CC9D6ceD" as Address,
      decimals: 18,
      symbol: "MockToken",
      name: "Mock Token",
      notes: "Test utility token"
    }
  } as const,
  
  protocols: {
    uniswap: {
      router: {
        address: "0x6c10B45251F5D3e650bcfA9606c662E695Af97ea" as Address,
        functions: {
          swapExactTokensForTokens: {
            signature: "0x38ed1739", // keccak256("swapExactTokensForTokens(uint256,uint256,address[],address,uint256)")
            params: ["amountIn", "amountOutMin", "path[]", "to", "deadline"],
            returns: ["amounts[]"],
            notes: "Swap exact input amount for minimum output amount through token path",
            stateMutability: "nonpayable"
          },
          addLiquidity: {
            signature: "0xe8e33700", // keccak256("addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)")
            params: ["tokenA", "tokenB", "amountADesired", "amountBDesired", "amountAMin", "amountBMin", "to", "deadline"],
            returns: ["amountA", "amountB", "liquidity"],
            notes: "Add liquidity to token pair, creating pool if it doesn't exist",
            stateMutability: "nonpayable"
          },
          removeLiquidity: {
            signature: "0xbaa2abde", // keccak256("removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)")
            params: ["tokenA", "tokenB", "liquidity", "amountAMin", "amountBMin", "to", "deadline"],
            returns: ["amountA", "amountB"],
            notes: "Remove liquidity from token pair",
            stateMutability: "nonpayable"
          }
        }
      },
      factory: {
        address: "0xf6A86076ce8e9A2ff628CD3a728FcC5876FA70C6" as Address,
        functions: {
          getPair: {
            signature: "0xe6a43905", // keccak256("getPair(address,address)")
            params: ["tokenA", "tokenB"],
            returns: ["pair"],
            notes: "Get pair contract address for two tokens",
            stateMutability: "view"
          },
          createPair: {
            signature: "0xc9c65396", // keccak256("createPair(address,address)")
            params: ["tokenA", "tokenB"],
            returns: ["pair"],
            notes: "Create a new pair for two tokens",
            stateMutability: "nonpayable"
          }
        }
      }
    }
  } as const,
  
  // Helper functions for LLM and other tools
  getTokenBySymbol(symbol: string): TokenInfo | undefined {
    return Object.values(this.tokens).find(t => t.symbol === symbol);
  },
  
  getTokenByAddress(address: Address): TokenInfo | undefined {
    return Object.values(this.tokens).find(t => t.address.toLowerCase() === address.toLowerCase());
  },
  
  // Get all available functions across all protocols
  getAvailableFunctions(): Array<{
    protocol: string;
    contract: string;
    function: string;
    address: Address;
    signature: string;
    params: string[];
    returns?: string[];
    notes: string;
    stateMutability?: string;
  }> {
    const functions: Array<any> = [];
    
    for (const [protocolName, protocol] of Object.entries(this.protocols)) {
      for (const [contractName, contract] of Object.entries(protocol)) {
        for (const [funcName, func] of Object.entries(contract.functions)) {
          functions.push({
            protocol: protocolName,
            contract: contractName,
            function: funcName,
            address: contract.address,
            ...func
          });
        }
      }
    }
    
    return functions;
  },
  
  // Get function signature for a specific contract function
  getFunctionSignature(protocolName: string, contractName: string, functionName: string): string | undefined {
    const protocol = this.protocols[protocolName as keyof typeof this.protocols] as any;
    if (!protocol) return undefined;
    const contract = protocol[contractName];
    if (!contract || !('functions' in contract)) return undefined;
    const func = contract.functions[functionName];
    return func?.signature;
  },
  
  // Helper to generate common ERC20 function signatures
  erc20Functions: {
    transfer: keccak256(toHex("transfer(address,uint256)")).slice(0, 10),
    approve: keccak256(toHex("approve(address,uint256)")).slice(0, 10),
    transferFrom: keccak256(toHex("transferFrom(address,address,uint256)")).slice(0, 10),
    balanceOf: keccak256(toHex("balanceOf(address)")).slice(0, 10),
    totalSupply: keccak256(toHex("totalSupply()")).slice(0, 10),
    allowance: keccak256(toHex("allowance(address,address)")).slice(0, 10),
    // Custom functions for our mock tokens
    mintOnce: keccak256(toHex("mintOnce()")).slice(0, 10)
  }
};

// Type exports for use in other modules
export type TokenSymbol = keyof typeof CONTRACT_REGISTRY.tokens;
export type Protocol = keyof typeof CONTRACT_REGISTRY.protocols;