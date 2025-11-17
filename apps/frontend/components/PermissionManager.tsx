"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Address, formatEther } from "viem";
import { Card, CardHeader, CardContent, CardFooter } from "./Card";
import { Button } from "./Button";
import { Switch } from "./Switch";
import { 
  AVAILABLE_CALLS, 
  TOKEN_ADDRESSES, 
  SPEND_PERIODS,
  DEFAULT_SPEND_LIMITS,
  PERMISSION_TEMPLATES,
  buildPermissions
} from "../config/permissions";
import type { PermissionTemplate } from "shared/types";

interface PermissionManagerProps {
  backendKeyAddress: Address;
  onGrant: (permissions: any, expiry: number) => Promise<void>;
  existingPermissions?: any[];
  telegramId?: string;
}

export function PermissionManager({ 
  backendKeyAddress, 
  onGrant,
  existingPermissions = [],
  telegramId
}: PermissionManagerProps) {
  const { address, isConnected } = useAccount();
  
  // State for permission configuration
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof PERMISSION_TEMPLATES | "custom">("basic");
  const [selectedCalls, setSelectedCalls] = useState<string[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<Address[]>([]);
  const [spendLimits, setSpendLimits] = useState<Array<{
    token: Address | null;
    limit: string;
    period: "minute" | "hour" | "day" | "week" | "month";
  }>>([]);
  const [expiryDays, setExpiryDays] = useState(7);
  const [isGranting, setIsGranting] = useState(false);
  
  // Apply template when selected
  useEffect(() => {
    if (selectedTemplate !== "custom") {
      const template = PERMISSION_TEMPLATES[selectedTemplate];
      setSelectedCalls(template.selectedCalls);
      
      // Extract tokens from spend limits
      const tokens = template.spendLimits
        .filter(limit => limit.token)
        .map(limit => limit.token as Address);
      setSelectedTokens([...new Set(tokens)]);
      
      setSpendLimits(template.spendLimits);
    }
  }, [selectedTemplate]);
  
  const handleCallToggle = (callId: string) => {
    setSelectedTemplate("custom");
    setSelectedCalls(prev => 
      prev.includes(callId) 
        ? prev.filter(id => id !== callId)
        : [...prev, callId]
    );
  };
  
  const handleTokenToggle = (tokenAddress: Address) => {
    setSelectedTemplate("custom");
    setSelectedTokens(prev => 
      prev.includes(tokenAddress)
        ? prev.filter(addr => addr !== tokenAddress)
        : [...prev, tokenAddress]
    );
  };
  
  const handleSpendLimitChange = (index: number, field: string, value: any) => {
    setSelectedTemplate("custom");
    setSpendLimits(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };
  
  const addSpendLimit = () => {
    setSelectedTemplate("custom");
    setSpendLimits(prev => [...prev, { token: null, limit: "10", period: "day" }]);
  };
  
  const removeSpendLimit = (index: number) => {
    setSelectedTemplate("custom");
    setSpendLimits(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleGrantPermissions = async () => {
    if (!isConnected) return;
    
    try {
      setIsGranting(true);
      
      const permissions = buildPermissions({
        selectedCalls,
        selectedTokens,
        spendLimits,
      });
      
      const expirySeconds = expiryDays * 24 * 60 * 60;
      await onGrant(permissions, expirySeconds);
    } catch (error) {
      console.error("Error granting permissions:", error);
    } finally {
      setIsGranting(false);
    }
  };
  
  // Check if there are active permissions
  const hasActivePermissions = existingPermissions.length > 0;
  
  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Permission Template</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
          >
            {Object.entries(PERMISSION_TEMPLATES).map(([key, template]) => (
              <option key={key} value={key}>
                {template.name} - {template.description}
              </option>
            ))}
            <option value="custom">Custom Configuration</option>
          </select>
        </CardContent>
      </Card>

      {/* Function Calls Configuration */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Allowed Functions</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select which functions the bot can call
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {AVAILABLE_CALLS.map(call => (
            <Switch
              key={call.id}
              checked={selectedCalls.includes(call.id)}
              onChange={() => handleCallToggle(call.id)}
              label={
                <div>
                  <div className="font-medium">{call.label}</div>
                  <div className="text-sm text-gray-500">{call.description}</div>
                </div>
              }
            />
          ))}
        </CardContent>
      </Card>

      {/* Token Selection */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Allowed Tokens</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select which tokens the bot can interact with
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {TOKEN_ADDRESSES.map(token => (
            <Switch
              key={token.address}
              checked={selectedTokens.includes(token.address)}
              onChange={() => handleTokenToggle(token.address)}
              label={`${token.name} (${token.symbol})`}
            />
          ))}
        </CardContent>
      </Card>

      {/* Spend Limits */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Spending Limits</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Set maximum amounts the bot can spend
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={addSpendLimit}>
              Add Limit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {spendLimits.map((limit, index) => (
            <div key={index} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Token</label>
                <select
                  value={limit.token || ""}
                  onChange={(e) => handleSpendLimitChange(index, "token", e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                >
                  <option value="">Native (RISE)</option>
                  {TOKEN_ADDRESSES.map(token => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  value={limit.limit}
                  onChange={(e) => handleSpendLimitChange(index, "limit", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  min="0"
                  step="0.1"
                />
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Period</label>
                <select
                  value={limit.period}
                  onChange={(e) => handleSpendLimitChange(index, "period", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                >
                  {SPEND_PERIODS.map(period => (
                    <option key={period.value} value={period.value}>
                      {period.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <Button
                size="sm"
                variant="danger"
                onClick={() => removeSpendLimit(index)}
              >
                Remove
              </Button>
            </div>
          ))}
          
          {spendLimits.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No spending limits set. Click "Add Limit" to create one.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Expiry Configuration */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Permission Expiry</h3>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              min={1}
              max={365}
              className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">days</span>
          </div>
        </CardContent>
      </Card>

      {/* Summary and Grant Button */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Summary</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <div>
              <span className="font-medium">Backend Key:</span>{" "}
              <span className="font-mono text-xs">{backendKeyAddress}</span>
            </div>
            {telegramId && (
              <div>
                <span className="font-medium">Telegram ID:</span> {telegramId}
              </div>
            )}
            <div>
              <span className="font-medium">Selected Functions:</span>{" "}
              {selectedCalls.length === 0 ? "None" : selectedCalls.map(id => 
                AVAILABLE_CALLS.find(c => c.id === id)?.label
              ).join(", ")}
            </div>
            <div>
              <span className="font-medium">Selected Tokens:</span>{" "}
              {selectedTokens.length === 0 ? "None" : selectedTokens.length + " tokens"}
            </div>
            <div>
              <span className="font-medium">Spending Limits:</span>{" "}
              {spendLimits.length === 0 ? "None" : spendLimits.length + " limits"}
            </div>
            <div>
              <span className="font-medium">Expires in:</span> {expiryDays} days
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleGrantPermissions}
            disabled={!isConnected || isGranting || (selectedCalls.length === 0 && spendLimits.length === 0)}
            className="w-full"
          >
            {isGranting ? "Granting Permissions..." : "Grant Permissions"}
          </Button>
        </CardFooter>
      </Card>
      
      {hasActivePermissions && (
        <div className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
          Note: You have existing active permissions. Granting new permissions will add to the existing ones.
        </div>
      )}
    </div>
  );
}