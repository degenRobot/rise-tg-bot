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
  const { data: permissions, isLoading: loading } = Hooks.usePermissions();
  const grantPermissions = Hooks.useGrantPermissions();
  const revokePermissions = Hooks.useRevokePermissions();

  // Log raw permissions structure
  console.log("Raw permissions from Hooks.usePermissions:", permissions);
  
  // Filter permissions for our backend key
  const backendPermissions = permissions?.filter(
    p => p.key?.publicKey?.toLowerCase() === backendKeyAddress.toLowerCase()
  ) || [];
  
  console.log("Filtered backend permissions:", backendPermissions);

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
          publicKey: backendKeyAddress, 
          type: "p256" as const // Use p256 type for EOA as well
        },
        expiry: Math.floor(Date.now() / 1000) + expirySeconds,
        feeToken: {
          limit: "1" as any, // String format like wallet-demo
          symbol: "ETH",
        },
        permissions: permissionData,
      };

      console.log("Granting permissions:", permissionParams);

      const result = await grantPermissions.mutateAsync(permissionParams);
      return result;
    } catch (error) {
      console.error("Failed to grant permissions:", error);
      throw error;
    } finally {
      setIsGranting(false);
    }
  }, [isConnected, address, backendKeyAddress, grantPermissions]);

  const revokeBackendPermission = useCallback(async (id: string) => {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected");
    }

    try {
      console.log("Attempting to revoke permission with id:", id);
      console.log("Current permissions:", permissions);
      
      // Ensure the ID is properly formatted
      const formattedId = id.startsWith('0x') ? id : `0x${id}`;
      console.log("Formatted ID:", formattedId);
      
      await revokePermissions.mutateAsync({ id: formattedId as `0x${string}` });
      console.log("Permission revoked successfully");
    } catch (error) {
      console.error("Failed to revoke permission:", error);
      throw error;
    }
  }, [isConnected, address, revokePermissions, permissions]);

  return {
    permissions: backendPermissions,
    loading,
    isGranting,
    grantPermissions: grantBackendPermissions,
    revokePermission: revokeBackendPermission,
  };
}