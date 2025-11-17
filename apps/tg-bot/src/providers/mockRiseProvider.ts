import { Address } from "viem";
import { P256, Signature, Hex as OxHex } from "ox";

/**
 * Mock RISE Provider for Testing
 * 
 * This simulates the porto connector provider.request() calls
 * to test our session key signing flow without requiring
 * the actual RISE wallet infrastructure.
 */
export class MockRiseProvider {
  private chainId = 11155931; // RISE Testnet

  /**
   * Mock implementation of provider.request()
   * Simulates wallet_prepareCalls and wallet_sendPreparedCalls
   */
  async request({ method, params }: { method: string; params: any[] }): Promise<any> {
    console.log(`🎭 Mock provider handling: ${method}`);
    console.log(`📋 Mock params:`, params);

    switch (method) {
      case "wallet_prepareCalls":
        return this.mockPrepareCalls(params[0]);
      
      case "wallet_sendPreparedCalls":
        return this.mockSendPreparedCalls(params[0]);
      
      case "eth_chainId":
        return `0x${this.chainId.toString(16)}`;
      
      default:
        throw new Error(`Mock provider: Unsupported method ${method}`);
    }
  }

  /**
   * Mock wallet_prepareCalls
   * Returns a realistic response with digest and capabilities
   */
  private async mockPrepareCalls(intentParams: any): Promise<any> {
    console.log("🎭 Mock wallet_prepareCalls:", {
      calls: intentParams.calls?.length,
      from: intentParams.from,
      chainId: intentParams.chainId,
      key: intentParams.key?.publicKey?.slice(0, 20) + "...",
    });

    // Simulate digest generation (this would be done by RISE wallet infrastructure)
    const digestInput = JSON.stringify({
      calls: intentParams.calls,
      chainId: intentParams.chainId,
      from: intentParams.from,
      nonce: Date.now(),
    });
    
    // Create a realistic digest (32 bytes hex)
    const digest = `0x${Buffer.from(digestInput).toString('hex').slice(0, 64).padEnd(64, '0')}`;

    // Mock response matching wallet-demo format
    const mockResponse = {
      digest,
      id: `mock-${Date.now()}`,
      batchCallHash: `0x${Buffer.from(`batch-${Date.now()}`).toString('hex').slice(0, 64).padEnd(64, '0')}`,
      calls: intentParams.calls,
      capabilities: {
        atomicBatch: true,
        paymasterService: {
          supported: true,
          url: "https://testnet.riselabs.xyz/paymaster"
        }
      }
    };

    console.log("✅ Mock prepared calls response:", {
      digest: mockResponse.digest.slice(0, 20) + "...",
      id: mockResponse.id,
      callsCount: mockResponse.calls.length,
    });

    return mockResponse;
  }

  /**
   * Mock wallet_sendPreparedCalls
   * Simulates transaction submission and returns hash
   */
  private async mockSendPreparedCalls(request: any): Promise<any> {
    console.log("🎭 Mock wallet_sendPreparedCalls:", {
      id: request.id,
      signature: request.signature?.slice(0, 20) + "...",
      callsCount: request.calls?.length,
      hasCapabilities: !!request.capabilities,
    });

    // Simulate transaction hash
    const txHash = `0x${Buffer.from(`tx-${Date.now()}-${Math.random()}`).toString('hex').slice(0, 64).padEnd(64, '0')}`;

    const mockResult = {
      hash: txHash,
      transactionHash: txHash, // Some responses use this field
      status: "pending",
      blockNumber: null,
      gasUsed: "0", // Gas sponsored by RISE
      from: request.from || "0x0000000000000000000000000000000000000000",
      nonce: Date.now(),
      sessionKeyUsed: true,
      capabilities: request.capabilities,
    };

    console.log("✅ Mock transaction submitted:", {
      hash: mockResult.hash.slice(0, 10) + "...",
      status: mockResult.status,
      sessionKeyUsed: mockResult.sessionKeyUsed,
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return mockResult;
  }

  /**
   * Test signature verification
   * This helps us verify our P256 signing is working correctly
   */
  verifySignature(digest: string, signature: string, publicKey: string): boolean {
    try {
      console.log("🔍 Verifying signature:", {
        digest: digest.slice(0, 20) + "...",
        signature: signature.slice(0, 20) + "...",
        publicKey: publicKey.slice(0, 20) + "...",
      });

      // For mock purposes, we'll assume the signature is valid
      // In real implementation, this would use P256 verification
      const isValid = signature.length === 130; // 65 bytes hex = 130 chars
      
      console.log(isValid ? "✅ Signature verification passed" : "❌ Signature verification failed");
      return isValid;
    } catch (error) {
      console.error("❌ Signature verification error:", error);
      return false;
    }
  }
}

/**
 * Mock connector that provides the MockRiseProvider
 * This replaces porto connector for testing
 */
export class MockPortoConnector {
  private provider = new MockRiseProvider();

  async getProvider(): Promise<MockRiseProvider> {
    console.log("🎭 Mock porto connector providing mock provider");
    return this.provider;
  }

  get id() {
    return "mock.porto.connector";
  }

  get name() {
    return "Mock Porto Connector";
  }

  get type() {
    return "mock";
  }
}

// Export instance for testing
export const mockPortoConnector = new MockPortoConnector();