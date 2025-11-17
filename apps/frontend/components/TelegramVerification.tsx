"use client";

import { useState, useEffect } from "react";
import { useSignMessage, useAccount } from "wagmi";
import { Card, CardHeader, CardContent } from "./Card";
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
      console.log("Message data:", data);
      
      // Step 2: Sign the message
      console.log("Requesting signature from wallet...");
      console.log("Using manual sign:", useManualSign);
      let signature: string;
      
      try {
        if (useManualSign && connector?.name === "Porto") {
          // Try using Porto provider directly (like in playground)
          console.log("Using Porto provider directly...");
          const provider = (portoConnector as any)._provider || (window as any).porto?.provider;
          
          if (!provider) {
            throw new Error("Porto provider not available. Please ensure wallet is connected.");
          }
          
          const hexMessage = toHex(message);
          console.log("Hex message:", hexMessage.substring(0, 20) + "...");
          
          signature = await provider.request({
            method: 'personal_sign',
            params: [hexMessage, address],
          });
          console.log("Got signature from Porto provider:", signature);
        } else {
          // Use standard wagmi approach
          signature = await signMessageAsync({ message });
          console.log("Got signature from wagmi:", signature);
        }
        
        console.log("Signature length:", signature?.length);
        console.log("Signature preview:", signature?.substring(0, 20) + "...");
      } catch (signError: any) {
        console.error("Signing error:", signError);
        if (signError?.message?.includes("User rejected") || signError?.message?.includes("User denied")) {
          throw new Error("Signing rejected by user");
        }
        throw new Error(`Failed to sign message: ${signError?.message || 'Unknown error'}`);
      }
      
      // Validate signature format - allow both EOA (132 chars) and smart wallet (longer) signatures
      if (!signature || signature.length < 132) {
        console.error("Invalid signature format:", {
          signature,
          length: signature?.length,
          minimumExpected: 132,
          allZeros: signature?.match(/^0x0+$/) !== null
        });
        
        if (signature?.match(/^0x0+$/)) {
          throw new Error("Wallet returned invalid signature (all zeros). Please try again or check wallet support.");
        }
        
        throw new Error("Invalid signature received from wallet");
      }
      
      // Log signature type and provide user feedback
      if (signature.length === 132) {
        console.log("Standard EOA signature detected (132 chars)");
      } else if (signature.length > 1000) {
        console.log(`RISE smart wallet signature detected (${signature.length} chars)`);
        console.log("This will be verified using smart wallet verification");
        console.log("✅ Complex signature format accepted - this is expected for RISE wallet");
      } else {
        console.log(`Intermediate signature detected (${signature.length} chars)`);
      }
      
      // Step 3: Submit signature to backend for verification
      console.log("Sending to backend:", {
        address,
        signature: signature.substring(0, 20) + "...",
        telegramId,
        telegramHandle: cleanHandle
      });
      
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
        // Call the parent callback
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
    <div className="space-y-4">
      {!address ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Please connect your wallet to continue.
        </div>
      ) : (
        <>
          {/* Telegram ID Input - only show if not provided in URL */}
          {!idFromUrl && (
            <div>
              <label htmlFor="telegram-id" className="block text-sm font-medium mb-2">
                Enter your Telegram ID
              </label>
              <input
                id="telegram-id"
                type="text"
                placeholder="123456789"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Get your ID by messaging @userinfobot on Telegram
              </p>
            </div>
          )}

          {/* Telegram Handle Input */}
          <div>
            <label htmlFor="telegram-handle" className="block text-sm font-medium mb-2">
              Enter your Telegram username
            </label>
            <input
              id="telegram-handle"
              type="text"
              placeholder="@yourusername"
              value={telegramHandle}
              onChange={(e) => setTelegramHandle(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          {/* Sign Mode Toggle */}
          {connector?.name === "Porto" && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                id="manual-sign"
                checked={useManualSign}
                onChange={(e) => setUseManualSign(e.target.checked)}
              />
              <label htmlFor="manual-sign" className="text-gray-600 dark:text-gray-400">
                Use Porto provider directly (debug mode)
              </label>
            </div>
          )}

          {/* Verify Button */}
          <Button
            onClick={handleVerify}
            disabled={!telegramHandle || !telegramId || !address || isVerifying}
            className="w-full"
          >
            {isVerifying ? "Signing & Verifying..." : "Sign & Verify"}
          </Button>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            You'll sign a message to prove ownership of this Telegram account and wallet
          </p>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
              <p className="text-sm text-green-600 dark:text-green-400">
                ✅ Account successfully verified! You can now use the bot.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}