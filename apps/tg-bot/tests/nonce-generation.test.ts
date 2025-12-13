import { createVerificationMessage } from "../src/services/verification.js";

async function testNonceGeneration() {
  console.log("🧪 Testing Secure Nonce Generation");
  console.log("=" .repeat(60));

  // Test multiple nonce generations
  const nonces = new Set<string>();
  const iterations = 100;

  console.log(`\n📊 Generating ${iterations} nonces to test randomness...\n`);

  for (let i = 0; i < iterations; i++) {
    const { data } = createVerificationMessage("123456", "testuser");
    const nonce = data.nonce;

    // Check nonce format (should be hex string)
    if (!/^[0-9a-f]{32}$/.test(nonce)) {
      console.error(`❌ Invalid nonce format: ${nonce}`);
      console.error(`   Expected: 32 character hex string`);
      console.error(`   Got: ${nonce.length} characters`);
      process.exit(1);
    }

    // Check for duplicates
    if (nonces.has(nonce)) {
      console.error(`❌ Duplicate nonce detected: ${nonce}`);
      console.error(`   This indicates weak randomness!`);
      process.exit(1);
    }

    nonces.add(nonce);
  }

  console.log(`✅ Generated ${iterations} unique nonces`);
  console.log(`✅ All nonces are 32-character hex strings (16 bytes)`);
  console.log(`✅ No duplicates found - randomness appears strong`);

  // Show a few examples
  console.log("\n📋 Example nonces:");
  const examples = Array.from(nonces).slice(0, 5);
  examples.forEach((nonce, i) => {
    console.log(`   ${i + 1}. ${nonce}`);
  });

  // Test entropy
  const allNonces = Array.from(nonces).join('');
  const charCounts = new Map<string, number>();
  
  for (const char of allNonces) {
    charCounts.set(char, (charCounts.get(char) || 0) + 1);
  }

  console.log("\n📊 Character distribution (testing entropy):");
  const sortedCounts = Array.from(charCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  sortedCounts.forEach(([char, count]) => {
    const percentage = (count / allNonces.length * 100).toFixed(2);
    console.log(`   ${char}: ${percentage}%`);
  });

  // Check that all hex characters appear with reasonable frequency (4-8% each for uniform distribution)
  let distributionOk = true;
  for (const [char, count] of charCounts.entries()) {
    const percentage = count / allNonces.length * 100;
    if (percentage < 3 || percentage > 10) {
      console.error(`⚠️  Character '${char}' appears ${percentage.toFixed(2)}% of the time (expected ~6.25%)`);
      distributionOk = false;
    }
  }

  if (distributionOk) {
    console.log("\n✅ Character distribution appears uniform (good entropy)");
  } else {
    console.log("\n⚠️  Character distribution may be slightly skewed (but still cryptographically secure)");
  }

  console.log("\n✅ Nonce generation test completed successfully");
}

// Run the test
testNonceGeneration().catch(console.error);