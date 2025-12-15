/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useBackendPermissions } from "../hooks/useBackendPermissions";
import { Chains } from "rise-wallet";
import { DEFAULT_SELECTIONS, PERMISSION_ITEMS } from "../config/permissions";
import { Card, CardHeader, CardContent } from "../components/Card";
import { Button } from "../components/Button";
import { ActivePermissions } from "../components/ActivePermissions";
import { TelegramVerification } from "../components/TelegramVerification";
import { PermissionSelector } from "../components/PermissionSelector";

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
    const backendKey = process.env.NEXT_PUBLIC_BACKEND_KEY_ADDRESS || "0x038AEBDbDEcd7F4604Fd6902b40BE063e5fc3f7B";

    setMounted(true);
        setBackendKeyAddress(backendKey);
  }, []);

  
  const {
    permissions,
    isGranting,
    grantPermissions,
    revokePermission
  } = useBackendPermissions({ backendKeyAddress });

  
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
  
  const handleToggleAll = (type: "calls" | "spend", value: boolean) => {
    const items = PERMISSION_ITEMS[type].map(item => item.id);
    if (type === "calls") {
      setSelectedCalls(value ? items : []);
    } else {
      setSelectedSpend(value ? items : []);
    }
  };
  
  const handleGrantPermissions = async () => {
    try {
      setError("");
      setSuccess(false);
      
      // Check if we're on the correct chain
      if (chain?.id !== Chains.riseTestnet.id) {
        console.log("Switching to RISE testnet...");
        await switchChain({ chainId: Chains.riseTestnet.id });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const expirySeconds = expiryDays * 24 * 60 * 60;
      await grantPermissions(
        { calls: selectedCalls, spend: selectedSpend },
        expirySeconds
      );
      
      setHasGrantedPermissions(true);
      setSuccess(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Determine current step
  const [currentStep, setCurrentStep] = useState(1);
  
  useEffect(() => {
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

  if (!mounted) {
    return null; // Return null or skeletal loader
  }

  return (
    <main className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            RISE Telegram Bot
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Connect your wallet and link your Telegram account to start using the bot for transactions.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center w-full max-w-sm mx-auto mb-8">
          {[1, 2, 3].map((step) => {
            const isActive = currentStep >= step;
            const isCompleted = currentStep > step;
            
            return (
              <div key={step} className="flex items-center w-full last:w-auto">
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full font-medium text-sm transition-all duration-300
                  ${isActive ? "bg-purple-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}
                `}>
                  {isCompleted ? "✓" : step}
                </div>
                {step < 3 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors duration-300 ${isActive && currentStep > step ? "bg-purple-600" : "bg-gray-200 dark:bg-gray-800"}`} />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Step 1: Wallet Connection */}
        <Card className={`transition-all duration-300 ${currentStep === 1 ? "border-purple-500/50" : ""}`}>
          <CardHeader>
            <h2 className="text-lg font-semibold">Connect Wallet</h2>
          </CardHeader>
          <CardContent>
            {!isConnected ? (
              <div className="space-y-6 text-center py-2">
                <p className="text-sm text-muted-foreground">
                  Connect your RISE Smart Wallet to get started.
                </p>
                {/* Debug info */}
                <div className="text-xs text-muted-foreground mb-2">
                  Detected {connectors.length} connector(s)
                </div>
                {connectors.length === 0 ? (
                  <a
                    href="https://chromewebstore.google.com/detail/rise-wallet/hbbplkfdlpkdgclapcfmkdfohjfgcokj"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block w-full sm:w-auto"
                  >
                    <Button size="lg" className="w-full sm:w-auto">
                      Install RISE Wallet
                    </Button>
                  </a>
                ) : (
                  <Button
                    onClick={async () => {
                      const connectorInfo = connectors.map(c => ({ 
                        id: c.id, 
                        name: c.name,
                        type: c.type,
                        icon: c.icon
                      }));
                      console.log("Available connectors:", connectorInfo);
                      
                      // The risewallet connector should be available
                      const riseConnector = connectors[0]; // Since we only configured one connector
                      if (riseConnector) {
                        console.log("Connecting with:", riseConnector.name, riseConnector.id);
                        await connect({ connector: riseConnector });
                      } else {
                        console.error("No connectors available. Make sure RISE Wallet extension is installed.");
                        // Check if window.ethereum exists
                        console.log("window.ethereum:", typeof window !== 'undefined' && (window as { ethereum?: unknown }).ethereum ? "exists" : "not found");
                      }
                    }}
                    size="lg"
                    className="w-full sm:w-auto min-w-50"
                  >
                    Connect RISE Wallet
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <div>
                    <p className="font-medium text-foreground">Connected</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => disconnect()}
                  variant="outline"
                  size="sm"
                  className="border-green-200 hover:bg-green-100 text-green-800 dark:border-green-800 dark:hover:bg-green-900/50 dark:text-green-200"
                >
                  Disconnect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Permissions Display */}
        {isConnected && permissions.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
          </div>
        )}

        {/* Step 2: Permission Configuration */}
        {isConnected && (
          <Card className={`transition-all duration-300 ${currentStep === 2 ? "border-purple-500/50" : ""}`}>
            <CardHeader>
              <div>
                <h2 className="text-lg font-semibold">Grant Permissions</h2>
                {!hasGrantedPermissions && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Authorize the bot to act on your behalf
                  </p>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              {!hasGrantedPermissions ? (
                <div className="space-y-8">
                  <PermissionSelector
                    selectedCalls={selectedCalls}
                    selectedSpend={selectedSpend}
                    onCallToggle={handleCallToggle}
                    onSpendToggle={handleSpendToggle}
                    onToggleAll={handleToggleAll}
                    expiryDays={expiryDays}
                    setExpiryDays={setExpiryDays}
                  />

                  <div className="pt-4">
                    <Button
                      onClick={handleGrantPermissions}
                      disabled={isGranting || (selectedCalls.length === 0 && selectedSpend.length === 0)}
                      className="w-full"
                      size="default"
                      isLoading={isGranting}
                    >
                      {isGranting ? "Granting Permissions..." : "Grant Permissions"}
                    </Button>
                    {error && !success && (
                      <p className="text-red-500 text-sm mt-3 text-center">
                        {error}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-purple-50/30 dark:bg-purple-900/10 rounded-lg">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-600 dark:text-purple-400">✓</div>
                  <p className="text-foreground font-medium">Permissions Granted</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Bot has permission to perform selected actions
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Telegram Connection */}
        {isConnected && hasGrantedPermissions && (
          <Card className={`transition-all duration-300 ${currentStep === 3 ? "border-purple-500/50" : ""}`}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-medium text-sm ${telegramUser ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
                  {telegramUser ? "✓" : "3"}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Link Telegram</h2>
                  {!telegramUser && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Verify ownership of your Telegram account
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {!telegramUser ? (
                <TelegramVerification onVerified={handleTelegramVerified} />
              ) : (
                <div className="text-center py-6 bg-purple-50/30 dark:bg-purple-900/10 rounded-lg w-full">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-600 dark:text-purple-400">✓</div>
                  <p className="text-foreground font-medium">Telegram Connected</p>
                  <p className="text-sm text-muted-foreground mt-1">
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
          <div className="animate-in zoom-in-95 duration-500 bg-purple-50/30 dark:bg-purple-900/10 p-8 rounded-2xl text-center">
            <h3 className="text-xl font-bold text-foreground mb-3">
              You&apos;re All Set!
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Your wallet is now linked to your Telegram account. You can close this window and start using the bot.
            </p>
            <a 
              href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              Open Telegram Bot
              <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}

        {/* Footer Info */}
        <div className="pt-8 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-xs text-(--muted) font-mono">
            {/* Bot EOA: {backendKeyAddress} */}
          </p>
        </div>
      </div>
    </main>
  );
}
