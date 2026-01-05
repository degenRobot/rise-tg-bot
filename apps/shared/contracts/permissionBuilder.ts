import { Address, keccak256, toHex, parseEther } from "viem";
import { CONTRACT_REGISTRY, TokenInfo } from "./registry";

export type CallPermission = {
  to: Address;
  signature: string;
};

export type SpendPermission = {
  token: Address;
  limit: bigint;
  period: "minute" | "hour" | "day" | "week";
};

export type PermissionItem = {
  id: string;
  label: string;
  call?: CallPermission;
  spend?: SpendPermission;
};

export type Permissions = {
  calls: PermissionItem[];
  spend: PermissionItem[];
};

export class PermissionBuilder {
  private permissions: Permissions = { calls: [], spend: [] };
  
  // Add transfer permission for a token
  addTokenTransfer(token: TokenInfo): this {
    this.permissions.calls.push({
      id: `transfer-${token.symbol.toLowerCase()}`,
      label: `Transfer ${token.symbol}`,
      call: {
        to: token.address,
        signature: CONTRACT_REGISTRY.erc20Functions.transfer
      }
    });
    return this;
  }
  
  // Add approval permission for a token
  addTokenApproval(token: TokenInfo, spenderName?: string): this {
    this.permissions.calls.push({
      id: `approve-${token.symbol.toLowerCase()}`,
      label: `Approve ${token.symbol}${spenderName ? ` for ${spenderName}` : ''}`,
      call: {
        to: token.address,
        signature: CONTRACT_REGISTRY.erc20Functions.approve
      }
    });
    return this;
  }
  
  // Add mint permission for a token
  addTokenMint(token: TokenInfo): this {
    this.permissions.calls.push({
      id: `mint-${token.symbol.toLowerCase()}`,
      label: `Mint ${token.symbol}`,
      call: {
        to: token.address,
        signature: CONTRACT_REGISTRY.erc20Functions.mintOnce
      }
    });
    return this;
  }
  
  // Add spend limit for a token
  addTokenSpendLimit(token: TokenInfo, limit: string, period: SpendPermission['period'] = 'minute'): this {
    this.permissions.spend.push({
      id: `spend-${token.symbol.toLowerCase()}`,
      label: `Spend ${token.symbol} (${limit}/${period})`,
      spend: {
        token: token.address,
        limit: parseEther(limit),
        period
      }
    });
    return this;
  }
  
  // Add permission for a protocol function
  addProtocolFunction(protocolName: string, contractName: string, functionName: string, customLabel?: string): this {
    const protocol = CONTRACT_REGISTRY.protocols[protocolName as keyof typeof CONTRACT_REGISTRY.protocols] as any;
    if (!protocol) {
      throw new Error(`Protocol ${protocolName} not found in registry`);
    }
    
    const contract = protocol[contractName];
    if (!contract) {
      throw new Error(`Contract ${contractName} not found in protocol ${protocolName}`);
    }
    
    if (!('functions' in contract)) {
      throw new Error(`Contract ${contractName} has no functions`);
    }
    
    const func = contract.functions[functionName];
    if (!func) {
      throw new Error(`Function ${functionName} not found in ${protocolName}.${contractName}`);
    }
    
    const label = customLabel || `${functionName} (${protocolName})`;
    
    this.permissions.calls.push({
      id: `${protocolName}-${contractName}-${functionName}`.toLowerCase(),
      label,
      call: {
        to: contract.address,
        signature: func.signature
      }
    });
    
    return this;
  }
  
  // Add custom contract permission
  addCustomContract(address: Address, signature: string, label: string): this {
    this.permissions.calls.push({
      id: `custom-${address.slice(0, 8)}`,
      label,
      call: {
        to: address,
        signature
      }
    });
    return this;
  }
  
  // Add all standard token operations
  addAllTokenOperations(token: TokenInfo, spendLimit: string = "50"): this {
    return this
      .addTokenTransfer(token)
      .addTokenApproval(token, "Uniswap")
      .addTokenMint(token)
      .addTokenSpendLimit(token, spendLimit);
  }
  
  // Add all Uniswap operations
  addAllUniswapOperations(): this {
    return this
      .addProtocolFunction("uniswap", "router", "swapExactTokensForTokens", "Swap Tokens (Uniswap)");
      // NOTE: addLiquidity and removeLiquidity cause VerificationError on fresh wallets
  }
  
  // Build the final permissions object
  build(): Permissions {
    return this.permissions;
  }
  
  // Build for wagmi/viem format (without IDs and labels)
  buildRaw() {
    return {
      calls: this.permissions.calls
        .filter(item => item.call)
        .map(item => item.call!),
      spend: this.permissions.spend
        .filter(item => item.spend)
        .map(item => item.spend!)
    };
  }
  
  // Get permission items as selections (for UI checkboxes)
  getSelections() {
    return {
      calls: this.permissions.calls.map(item => item.id),
      spend: this.permissions.spend.map(item => item.id)
    };
  }
  
  // Static helper to create default permissions
  static createDefaultPermissions(): PermissionBuilder {
    const builder = new PermissionBuilder();
    
    // Add all token operations
    for (const token of Object.values(CONTRACT_REGISTRY.tokens)) {
      builder.addAllTokenOperations(token);
    }
    
    // Add Uniswap operations
    builder.addAllUniswapOperations();
    
    return builder;
  }
}