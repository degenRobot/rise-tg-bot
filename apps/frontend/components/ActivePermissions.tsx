"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardHeader, CardContent } from "./Card";
import { Button } from "./Button";

interface Permission {
  id: string;
  key: {
    publicKey: string;
    type: string;
  };
  expiry: number;
  permissions?: {
    calls?: Array<{ to?: string; signature?: string }>;
    spend?: Array<{ limit: string; period: string; token?: string }>;
  };
}

interface ActivePermissionsProps {
  permissions: Permission[];
  onRevoke: (id: string) => Promise<void>;
  backendKeyAddress: string;
}

export function ActivePermissions({ permissions, onRevoke, backendKeyAddress }: ActivePermissionsProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  
  // Filter to only show permissions for our backend key
  const relevantPermissions = permissions.filter(
    p => p.key?.publicKey?.toLowerCase() === backendKeyAddress.toLowerCase()
  );
  
  const handleRevoke = async (id: string) => {
    try {
      setRevokingId(id);
      await onRevoke(id);
    } catch (error) {
      console.error("Failed to revoke permission:", error);
    } finally {
      setRevokingId(null);
    }
  };
  
  if (relevantPermissions.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            No active permissions for the Telegram bot
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Active Bot Permissions</h3>
      
      {relevantPermissions.map((permission) => {
        const expiryDate = new Date(permission.expiry * 1000);
        const isExpired = expiryDate < new Date();
        const callCount = permission.permissions?.calls?.length || 0;
        const spendCount = permission.permissions?.spend?.length || 0;
        
        return (
          <Card key={permission.id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Permission ID: {permission.id.slice(0, 8)}...
                    </span>
                    {isExpired && (
                      <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-2 py-1 rounded">
                        Expired
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>
                      Expires: {isExpired ? "Expired" : formatDistanceToNow(expiryDate, { addSuffix: true })}
                    </div>
                    <div>
                      Permissions: {callCount} function calls, {spendCount} spending limits
                    </div>
                  </div>
                  
                  {/* Permission Details */}
                  <details className="mt-2">
                    <summary className="text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                      View Details
                    </summary>
                    <div className="mt-2 space-y-2 text-xs">
                      {permission.permissions?.calls && permission.permissions.calls.length > 0 && (
                        <div>
                          <span className="font-medium">Allowed Calls:</span>
                          <ul className="ml-4 mt-1 space-y-1">
                            {permission.permissions.calls.map((call, idx) => (
                              <li key={idx} className="font-mono text-gray-600 dark:text-gray-400">
                                {call.to?.slice(0, 10)}... - {call.signature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {permission.permissions?.spend && permission.permissions.spend.length > 0 && (
                        <div>
                          <span className="font-medium">Spending Limits:</span>
                          <ul className="ml-4 mt-1 space-y-1">
                            {permission.permissions.spend.map((spend, idx) => (
                              <li key={idx} className="text-gray-600 dark:text-gray-400">
                                {spend.limit} per {spend.period}
                                {spend.token && ` (${spend.token.slice(0, 10)}...)`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
                
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleRevoke(permission.id)}
                  disabled={revokingId === permission.id || isExpired}
                >
                  {revokingId === permission.id ? "Revoking..." : "Revoke"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}