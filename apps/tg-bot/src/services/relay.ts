import { Client, Transport, Chain, Account } from 'viem';
import * as RelayActions from 'rise-wallet/viem/RelayActions';
import * as Key from 'rise-wallet/viem/Key';
import { Address, Hex } from 'viem';

// Define types locally since we can't import deep types easily
export interface RelayPrepareCallsParameters {
  account: Account;
  chain: Chain;
  calls: { to: Address; data?: Hex; value?: bigint }[];
  key?: Key.Key; // The key signing the request
  authorizeKeys?: Key.Key[]; // New keys to authorize
  permissionId?: string; // The permission ID to use for execution
  feeToken?: Address;
  preCalls?: boolean | any[]; // Simplified type
}

/**
 * Custom implementation of prepareCalls that supports permissions.id capability
 * Adapted from porto-rise/src/viem/RelayActions.ts
 */
export async function prepareCalls(
  client: Client<Transport, Chain, Account>,
  parameters: RelayPrepareCallsParameters
) {
  const {
    account,
    chain,
    calls,
    key,
    authorizeKeys,
    permissionId,
    preCalls,
  } = parameters;

  // 1. Get capabilities from Relay to know about fees and contracts
  const capabilities = await RelayActions.getCapabilities(client, { chainId: chain.id });
  const { contracts, fees: { tokens } } = capabilities;

  // 2. Determine if we need orchestrator (if authorizing session keys)
  const hasSessionKey = authorizeKeys?.some((x) => x.role === 'session');
  const orchestrator = hasSessionKey ? contracts.orchestrator.address : undefined;

  // 3. Format authorizeKeys for Relay
  const formattedAuthorizeKeys = (authorizeKeys ?? []).map((k) =>
    Key.toRelay(k, { feeTokens: tokens, orchestrator })
  );

  // 4. Determine fee token
  // If provided, use it. Else try to infer from key spend permissions.
  const feeToken = (() => {
    if (parameters.feeToken) return parameters.feeToken;
    return key?.permissions?.spend?.[0]?.token;
  })();

  // 5. Handle preCalls (approvals etc)
  // If preCalls is boolean true, we request them. If array, we pass them (signed).
  const preCall = typeof preCalls === 'boolean' ? preCalls : false;
  const signedPreCalls = Array.isArray(preCalls) ? preCalls : undefined;

  // 6. Construct the request arguments
  const requestParams = {
    address: account.address,
    calls: calls.map(c => ({
      to: c.to,
      data: c.data,
      value: c.value ? `0x${c.value.toString(16)}` : undefined,
    })),
    capabilities: {
      authorizeKeys: formattedAuthorizeKeys.length > 0 ? formattedAuthorizeKeys : undefined,
      meta: {
        feePayer: account.address, // Default to self-paying
        feeToken,
        nonce: undefined, // Let wallet handle nonce
      },
      preCall,
      preCalls: signedPreCalls,
      // Add the permission ID capability if provided
      ...(permissionId ? {
        permissions: {
          id: permissionId,
        }
      } : {})
    },
    chain: undefined, // chainId is at root usually
    chainId: `0x${chain.id.toString(16)}`,
    from: account.address,
    key: key ? Key.toRelay(key, { feeTokens: tokens }) : undefined,
  };

  console.log("📡 Sending wallet_prepareCalls with capabilities:", JSON.stringify(requestParams.capabilities, (k, v) => 
    typeof v === 'bigint' ? v.toString() : v
  , 2));

  // 7. Send request
  const result = await client.request({
    method: 'wallet_prepareCalls',
    params: [requestParams],
  } as any);

  return result as any; // Return raw result
}

/**
 * Send prepared calls using the library's helper or direct calls
 */
export async function sendPreparedCalls(
  client: Client<Transport, Chain, Account>,
  parameters: {
    context: any;
    signature: Hex;
    key?: Key.Key;
  }
) {
  // We can use the library's sendPreparedCalls if it supports our context structure
  // But since our context might come from our custom prepareCalls, let's check types.
  // To be safe, we can just wrap the library call if types match, or call RPC directly.
  
  // The library implementation:
  // return await RelayActions.sendPreparedCalls(client, { ... })
  
  // It seems safer to use the library function as it handles some formatting
  return await RelayActions.sendPreparedCalls(client, {
    context: parameters.context,
    signature: parameters.signature,
    key: parameters.key ? Key.toRelay(parameters.key) : undefined
  } as any);
}

