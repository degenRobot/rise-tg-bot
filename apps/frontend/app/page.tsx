"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useBackendPermissions } from "../hooks/useBackendPermissions";
import { Chains } from "rise-wallet";
import { PERMISSION_ITEMS, DEFAULT_SELECTIONS } from "../config/permissions";
import { Card, CardHeader, CardContent, CardFooter } from "../components/Card";
import { Button } from "../components/Button";
import { ActivePermissions } from "../components/ActivePermissions";
import { TelegramVerification } from "../components/TelegramVerification";
import { formatDistanceToNow } from "date-fns";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export default function Home() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  
  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  
  // Get backend key from env or URL params
  const [backendKeyAddress, setBackendKeyAddress] = useState<string>("");
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [hasGrantedPermissions, setHasGrantedPermissions] = useState(false);
  
  // Permission selections
  const [selectedCalls, setSelectedCalls] = useState<string[]>(DEFAULT_SELECTIONS.calls);
  const [selectedSpend, setSelectedSpend] = useState<string[]>(DEFAULT_SELECTIONS.spend);
  
  // Fix hydration by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Get backend key from env
  useEffect(() => {
    const backendKey = process.env.NEXT_PUBLIC_BACKEND_KEY_ADDRESS || "0x038AEBDbDEcd7F4604Fd6902b40BE063e5fc3f7B";
    setBackendKeyAddress(backendKey);
  }, []);
  
  const {
    permissions,
    loading,
    isGranting,
    grantPermissions,
    revokePermission
  } = useBackendPermissions({ backendKeyAddress });

  // Check if permissions are already granted
  useEffect(() => {
    if (permissions && permissions.length > 0) {
      // Check if any permission is still valid
      const hasValidPermission = permissions.some(p => {
        const expiry = p.expiry || 0;
        return expiry > Math.floor(Date.now() / 1000);
      });
      setHasGrantedPermissions(hasValidPermission);
    }
  }, [permissions]);
  
  const handleCallToggle = (id: string) => {
    setSelectedCalls(prev =>
      prev.includes(id)
        ? prev.filter(callId => callId !== id)
        : [...prev, id]
    );
  };
  
  const handleSpendToggle = (id: string) => {
    setSelectedSpend(prev =>
      prev.includes(id)
        ? prev.filter(spendId => spendId !== id)
        : [...prev, id]
    );
  };
  
  const handleGrantPermissions = async () => {
    try {
      setError("");
      setSuccess(false);
      
      // Check if we're on the correct chain
      if (chain?.id !== Chains.riseTestnet.id) {
        console.log("Switching to RISE testnet...");
        await switchChain({ chainId: Chains.riseTestnet.id });
        // Wait a bit for the chain switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const expirySeconds = expiryDays * 24 * 60 * 60;
      await grantPermissions(
        { calls: selectedCalls, spend: selectedSpend },
        expirySeconds
      );
      
      setHasGrantedPermissions(true);
      setSuccess(true);
    } catch (err: any) {
      console.error("Error granting permissions:", err);
      setError(err.message || "Failed to grant permissions");
    }
  };

  const handleTelegramVerified = async (telegramHandle: string) => {
    console.log("Telegram handle verified:", telegramHandle);
    
    // Create a user object for backward compatibility
    const user: TelegramUser = {
      id: 0, // We'll use handle as identifier
      first_name: telegramHandle,
      last_name: "",
      username: telegramHandle,
      photo_url: "",
      auth_date: Math.floor(Date.now() / 1000),
      hash: "",
    };
    
    setTelegramUser(user);
    
    // Sync with backend
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8008"}/api/permissions/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountAddress: address,
          backendKeyAddress,
          expiry: Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60),
          telegramId: telegramHandle, // Use handle as ID
          telegramUsername: telegramHandle,
          telegramData: user,
        }),
      });
      
      setSuccess(true);
    } catch (err) {
      console.error("Failed to sync with backend:", err);
      setError("Failed to link Telegram account");
    }
  };
  
  const toggleAll = (type: "calls" | "spend", value: boolean) => {
    const items = PERMISSION_ITEMS[type].map(item => item.id);
    if (type === "calls") {
      setSelectedCalls(value ? items : []);
    } else {
      setSelectedSpend(value ? items : []);
    }
  };

  // Determine current step - start with 1 to avoid hydration mismatch
  const [currentStep, setCurrentStep] = useState(1);
  
  useEffect(() => {
    // Update step based on current state
    if (!isConnected) {
      setCurrentStep(1);
    } else if (!hasGrantedPermissions) {
      setCurrentStep(2);
    } else if (!telegramUser) {
      setCurrentStep(3);
    } else {
      setCurrentStep(4);
    }
  }, [isConnected, hasGrantedPermissions, telegramUser]);

  // Show loading state during hydration
  if (!mounted) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <div className="max-w-4xl w-full space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">RISE Telegram Bot</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Loading...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="max-w-4xl w-full space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">RISE Telegram Bot</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet, grant permissions, and link your Telegram account
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                1
              </div>
              <span className="ml-2 hidden sm:inline">Connect Wallet</span>
            </div>
            <div className={`w-16 h-0.5 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <div className={`flex items-center ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                2
              </div>
              <span className="ml-2 hidden sm:inline">Grant Permissions</span>
            </div>
            <div className={`w-16 h-0.5 ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <div className={`flex items-center ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                3
              </div>
              <span className="ml-2 hidden sm:inline">Link Telegram</span>
            </div>
          </div>
        </div>
        
        {/* Step 1: Wallet Connection */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">1. Connect Your RISE Wallet</h2>
          </CardHeader>
          <CardContent>
            {!isConnected ? (
              <>
                {connectors.length === 0 ? (
                  <div className="text-center space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      RISE Wallet extension not detected
                    </p>
                    <a
                      href="https://chromewebstore.google.com/detail/rise-wallet/hbbplkfdlpkdgclapcfmkdfohjfgcokj"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block"
                    >
                      <Button className="w-full">
                        Install RISE Wallet Extension
                      </Button>
                    </a>
                    <p className="text-xs text-gray-500">
                      After installing, refresh this page
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={async () => {
                      try {
                        const portoConnector = connectors.find((c) => c.id === "xyz.ithaca.porto");
                        if (portoConnector) {
                          await connect({ connector: portoConnector });
                        }
                      } catch (error) {
                        console.error("Connection error:", error);
                      }
                    }}
                    className="w-full"
                  >
                    Connect Wallet
                  </Button>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-600">✓ Connected</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </p>
                  {chain && (
                    <p className="text-xs text-gray-500">
                      Chain: {chain.name} ({chain.id})
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => {
                    disconnect();
                  }}
                  variant="secondary"
                  size="sm"
                >
                  Disconnect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Permissions */}
        {isConnected && permissions.length > 0 && (
          <ActivePermissions
            permissions={permissions.map(p => ({
              id: p.id,
              key: {
                publicKey: p.key.publicKey,
                type: p.key.type,
              },
              expiry: p.expiry,
              permissions: p.permissions ? {
                calls: p.permissions.calls ? p.permissions.calls.map(c => ({
                  to: c.to as string | undefined,
                  signature: c.signature as string | undefined,
                })) : undefined,
                spend: p.permissions.spend ? p.permissions.spend.map(s => ({
                  limit: s.limit.toString(),
                  period: s.period as string,
                  token: s.token as string | undefined,
                })) : undefined,
              } : undefined,
            }))}
            onRevoke={revokePermission}
            backendKeyAddress={backendKeyAddress}
          />
        )}

        {/* Step 2: Permission Configuration */}
        {isConnected && (
          <Card className={!hasGrantedPermissions ? 'border-blue-500' : ''}>
            <CardHeader>
              <h2 className="text-xl font-semibold">2. Configure Bot Permissions</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Select which actions the bot can perform on your behalf
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {!hasGrantedPermissions ? (
                <>
                  {/* Function Calls */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">Allowed Functions</h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleAll("calls", true)}
                        >
                          Select All
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleAll("calls", false)}
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {PERMISSION_ITEMS.calls.map(item => (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCalls.includes(item.id)}
                            onChange={() => handleCallToggle(item.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="flex-1">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Spending Limits */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">Spending Limits</h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleAll("spend", true)}
                        >
                          Select All
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleAll("spend", false)}
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {PERMISSION_ITEMS.spend.map(item => (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSpend.includes(item.id)}
                            onChange={() => handleSpendToggle(item.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="flex-1">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Expiry */}
                  <div>
                    <h3 className="font-medium mb-3">Permission Expiry</h3>
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
                  </div>

                  <Button
                    onClick={handleGrantPermissions}
                    disabled={isGranting || (selectedCalls.length === 0 && selectedSpend.length === 0)}
                    className="w-full"
                  >
                    {isGranting ? "Granting..." : "Grant Permissions"}
                  </Button>

                  {error && !success && (
                    <p className="text-red-500 text-sm mt-2">{error}</p>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-green-600 font-medium">✓ Permissions Granted</p>
                  <p className="text-sm text-gray-600 mt-2">
                    Bot has permission to perform selected actions
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Telegram Connection */}
        {isConnected && hasGrantedPermissions && (
          <Card className={!telegramUser ? 'border-blue-500' : ''}>
            <CardHeader>
              <h2 className="text-xl font-semibold">3. Connect Telegram Account</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Link your Telegram account to use the bot
              </p>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {!telegramUser ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Click the button below to authorize with Telegram
                  </p>
                  <TelegramVerification
                    onVerified={handleTelegramVerified}
                  />
                </>
              ) : (
                <div className="text-center">
                  <p className="text-green-600 font-medium">✓ Telegram Connected</p>
                  <p className="text-sm text-gray-600 mt-2">
                    {telegramUser.first_name} {telegramUser.last_name}
                    {telegramUser.username && ` (@${telegramUser.username})`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Success */}
        {success && telegramUser && (
          <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg text-center">
            <h3 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">
              🎉 Setup Complete!
            </h3>
            <p className="text-green-700 dark:text-green-300 mb-4">
              Your wallet is now linked to your Telegram account.
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              You can now use the bot by messaging{" "}
              <a 
                href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                @{process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME}
              </a>{" "}
              on Telegram
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h3 className="font-medium mb-2">How it works:</h3>
          <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700 dark:text-gray-300">
            <li>Connect your RISE wallet to identify yourself</li>
            <li>Grant specific permissions to the bot (transfers, swaps, etc.)</li>
            <li>Link your Telegram account for authentication</li>
            <li>Use natural language commands in Telegram to execute transactions</li>
          </ol>
        </div>

        {/* Backend Key Info */}
        <div className="text-xs text-gray-500 text-center">
          Bot EOA: {backendKeyAddress}
        </div>
      </div>
    </main>
  );
}