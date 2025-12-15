"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Button } from "../../components/Button";
import { Card, CardHeader, CardContent } from "../../components/Card";
import { toHex, recoverMessageAddress } from "viem";
import { portoConnector } from "../../config/wagmi";

type TestResult = {
  name: string;
  message: string;
  signature?: string;
  length?: number;
  isValid?: boolean;
  testMode?: string;
  error?: string;
  errorDetails?: {
    code?: unknown;
    data?: unknown;
    stack?: string;
  };
};

export default function TestSigning() {
  const { address, isConnected, connector } = useAccount();
  const { signMessageAsync, isPending } = useSignMessage();
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string>("");
  const [testMode, setTestMode] = useState<'string' | 'hex'>('string');

  // eslint-disable-next-line react-hooks/purity
  const timestamp = Date.now();
  const testMessages = [
    { name: "Simple", message: "Hello World" },
    { name: "Numbers only", message: "123456789" },
    { name: "Single char", message: "A" },
    { name: "With newlines", message: "Line 1\nLine 2\nLine 3" },
    { name: "Long message", message: "A".repeat(500) },
    { name: "Special chars", message: "Test @user (ID: 123) - Special: !@#$%^&*()" },
    { name: "Bot message", message: `RISE Telegram Bot Verification

I am linking my wallet to Telegram account @testuser (ID: 123456789)

Timestamp: ${timestamp}
Nonce: testNonce123

This signature proves I control this wallet and authorize the RISE bot to execute transactions on my behalf.` },
    { name: "Empty message", message: "" },
    { name: "Just spaces", message: "   " }
  ];

  const testSign = async (message: string, name: string) => {
    setError("");
    setResult(null);
    
    try {
      console.log(`\n=== Testing: ${name} (${testMode} mode) ===`);
      console.log("Connector:", connector?.name);
      console.log("Message:", message);
      console.log("Message length:", message.length);
      
      // Log wallet state
      if (connector?.name === "Porto") {
        console.log("Porto connector state:", {
          hasProvider: !!(portoConnector as { _provider?: unknown })._provider,
          connectorName: connector.name
        });
      }
      
      const messageToSign = testMode === 'hex' ? toHex(message) : message;
      console.log("Message to sign:", testMode === 'hex' ? `0x${messageToSign.slice(2, 10)}...` : messageToSign);
      
      const signature = await signMessageAsync({
        message: messageToSign
      });
      
      console.log("=== Signature Analysis ===");
      console.log("Full signature:", signature);
      console.log("Length:", signature?.length);
      console.log("Format checks:");
      console.log("- Starts with 0x:", signature?.startsWith("0x"));
      console.log("- Is all zeros:", /^0x0+$/.test(signature || ""));
      console.log("- Is valid hex:", /^0x[0-9a-fA-F]+$/.test(signature || ""));
      console.log("- First 10 chars:", signature?.substring(0, 10));
      console.log("- Last 10 chars:", signature?.substring(signature.length - 10));
      
      // Try to verify the signature
      if (signature && !/^0x0+$/.test(signature)) {
        try {
          const recoveredAddress = await recoverMessageAddress({
            message,
            signature: signature as `0x${string}`
          });
          console.log("Recovered address:", recoveredAddress);
          console.log("Expected address:", address);
          console.log("Match:", recoveredAddress.toLowerCase() === address?.toLowerCase());
        } catch (recoverError) {
          console.error("Recovery error:", recoverError);
        }
      }
      
      setResult({
        name,
        message,
        signature,
        length: signature?.length,
        isValid: signature?.length === 132 && signature.startsWith("0x") && !/^0x0+$/.test(signature),
        testMode
      });
    } catch (err) {
      console.error("Full error object:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      const errorCode = (err as { code?: unknown }).code;
      const errorData = (err as { data?: unknown }).data;

      console.error("Error stack:", errorStack);
      console.error("Error code:", errorCode);
      console.error("Error data:", errorData);

      setError(errorMessage);
      setResult({
        name,
        message,
        error: errorMessage,
        errorDetails: {
          code: errorCode,
          data: errorData,
          stack: errorStack
        }
      });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="max-w-4xl w-full space-y-6">
        <h1 className="text-3xl font-bold mb-8">Test Message Signing</h1>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Wallet Status</h2>
          </CardHeader>
          <CardContent>
            <p>Connected: {isConnected ? "✅ Yes" : "❌ No"}</p>
            <p>Address: {address || "Not connected"}</p>
          </CardContent>
        </Card>

        {isConnected && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Test Signing</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="string"
                    checked={testMode === 'string'}
                    onChange={(e) => setTestMode(e.target.value as 'string' | 'hex')}
                  />
                  String Mode (Default)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="hex"
                    checked={testMode === 'hex'}
                    onChange={(e) => setTestMode(e.target.value as 'string' | 'hex')}
                  />
                  Hex Mode (Porto-style)
                </label>
              </div>
              {testMessages.map((test, index) => (
                <div key={index}>
                  <Button
                    onClick={() => testSign(test.message, test.name)}
                    disabled={isPending}
                    className="w-full"
                  >
                    Test: {test.name}
                  </Button>
                </div>
              ))}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded">
                  <p className="text-red-600 dark:text-red-400 font-semibold">Error:</p>
                  <pre className="text-sm">{error}</pre>
                </div>
              )}

              {result && (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded space-y-2">
                  <h3 className="font-semibold">Result: {result.name}</h3>
                  {result.error ? (
                    <div>
                      <p className="text-red-600">Error: {result.error}</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="font-medium">Message:</p>
                        <pre className="text-xs bg-white dark:bg-gray-700 p-2 rounded overflow-x-auto">
                          {result.message}
                        </pre>
                      </div>
                      <div>
                        <p className="font-medium">Signature:</p>
                        <pre className="text-xs bg-white dark:bg-gray-700 p-2 rounded overflow-x-auto break-all">
                          {result.signature}
                        </pre>
                      </div>
                      <div>
                        <p>Length: {result.length} chars</p>
                        <p>Valid: {result.isValid ? "✅ Yes" : "❌ No"}</p>
                        <p>Mode: {result.testMode}</p>
                      </div>
                      {result.errorDetails && (
                        <div className="mt-2">
                          <p className="font-medium">Error Details:</p>
                          <pre className="text-xs bg-white dark:bg-gray-700 p-2 rounded overflow-x-auto">
                            {JSON.stringify(result.errorDetails, null, 2)}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}