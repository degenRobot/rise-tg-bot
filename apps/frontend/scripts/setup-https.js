#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const certsDir = path.join(__dirname, '..', 'certs');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir);
}

const keyPath = path.join(certsDir, 'localhost-key.pem');
const certPath = path.join(certsDir, 'localhost.pem');

console.log('🔧 Setting up trusted SSL certificates for localhost...');

try {
  // First, check if mkcert is installed globally
  try {
    execSync('which mkcert', { stdio: 'pipe' });
    console.log('✅ mkcert found globally');
  } catch {
    console.log('📦 Installing mkcert globally...');
    console.log('ℹ️  This requires admin privileges to install the local CA');
    
    // Try to install mkcert based on the platform
    const platform = process.platform;
    
    if (platform === 'darwin') {
      // macOS
      try {
        execSync('brew install mkcert', { stdio: 'inherit' });
      } catch {
        console.error('❌ Failed to install mkcert via brew');
        console.log('Please install mkcert manually:');
        console.log('   brew install mkcert');
        process.exit(1);
      }
    } else if (platform === 'win32') {
      // Windows
      try {
        execSync('choco install mkcert', { stdio: 'inherit' });
      } catch {
        console.error('❌ Failed to install mkcert via chocolatey');
        console.log('Please install mkcert manually:');
        console.log('   choco install mkcert');
        console.log('   or download from: https://github.com/FiloSottile/mkcert/releases');
        process.exit(1);
      }
    } else {
      // Linux
      console.log('Please install mkcert manually for your distribution:');
      console.log('   https://github.com/FiloSottile/mkcert#linux');
      process.exit(1);
    }
  }

  // Install the local CA if it hasn't been done
  console.log('🔐 Installing local Certificate Authority...');
  try {
    execSync('mkcert -install', { stdio: 'inherit' });
  } catch (error) {
    console.error(`❌ Error: ${error} `);
  }

  // Remove existing certificates to regenerate them
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath);
  }
  if (fs.existsSync(certPath)) {
    fs.unlinkSync(certPath);
  }

  // Generate new trusted certificates
  console.log('🔑 Generating trusted certificates...');
  execSync(`mkcert -key-file "${keyPath}" -cert-file "${certPath}" localhost 127.0.0.1 ::1`, { 
    stdio: 'inherit'
  });

  console.log('✅ Trusted SSL certificates generated successfully!');
  console.log(`🔑 Key: ${keyPath}`);
  console.log(`📜 Cert: ${certPath}`);
  console.log('🌐 Your browser should now trust https://localhost:3000');
  
} catch (error) {
  console.error('❌ Failed to generate SSL certificates:', error.message);
  console.log('\n🔧 Manual setup instructions:');
  console.log('1. Install mkcert:');
  console.log('   macOS: brew install mkcert');
  console.log('   Windows: choco install mkcert');
  console.log('   Linux: https://github.com/FiloSottile/mkcert#linux');
  console.log('2. Install local CA: mkcert -install');
  console.log('3. Generate certs: mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1');
  process.exit(1);
}