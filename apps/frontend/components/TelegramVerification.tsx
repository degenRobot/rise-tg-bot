"use client";

import { useState, useEffect } from "react";
import { useSignMessage, useAccount } from "wagmi";
import { Button } from "./Button";
import { toHex } from "viem";
import { portoConnector } from "../config/wagmi";

interface TelegramVerificationProps {
  onVerified: (telegramHandle: string) => void;
}

export function TelegramVerification({ onVerified }: TelegramVerificationProps) {
  const [telegramHandle, setTelegramHandle] = useState("");
  const [telegramId, setTelegramId] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [idFromUrl, setIdFromUrl] = useState(false);
  const [useManualSign, setUseManualSign] = useState(false);
  const { address, connector } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // Extract telegram ID from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('telegram_id');
    if (id) {
      setTelegramId(id);
      setIdFromUrl(true);
    }
  }, []);

  const handleVerify = async () => {
    if (!telegramHandle || !address || !telegramId) return;

    setIsVerifying(true);
    setError("");
    setSuccess(false);
    
    try {
      // Clean up the handle - remove @ if present
      const cleanHandle = telegramHandle.replace(/^@/, "");
      
      // Step 1: Get verification message from backend
      const messageResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8008'}/api/verify/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId,
          telegramHandle: cleanHandle,
        }),
      });
      
      if (!messageResponse.ok) {
        const errorData = await messageResponse.json();
        throw new Error(errorData.error || 'Failed to get verification message');
      }
      
      const { message, data } = await messageResponse.json();
      
      console.log("Got message from backend:", message);
      
      // Step 2: Sign the message
      let signature: string;
      
      try {
        if (useManualSign && connector?.name === "Porto") {
          // Try using Porto provider directly (debug mode)
          const provider = (portoConnector as any)._provider || (window as any).porto?.provider;
          
          if (!provider) {
            throw new Error("Porto provider not available.");
          }
          
          const hexMessage = toHex(message);
          
          signature = await provider.request({
            method: 'personal_sign',
            params: [hexMessage, address],
          });
        } else {
          // Use standard wagmi approach
          signature = await signMessageAsync({ message });
        }
      } catch (signError: any) {
        if (signError?.message?.includes("User rejected") || signError?.message?.includes("User denied")) {
          throw new Error("Signing rejected by user");
        }
        throw new Error(`Failed to sign message: ${signError?.message || 'Unknown error'}`);
      }
      
      // Step 3: Submit signature to backend for verification
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8008'}/api/verify/signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          signature,
          message,
          telegramId,
          telegramHandle: cleanHandle,
        }),
      });
      
      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.error || 'Verification failed');
      }
      
      const result = await verifyResponse.json();
      
      if (result.success) {
        setSuccess(true);
        onVerified(cleanHandle);
      } else {
        throw new Error(result.error || 'Verification failed');
      }
      
    } catch (error: any) {
      console.error("Verification error:", error);
      setError(error.message || "Failed to verify account");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="w-full space-y-5">
      {!address ? (
        <div className="text-sm text-[var(--muted)] text-center">
          Please connect your wallet to continue.
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {/* Telegram ID Input - only show if not provided in URL */}
            {!idFromUrl && (
              <div className="space-y-1.5">
                <label htmlFor="telegram-id" className="block text-sm font-medium text-[var(--foreground)]">
                  Telegram ID
                </label>
                <input
                  id="telegram-id"
                  type="text"
                  placeholder="e.g. 123456789"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <p className="text-xs text-[var(--muted)]">
                  Get your ID from @userinfobot on Telegram if needed
                </p>
              </div>
            )}

            {/* Telegram Handle Input */}
            <div className="space-y-1.5">
              <label htmlFor="telegram-handle" className="block text-sm font-medium text-[var(--foreground)]">
                Telegram Username
              </label>
              <div className="relative">
                <span className="absolute left-4 top-2.5 text-gray-400">@</span>
                <input
                  id="telegram-handle"
                  type="text"
                  placeholder="username"
                  value={telegramHandle}
                  onChange={(e) => setTelegramHandle(e.target.value.replace(/^@/, ""))}
                  className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
          </div>


          {/* Verify Button */}
          <Button
            onClick={handleVerify}
            disabled={!telegramHandle || !telegramId || !address || isVerifying}
            className="w-full py-3 text-lg"
            size="lg"
            isLoading={isVerifying}
          >
            {isVerifying ? "Verifying..." : "Sign & Verify"}
          </Button>
          
          <p className="text-xs text-[var(--muted)] text-center max-w-xs mx-auto leading-relaxed">
            You will be asked to sign a message to prove ownership of your wallet. No transaction fee required.
          </p>

          {error && (
            <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Successfully verified!
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
