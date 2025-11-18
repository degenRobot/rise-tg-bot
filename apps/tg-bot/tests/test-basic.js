// Simple test to verify our backend wallet services work
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

console.log("🧪 Testing basic backend wallet functionality...");

try {
  console.log("1️⃣ Testing service imports...");
  
  // Test if we can import our services
  const { backendTransactionService } = await import('./src/services/backendTransactionService.js');
  console.log("✅ Transaction service imported");
  
  const { backendSwapService } = await import('./src/services/backendSwapService.js');
  console.log("✅ Swap service imported");
  
  console.log("2️⃣ Testing service initialization...");
  
  // Test service info
  const transactionInfo = backendTransactionService.getInfo();
  console.log("✅ Transaction service info:", transactionInfo);
  
  const swapInfo = backendSwapService.getInfo();
  console.log("✅ Swap service info:", swapInfo);
  
  console.log("3️⃣ Testing token configuration...");
  const tokens = backendSwapService.getTokens();
  console.log("✅ Available tokens:", Object.keys(tokens));
  
  console.log("✅ All basic tests passed!");
  
} catch (error) {
  console.error("❌ Test failed:", error.message);
  console.error("Stack:", error.stack);
}