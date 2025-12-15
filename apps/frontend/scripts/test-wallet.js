// Simple test to check if RISE wallet is available
console.log("Testing RISE Wallet availability...");

// Check if we're running in a browser-like environment
if (typeof window !== 'undefined') {
  console.log("Window object available");
  console.log("Window.ethereum:", window.ethereum);
  console.log("Window.rise:", window.rise);
} else {
  console.log("Not in browser environment");
}

// Check Porto import
try {
  const { Porto } = await import('rise-wallet');
  console.log("Porto imported successfully");
  console.log("Porto.defaultConfig:", Porto.defaultConfig);
} catch (error) {
  console.error("Failed to import Porto:", error);
}

// Check wagmi porto connector
try {
  console.log("Porto wagmi connector imported successfully");
} catch (error) {
  console.error("Failed to import porto wagmi connector:", error);
}