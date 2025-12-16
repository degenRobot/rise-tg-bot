"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "./Button";
import { Card, CardHeader, CardContent } from "./Card";
import { Address } from "viem";

interface GrantPermissionsProps {
  onGranted: (result: {
    success: boolean;
    expiry: number;
    sessionKey: string;
    permissionDetails?: {
      id: string;
      keyPublicKey: string;
      permissions: unknown;
    };
  }) => void;
  backendKeyAddress: string;
}

export function GrantPermissions({ onGranted, backendKeyAddress }: GrantPermissionsProps) {
  const [isGranting, setIsGranting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { address, connector } = useAccount();

  const handleGrantPermissions = async () => {
    if (!address || !backendKeyAddress) return;

    setIsGranting(true);
    setError("");
    setSuccess(false);

    try {
      console.log("🔐 Granting permissions to backend session key...");
      console.log("User address:", address);
      console.log("Backend key address:", backendKeyAddress);

      // Check if we have Porto connector
      if (connector?.name !== "Porto") {
        throw new Error("Porto wallet connector required for permission granting");
      }

      // Get Porto provider for direct wallet calls
      const provider = (window as { porto?: { provider?: unknown } }).porto?.provider;
      if (!provider || typeof provider !== 'object' || !('request' in provider)) {
        throw new Error("Porto provider not available. Please ensure RISE wallet is connected.");
      }

      console.log("📋 Preparing grantPermissions transaction...");

      // Define permission structure for RISE bot operations
      const permissions = {
        // Allow the backend key to execute transactions on behalf of user
        calls: [
          {
            // Allow calls to any contract (for swaps, transfers, etc.)
            to: undefined, // No restriction on target address
            signature: undefined, // No restriction on function signature
          }
        ],
        // Allow spending up to reasonable limits
        spend: [
          {
            // ETH spending limit
            token: "0x0000000000000000000000000000000000000000", // ETH
            limit: "0x16345785D8A0000", // 0.1 ETH in wei (hex)
            period: "day" as const,
          },
          {
            // Generic ERC20 spending limit (no specific token)
            token: undefined, // Any ERC20 token
            limit: "0xDE0B6B3A7640000", // 1 ETH worth in wei (hex)
            period: "day" as const,
          }
        ]
      };

      // Set expiry for 1 week from now
      const expirySeconds = 7 * 24 * 60 * 60; // 1 week
      const expiry = Math.floor(Date.now() / 1000) + expirySeconds;

      console.log("📋 Permission structure:", {
        backendKey: backendKeyAddress,
        permissions,
        expiry: new Date(expiry * 1000).toISOString(),
      });

      // Call wallet_grantPermissions via Porto provider
      console.log("🔐 Calling wallet_grantPermissions...");
      const grantResult = await (provider as { request: (args: { method: string; params: unknown[] }) => Promise<unknown> }).request({
        method: "wallet_grantPermissions",
        params: [{
          key: {
            address: backendKeyAddress as Address,
            expiry,
            permissions,
            type: "p256"
          }
        }],
      });

      console.log("✅ Grant permissions result:", grantResult);

      // Extract permission details from result for backend sync
      let permissionDetails: { id: string; keyPublicKey: string; permissions: unknown } | undefined;
      if (grantResult && typeof grantResult === 'object') {
        // Try to extract permission ID and details from grant result
        const resultArray = Array.isArray(grantResult) ? grantResult : [grantResult];
        const firstResult = resultArray[0] as { id?: string };

        if (firstResult && firstResult.id) {
          permissionDetails = {
            id: firstResult.id,
            keyPublicKey: backendKeyAddress,
            permissions: permissions, // The permissions we granted
          };
          console.log("📦 Extracted permission details:", permissionDetails);
        } else {
          console.log("⚠️ Could not extract permission ID from grant result:", firstResult);
        }
      }

      // Notify parent component with detailed info
      onGranted({
        success: true,
        expiry,
        sessionKey: backendKeyAddress,
        permissionDetails, // Pass the extracted details
      });

      setSuccess(true);

    } catch (error) {
      console.error("❌ Grant permissions error:", error);

      let errorMessage = error instanceof Error ? error.message : "Failed to grant permissions";

      // Handle common error cases
      if (errorMessage.includes("User rejected") || errorMessage.includes("User denied")) {
        errorMessage = "Permission grant rejected by user";
      } else if (errorMessage.includes("not available") || errorMessage.includes("not found")) {
        errorMessage = "RISE wallet not properly connected. Please reconnect your wallet.";
      }

      setError(errorMessage);
    } finally {
      setIsGranting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">🔐 Grant Bot Permissions</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">
              To use the Telegram bot, you need to grant it permission to execute transactions on your behalf.
            </p>
            <p className="mb-3">
              <strong>This will allow the bot to:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Execute swaps and trades up to 0.1 ETH per day</li>
              <li>Transfer tokens up to 1 ETH equivalent per day</li>
              <li>Perform DeFi operations you request via Telegram</li>
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              Permissions expire after 1 week and can be revoked at any time.
            </p>
          </div>

          {!address ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Please connect your wallet to continue.
            </div>
          ) : success ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
              <p className="text-sm text-green-600 dark:text-green-400">
                ✅ Permissions successfully granted! You can now use the Telegram bot.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  <strong>Backend Session Key:</strong> {backendKeyAddress}
                </p>
              </div>

              <Button
                onClick={handleGrantPermissions}
                disabled={!address || isGranting}
                className="w-full"
              >
                {isGranting ? "Granting Permissions..." : "Grant Permissions to Bot"}
              </Button>
            </>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}