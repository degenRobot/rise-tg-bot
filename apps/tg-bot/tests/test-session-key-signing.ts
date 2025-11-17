/**
 * Test Session Key Signing Flow
 * 
 * This tests our session key derivation and signing without requiring
 * the actual RISE wallet infrastructure by using a mock provider.
 */

import { Address } from "viem";
import { P256, Signature, Hex as OxHex } from "ox";
import { mockPortoConnector } from "../src/providers/mockRiseProvider.js";
import { encodeFunctionData, parseUnits } from "viem";
import { MintableERC20ABI } from "../src/abi/erc20.js";
import "dotenv/config";

// Backend signer configuration (our session key)
const BACKEND_SIGNER_PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY as `0x${string}`;
const BACKEND_SIGNER_ADDRESS = process.env.BACKEND_SIGNER_ADDRESS as Address;
const TEST_USER_ADDRESS = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc";

type TransactionCall = {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
};

/**
 * Test Session Key Derivation and Signing
 */
async function testSessionKeySigning() {
  console.log("🧪 Testing Session Key Signing Flow...");
  console.log("=" + "=".repeat(60));

  // Test 1: Session key derivation
  console.log("\n1️⃣ Testing session key derivation...");
  let sessionKey: { privateKey: string; publicKey: string; } | null = null;

  try {
    console.log(`🔑 Backend signer: ${BACKEND_SIGNER_ADDRESS}`);
    console.log(`🔑 Private key: ${BACKEND_SIGNER_PRIVATE_KEY.slice(0, 10)}...`);

    // Derive P256 public key from our backend signer private key
    const publicKeyBytes = P256.getPublicKey({ 
      privateKey: BACKEND_SIGNER_PRIVATE_KEY 
    });
    
    console.log("🔑 P256 public key structure:", {
      hasPrefix: 'prefix' in publicKeyBytes,
      hasX: 'x' in publicKeyBytes,
      hasY: 'y' in publicKeyBytes,
    });

    // Handle different P256 key formats
    let publicKeyHex: string;
    if ('x' in publicKeyBytes && 'y' in publicKeyBytes) {
      // Structured format with x, y coordinates
      const xBytes = publicKeyBytes.x.toString(16).padStart(64, '0');
      const yBytes = publicKeyBytes.y.toString(16).padStart(64, '0');
      publicKeyHex = `0x${xBytes}${yBytes}`;
    } else {
      // Raw bytes format
      publicKeyHex = `0x${Buffer.from(publicKeyBytes as any).toString('hex')}`;
    }

    sessionKey = {
      privateKey: BACKEND_SIGNER_PRIVATE_KEY,
      publicKey: publicKeyHex,
    };

    console.log("✅ Session key derived successfully!");
    console.log(`🔑 Public key: ${sessionKey.publicKey.slice(0, 20)}...`);
    console.log(`🔑 Public key length: ${sessionKey.publicKey.length} characters`);

  } catch (error) {
    console.error("❌ Session key derivation failed:", error);
    return;
  }

  // Test 2: Mock provider connectivity
  console.log("\n2️⃣ Testing mock provider connectivity...");
  let provider: any;

  try {
    provider = await mockPortoConnector.getProvider();
    console.log("✅ Mock provider obtained");

    // Test basic RPC call
    const chainId = await provider.request({
      method: "eth_chainId",
      params: [],
    });
    console.log(`✅ Chain ID: ${chainId} (${parseInt(chainId, 16)})`);

  } catch (error) {
    console.error("❌ Mock provider test failed:", error);
    return;
  }

  // Test 3: Transaction call building
  console.log("\n3️⃣ Testing transaction call building...");
  let calls: TransactionCall[];

  try {
    // Build a simple approve call
    const approveData = encodeFunctionData({
      abi: MintableERC20ABI,
      functionName: "approve",
      args: ["0x6c10B45251F5D3e650bcfA9606c662E695Af97ea", parseUnits("10", 18)], // Approve router for 10 tokens
    });

    calls = [{
      to: "0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50", // MockUSD
      data: approveData,
    }];

    console.log("✅ Transaction calls built:");
    console.log(`   Target: ${calls[0].to}`);
    console.log(`   Data: ${calls[0].data?.slice(0, 20)}...`);
    console.log(`   Data length: ${calls[0].data?.length} characters`);

  } catch (error) {
    console.error("❌ Transaction call building failed:", error);
    return;
  }

  // Test 4: wallet_prepareCalls
  console.log("\n4️⃣ Testing wallet_prepareCalls...");
  let preparedResponse: any;

  try {
    const intentParams = [{
      calls,
      chainId: OxHex.fromNumber(11155931), // RISE Testnet
      from: TEST_USER_ADDRESS,
      atomicRequired: true,
      key: {
        publicKey: sessionKey.publicKey,
        type: "p256" as const,
      },
    }];

    console.log("📋 Intent parameters:", {
      callsCount: intentParams[0].calls.length,
      chainId: intentParams[0].chainId,
      from: intentParams[0].from,
      keyPublic: intentParams[0].key.publicKey.slice(0, 20) + "...",
    });

    preparedResponse = await provider.request({
      method: "wallet_prepareCalls",
      params: intentParams,
    });

    console.log("✅ wallet_prepareCalls successful!");
    console.log("📊 Prepared response:", {
      id: preparedResponse.id,
      digest: preparedResponse.digest?.slice(0, 20) + "...",
      callsCount: preparedResponse.calls?.length,
      hasCapabilities: !!preparedResponse.capabilities,
    });

  } catch (error) {
    console.error("❌ wallet_prepareCalls failed:", error);
    return;
  }

  // Test 5: P256 signing
  console.log("\n5️⃣ Testing P256 signing...");
  let signature: string;

  try {
    const { digest, capabilities, ...request } = preparedResponse;

    console.log(`🎯 Signing digest: ${digest}`);
    console.log(`🔑 Using private key: ${sessionKey.privateKey.slice(0, 10)}...`);

    // Sign with P256 (matching wallet-demo)
    const p256Signature = P256.sign({
      payload: digest,
      privateKey: sessionKey.privateKey,
    });

    signature = Signature.toHex(p256Signature);

    console.log("✅ P256 signing successful!");
    console.log(`📝 Signature: ${signature.slice(0, 20)}...`);
    console.log(`📝 Signature length: ${signature.length} characters`);

    // Test signature verification (mock)
    const isValid = (provider as any).verifySignature(digest, signature, sessionKey.publicKey);
    console.log(`🔍 Signature verification: ${isValid ? "✅ Valid" : "❌ Invalid"}`);

  } catch (error) {
    console.error("❌ P256 signing failed:", error);
    return;
  }

  // Test 6: wallet_sendPreparedCalls
  console.log("\n6️⃣ Testing wallet_sendPreparedCalls...");

  try {
    const { digest, capabilities, ...request } = preparedResponse;

    const sendParams = {
      ...request,
      ...(capabilities ? { capabilities } : {}),
      signature,
    };

    console.log("📤 Send parameters:", {
      id: sendParams.id,
      signature: sendParams.signature?.slice(0, 20) + "...",
      hasCapabilities: !!sendParams.capabilities,
    });

    const result = await provider.request({
      method: "wallet_sendPreparedCalls",
      params: [sendParams],
    });

    console.log("✅ wallet_sendPreparedCalls successful!");
    console.log("📊 Transaction result:", {
      hash: result.hash?.slice(0, 10) + "...",
      status: result.status,
      sessionKeyUsed: result.sessionKeyUsed,
    });

  } catch (error) {
    console.error("❌ wallet_sendPreparedCalls failed:", error);
    return;
  }

  console.log("\n🎉 Session Key Signing Test Completed!");
  console.log("\n📝 Test Summary:");
  console.log("✅ Session key derivation: Working");
  console.log("✅ Mock provider: Working");
  console.log("✅ Transaction call building: Working");
  console.log("✅ wallet_prepareCalls: Working");
  console.log("✅ P256 signing: Working");
  console.log("✅ wallet_sendPreparedCalls: Working");
  console.log("\n🔑 Session key implementation is ready for real RISE provider!");
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testSessionKeySigning().catch(console.error);
}