"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Card, CardHeader, CardContent } from "../../components/Card";
import { TelegramVerification } from "../../components/TelegramVerification";
import { GrantPermissions } from "../../components/GrantPermissions";

type SetupStep = "connect" | "verify" | "permissions" | "complete";

export default function SetupPage() {
  const { address, isConnected } = useAccount();
  const [backendKeyAddress, setBackendKeyAddress] = useState<string>("");
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [permissionsComplete, setPermissionsComplete] = useState(false);
  const [telegramDetails, setTelegramDetails] = useState<{
    handle: string;
    id?: string;
  } | null>(null);

  // Derive current step from state instead of storing it
  const currentStep: SetupStep = !isConnected
    ? "connect"
    : !verificationComplete
    ? "verify"
    : !permissionsComplete
    ? "permissions"
    : "complete";

  // Fetch backend configuration
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8008'}/api/permissions/config`);
        if (response.ok) {
          const config = await response.json();
          setBackendKeyAddress(config.backendKeyAddress);
        }
      } catch (error) {
        console.error("Failed to fetch backend config:", error);
      }
    };

    fetchConfig();
  }, []);

  const handleVerificationComplete = (telegramHandle: string) => {
    console.log("✅ Verification completed for:", telegramHandle);
    
    // Extract Telegram ID from URL if available
    const params = new URLSearchParams(window.location.search);
    const telegramId = params.get('telegram_id');
    
    setTelegramDetails({
      handle: telegramHandle,
      id: telegramId || undefined,
    });
    setVerificationComplete(true);
  };

  const handlePermissionsGranted = async (result: {
    success: boolean;
    expiry: number;
    sessionKey: string;
    permissionDetails?: {
      id: string;
      keyPublicKey: string;
      permissions: unknown;
    };
  }) => {
    if (result.success) {
      console.log("✅ Permissions granted:", result);
      
      // Sync permissions with backend including detailed permission data
      try {
        const syncData = {
          accountAddress: address,
          backendKeyAddress: result.sessionKey,
          expiry: result.expiry,
          telegramId: telegramDetails?.id,
          telegramUsername: telegramDetails?.handle,
          permissionDetails: result.permissionDetails,
        };

        console.log("📡 Sending permission sync with details:", syncData);

        const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8008'}/api/permissions/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(syncData),
        });

        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          console.log("✅ Permissions synced with backend:", syncResult);
          setPermissionsComplete(true);
        } else {
          console.error("Failed to sync permissions with backend:", await syncResponse.text());
        }
      } catch (error) {
        console.error("Error syncing permissions:", error);
      }
    }
  };

  const getStepStatus = (step: SetupStep) => {
    const currentIndex = ["connect", "verify", "permissions", "complete"].indexOf(currentStep);
    const stepIndex = ["connect", "verify", "permissions", "complete"].indexOf(step);
    
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "pending";
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">🤖 RISE Telegram Bot Setup</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Complete these steps to start using the RISE bot
          </p>
        </div>

        {/* Progress Steps */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Setup Progress</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className={`flex items-center gap-3 ${getStepStatus("connect") === "completed" ? "text-green-600" : getStepStatus("connect") === "current" ? "text-blue-600 font-semibold" : "text-gray-400"}`}>
                {getStepStatus("connect") === "completed" ? "✅" : getStepStatus("connect") === "current" ? "🔵" : "⚪"}
                <span>1. Connect Your RISE Wallet</span>
              </div>
              <div className={`flex items-center gap-3 ${getStepStatus("verify") === "completed" ? "text-green-600" : getStepStatus("verify") === "current" ? "text-blue-600 font-semibold" : "text-gray-400"}`}>
                {getStepStatus("verify") === "completed" ? "✅" : getStepStatus("verify") === "current" ? "🔵" : "⚪"}
                <span>2. Verify Telegram Account</span>
              </div>
              <div className={`flex items-center gap-3 ${getStepStatus("permissions") === "completed" ? "text-green-600" : getStepStatus("permissions") === "current" ? "text-blue-600 font-semibold" : "text-gray-400"}`}>
                {getStepStatus("permissions") === "completed" ? "✅" : getStepStatus("permissions") === "current" ? "🔵" : "⚪"}
                <span>3. Grant Bot Permissions</span>
              </div>
              <div className={`flex items-center gap-3 ${getStepStatus("complete") === "completed" ? "text-green-600" : getStepStatus("complete") === "current" ? "text-blue-600 font-semibold" : "text-gray-400"}`}>
                {getStepStatus("complete") === "completed" ? "✅" : getStepStatus("complete") === "current" ? "🔵" : "⚪"}
                <span>4. Setup Complete!</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        {currentStep === "connect" && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">💼 Connect Your Wallet</h2>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <p className="text-gray-600 dark:text-gray-400">
                  Please connect your RISE wallet to continue with the setup process.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    💡 Make sure you&apos;re using RISE Wallet 
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === "verify" && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🔐 Verify Telegram Account</h2>
            </CardHeader>
            <CardContent>
              <TelegramVerification onVerified={handleVerificationComplete} />
            </CardContent>
          </Card>
        )}

        {currentStep === "permissions" && backendKeyAddress && (
          <GrantPermissions 
            onGranted={handlePermissionsGranted}
            backendKeyAddress={backendKeyAddress}
          />
        )}

        {currentStep === "complete" && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🎉 Setup Complete!</h2>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                <p className="text-green-600 dark:text-green-400 font-semibold mb-2">
                  ✅ Your RISE Telegram Bot is ready to use!
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  You can now interact with the bot on Telegram to perform swaps, transfers, and other DeFi operations.
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="font-semibold">Next Steps:</p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>📱 Open Telegram and find your bot</li>
                  <li>💬 Send a message to start interacting</li>
                  <li>🔄 Try commands like &quot;swap 0.1 ETH to USDC&quot;</li>
                  <li>📊 Check your transaction history</li>
                </ul>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  <strong>Remember:</strong> Your permissions expire in 1 week and have daily spending limits. 
                  You can return here to extend or modify permissions at any time.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Info */}
        {process.env.NODE_ENV === "development" && (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-500">🔍 Debug Info</h2>
            </CardHeader>
            <CardContent className="text-xs text-gray-500 space-y-1">
              <p>Connected: {isConnected ? "✅" : "❌"}</p>
              <p>Address: {address || "None"}</p>
              <p>Backend Key: {backendKeyAddress || "Loading..."}</p>
              <p>Current Step: {currentStep}</p>
              <p>Verification: {verificationComplete ? "✅" : "❌"}</p>
              <p>Permissions: {permissionsComplete ? "✅" : "❌"}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}