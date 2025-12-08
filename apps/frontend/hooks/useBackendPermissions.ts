"use client";

import { useCallback, useState } from "react";
import { Hooks } from "rise-wallet/wagmi";
import { useAccount } from "wagmi";
import { buildPermissionsFromSelections } from "../config/permissions";

interface UseBackendPermissionsProps {
  backendKeyAddress: string;
}

export function useBackendPermissions({ backendKeyAddress }: UseBackendPermissionsProps) {
  const { address, isConnected } = useAccount();
  const [isGranting, setIsGranting] = useState(false);

  // Use Porto's built-in hooks
  const { data: permissions, isLoading: loading, refetch: refetchPermissions } = Hooks.usePermissions();
  const grantPermissions = Hooks.useGrantPermissions();
  const revokePermissions = Hooks.useRevokePermissions({
    mutation: {
      onSuccess: () => {
        console.log("✅ [REVOKE] onSuccess callback fired - refetching permissions...");
        refetchPermissions();
      }
    }
  });

  // Log raw permissions structure with full details
  console.log("🔍 [PERMISSIONS] Raw permissions from Hooks.usePermissions:", permissions);
  console.log("🔍 [PERMISSIONS] Permissions count:", permissions?.length || 0);

  // Check what IDs look like
  if (permissions && permissions.length > 0) {
    permissions.forEach((p: any, idx: number) => {
      console.log(`🔍 [PERMISSION ${idx}] Full object:`, p);
      console.log(`🔍 [PERMISSION ${idx}] ID:`, p.id, "Type:", typeof p.id);
      console.log(`🔍 [PERMISSION ${idx}] Key:`, p.key);
      console.log(`🔍 [PERMISSION ${idx}] Expiry:`, p.expiry, "Type:", typeof p.expiry);
    });
  }

  // Filter permissions for our backend key (match both EOA address and any derived P256 keys)
  // We show ALL permissions for now to allow cleanup
  const backendPermissions = permissions || [];

  console.log("All permissions (showing all for cleanup):", backendPermissions);

  const grantBackendPermissions = useCallback(async (
    selections: { calls: string[]; spend: string[] },
    expirySeconds: number
  ) => {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected");
    }

    setIsGranting(true);
    try {
      const permissionData = buildPermissionsFromSelections(selections);

      const permissionParams = {
        key: { 
          publicKey: backendKeyAddress as `0x${string}`, 
          type: "p256" as const // Use p256 type for EOA as well
        },
        expiry: Math.floor(Date.now() / 1000) + expirySeconds,
        feeToken: {
          limit: "1" as `${number}`, // String format like wallet-demo
          symbol: "ETH",
        },
        permissions: permissionData,
      };

      console.log("Granting permissions:", permissionParams);

      const result = await grantPermissions.mutateAsync(permissionParams);
      console.log("📝 Grant result from Porto:", result);

      // Force refetch to get updated permissions
      await refetchPermissions();

      // Sync permission to backend
      console.log("Syncing permission to backend...");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8008";
      const syncResponse = await fetch(`${apiUrl}/api/permissions/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountAddress: address,
          backendKeyAddress: backendKeyAddress,
          expiry: permissionParams.expiry,
          permissionDetails: {
            id: result.id,
            keyPublicKey: backendKeyAddress,
            permissions: permissionData,
          },
        }),
      });

      console.log("Backend sync response status:", syncResponse.status);
      const syncData = await syncResponse.json();
      console.log("Backend sync response data:", syncData);

      if (!syncResponse.ok) {
        console.error("Failed to sync permission to backend:", syncData);
      } else {
        console.log("✅ Permission synced to backend");
      }

      return result;
    } catch (error) {
      console.error("Failed to grant permissions:", error);
      throw error;
    } finally {
      setIsGranting(false);
    }
  }, [isConnected, address, backendKeyAddress, grantPermissions, refetchPermissions]);

  const revokeBackendPermission = useCallback(async (id: string) => {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected");
    }

    try {
      console.log("🗑️ [REVOKE] Starting revoke process...");
      console.log("🗑️ [REVOKE] Permission ID to revoke:", id);
      console.log("🗑️ [REVOKE] Current permissions array:", permissions);
      console.log("🗑️ [REVOKE] User address:", address);

      // Ensure the ID is properly formatted
      const formattedId = id.startsWith('0x') ? id : `0x${id}`;
      console.log("🗑️ [REVOKE] Formatted ID:", formattedId);

      // Find the permission in the list to verify it exists
      const permToRevoke = permissions?.find(p => p.id === formattedId);
      console.log("🗑️ [REVOKE] Permission found in list:", permToRevoke);

      if (!permToRevoke) {
        console.error("🗑️ [REVOKE] Permission not found in current list!");
      }

      // Revoke on-chain first
      console.log("🗑️ [REVOKE] Calling Porto revokePermissions.mutateAsync...");
      await revokePermissions.mutateAsync({ id: formattedId as `0x${string}` });
      console.log("✅ [REVOKE] Revoke mutation completed (onSuccess callback will refetch)");

      // Sync revocation to backend
      console.log("🗑️ [REVOKE] Syncing revocation to backend...");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8008";
      const syncResponse = await fetch(`${apiUrl}/api/permissions/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountAddress: address,
          permissionId: formattedId,
        }),
      });

      console.log("🗑️ [REVOKE] Backend sync response status:", syncResponse.status);
      const syncData = await syncResponse.json();
      console.log("🗑️ [REVOKE] Backend sync response data:", syncData);

      if (!syncResponse.ok) {
        console.error("❌ [REVOKE] Failed to sync revocation to backend:", syncData);
      } else {
        console.log("✅ [REVOKE] Revocation synced to backend successfully");
      }
    } catch (error) {
      console.error("❌ [REVOKE] Failed to revoke permission:", error);
      console.error("❌ [REVOKE] Error details:", JSON.stringify(error, null, 2));
      throw error;
    }
  }, [isConnected, address, revokePermissions, permissions, refetchPermissions]);

  return {
    permissions: backendPermissions,
    loading,
    isGranting,
    grantPermissions: grantBackendPermissions,
    revokePermission: revokeBackendPermission,
  };
}