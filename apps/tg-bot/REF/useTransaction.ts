import { PERMISSIONS } from "@/config/permissions";
import { useUserPreference } from "@/context/UserPreference";
import { isArray } from "lodash";
import { Hex, P256, Signature } from "ox";
import { Address, Hex as HexAddress } from "viem";
import { useAccount, useChainId, useSendCalls } from "wagmi";
import { useSessionKeys } from "./useSessionKeys";

export type TransactionCall = {
  to: HexAddress;
  data?: HexAddress;
  value?: bigint;
};

export type TransactionProps = {
  calls: TransactionCall[];
  requiredPermissions?: {
    calls?: string[];
  };
};

export type TransactionData = {
  hash: string;
  success: boolean;
  usedSessionKey?: boolean;
  keyId?: string;
};

export function useTransaction() {
  const {
    activeSessionKeys: sessionKey,
    hasUsableSessionKey,
    keyPair: key,
  } = useSessionKeys();

  const chainId = useChainId();

  const { isSessionKeyEnabled } = useUserPreference();

  const { connector, address } = useAccount();

  const { sendCallsAsync } = useSendCalls();

  async function execute(props: TransactionProps) {
    console.log("executing...");
    const { calls, requiredPermissions } = props;

    if (isSessionKeyEnabled && sessionKey && hasUsableSessionKey) {
      console.log("activeSessionKeys:: ", sessionKey);
      const callAddresses = requiredPermissions.calls.map((addr) =>
        addr.toLowerCase()
      );

      const permissions = sessionKey.permissions?.calls || [];

      const isPermitted = callAddresses.every((requiredAddress) =>
        permissions.some(
          (perm: any) => !perm.to || perm.to.toLowerCase() === requiredAddress
        )
      );

      try {
        if (isPermitted) {
          // Session key lacks required permissions, fall back to passkey
          const result = await executeWithSessionKey(calls);

          return {
            error: null,
            ...result,
          };
        } else {
          return executeWithPasskey(calls);
        }
      } catch (error) {
        console.log("execute-error: ", error);
        return {
          success: false,
          error,
          data: null,
        };
      }
    } else {
      return executeWithPasskey(calls);
    }
  }

  async function executeWithPasskey(calls: TransactionCall[]) {
    console.log("executing using passkey....");
    try {
      // TODO: Fix type instantation issue - wagmi
      const result = await sendCallsAsync({
        calls,
        version: "1",
      } as any);

      return {
        success: true,
        error: null,
        data: { ...result, usedSessionKey: false },
      };
    } catch (error) {
      console.log("execute-with-passkey-error: ", error);

      return {
        success: false,
        error,
        data: null,
      };
    }
  }

  async function executeWithSessionKey(calls: TransactionCall[]) {
    console.log("executing using sessionkey....");
    try {
      // Use the connector from the hook state
      if (!connector) throw new Error("No connector available");

      const provider = (await connector.getProvider()) as any;

      const intentParams = [
        {
          calls,
          chainId: Hex.fromNumber(chainId),
          from: address,
          atomicRequired: true,
          key: {
            publicKey: key.publicKey,
            type: "p256",
          },
        },
      ];

      // Prepare calls to simulate and estimate fees
      const { digest, capabilities, ...request } = await provider.request({
        method: "wallet_prepareCalls",
        params: intentParams,
      });

      console.log("intentParams:: ", intentParams);

      // Sign the intent
      const signature = Signature.toHex(
        P256.sign({
          payload: digest as `0x${string}`,
          privateKey: key.privateKey as Address,
        })
      );

      // Send calls
      const result = await provider.request({
        method: "wallet_sendPreparedCalls",
        params: [
          {
            ...request,
            ...(capabilities ? { capabilities } : {}),
            signature,
          },
        ],
      });

      let resp = result;

      if (isArray(result) && result.length !== 0) {
        resp = result[0];
      }

      console.log("session-request:: ", request);
      console.log("session-capabilities:: ", capabilities);
      console.log("session-result:: ", result[0]);
      console.log("session-signature:: ", signature);
      console.log("session-digest:: ", digest);
      console.log("session-key:: ", key);

      return {
        success: true,
        error: null,
        data: { ...resp, usedSessionKey: true },
      };
    } catch (error) {
      console.log("execute-with-sessionkey-error:: ", error);
      return {
        success: false,
        error,
        data: null,
      };
    }
  }

  async function getEthAccounts() {
    // For debugging only
    if (!connector) throw new Error("No connector available");

    const provider = (await connector.getProvider()) as any;

    const accounts = await provider.request({
      method: "eth_accounts",
    });

    console.log("eth_accounts:: ", accounts);

    return accounts;
  }

  async function getWalletKeys() {
    // For debugging only
    const provider = (await connector.getProvider()) as any;

    const walletKeys = await provider.request({
      method: "wallet_getKeys",
      params: [
        {
          address,
        },
      ],
    });

    console.log("session-walletKeys:: ", walletKeys);
  }

  async function getCapabilities() {
    // For debugging only
    const provider = (await connector.getProvider()) as any;

    const capabilities = await provider.request({
      method: "wallet_getCapabilities",
      params: [Hex.fromNumber(chainId)],
    });

    console.log("session-capabilities:: ", capabilities);
  }

  async function getPermissions() {
    // For debugging only
    const provider = (await connector.getProvider()) as any;

    const permissions = await provider.request({
      method: "wallet_getPermissions",
      params: [{ address }],
    });

    console.log("session-permissions:: ", permissions);
  }

  function extractPermission() {
    const calls = PERMISSIONS.calls.map((call) => {
      return {
        type: "call",
        selector: call.signature,
        to: call.to,
      };
    });

    const limits = PERMISSIONS.spend.map((spend) => {
      return {
        type: "spend",
        limit: spend.limit,
        period: spend.period,
      };
    });

    const permissions = [...calls, ...limits];

    console.log("extracted-permissions:: ", permissions);
    return permissions;
  }

  return {
    execute,
    executeWithPasskey,
    executeWithSessionKey,
    getWalletKeys,
    getCapabilities,
    getPermissions,
    extractPermission,
    getEthAccounts,
  };
}
