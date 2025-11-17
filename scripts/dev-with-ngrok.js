#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkNgrokInstalled() {
  try {
    execSync('which ngrok', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function isNgrokRunning() {
  try {
    const response = await fetch('http://localhost:4040/api/tunnels');
    const data = await response.json();
    return data.tunnels && data.tunnels.length > 0;
  } catch {
    return false;
  }
}

async function getNgrokUrl() {
  try {
    const response = await fetch('http://localhost:4040/api/tunnels');
    const data = await response.json();
    const httpsUrl = data.tunnels.find(t => t.proto === 'https')?.public_url;
    return httpsUrl;
  } catch {
    return null;
  }
}

async function startNgrok() {
  return new Promise((resolve) => {
    log('\n🔗 Starting ngrok tunnel...', colors.yellow);
    
    const ngrok = spawn('ngrok', ['http', 'https://localhost:3000'], {
      detached: true,
      stdio: 'ignore'
    });
    
    ngrok.unref();
    
    // Wait for ngrok to start
    setTimeout(async () => {
      const url = await getNgrokUrl();
      if (url) {
        log(`✅ Ngrok tunnel established: ${url}`, colors.green);
        
        // Save ngrok URL to frontend env file
        const envPath = path.join(__dirname, '../apps/frontend/.env.local');
        try {
          let envContent = fs.readFileSync(envPath, 'utf8');
          
          // Update or add NEXT_PUBLIC_NGROK_URL
          if (envContent.includes('NEXT_PUBLIC_NGROK_URL=')) {
            envContent = envContent.replace(/NEXT_PUBLIC_NGROK_URL=.*/g, `NEXT_PUBLIC_NGROK_URL=${url}`);
          } else {
            envContent += `\n\n# Auto-generated ngrok URL\nNEXT_PUBLIC_NGROK_URL=${url}`;
          }
          
          fs.writeFileSync(envPath, envContent);
          log(`📝 Updated .env.local with ngrok URL`, colors.green);
        } catch (error) {
          log(`⚠️  Could not update .env.local: ${error.message}`, colors.yellow);
        }
        
        log(`\n📋 To complete Telegram setup:`, colors.bright);
        log(`   1. Message @BotFather on Telegram`, colors.blue);
        log(`   2. Send: /setdomain`, colors.blue);
        log(`   3. Select: @risechain_bot`, colors.blue);
        log(`   4. Enter: ${url.replace('https://', '')}`, colors.blue);
        resolve(url);
      } else {
        log('⚠️  Ngrok started but URL not available yet', colors.yellow);
        resolve(null);
      }
    }, 3000);
  });
}

async function main() {
  // Check if ngrok is installed
  if (!await checkNgrokInstalled()) {
    log('\n❌ ngrok is not installed!', colors.red);
    log('Please install it first:', colors.yellow);
    log('  brew install ngrok  # macOS', colors.blue);
    log('  or visit https://ngrok.com/download', colors.blue);
    process.exit(1);
  }

  // Check if ngrok is already running
  const alreadyRunning = await isNgrokRunning();
  if (alreadyRunning) {
    const url = await getNgrokUrl();
    log(`\n✅ Ngrok already running at: ${url}`, colors.green);
  } else {
    await startNgrok();
  }

  log('\n🚀 Starting development servers...', colors.bright);
  log('   Frontend: http://localhost:3000', colors.blue);
  log('   Bot API: http://localhost:8008', colors.green);
  log('\n📡 Services:', colors.bright);
  log('   • Frontend (Next.js) - Wallet linking UI', colors.blue);
  log('   • Bot (Express + Telegraf) - Telegram integration', colors.green);
  log('\n💡 Tips:', colors.yellow);
  log('   • Both services will run simultaneously', colors.reset);
  log('   • Logs are prefixed with [frontend] and [bot]', colors.reset);
  log('   • Press Ctrl+C to stop both services', colors.reset);
  log('\n' + '─'.repeat(60) + '\n', colors.reset);
  
  // Start the regular dev command
  const devProcess = spawn('pnpm', ['run', 'dev:all'], {
    stdio: 'inherit',
    shell: true
  });

  // Handle process termination
  process.on('SIGINT', () => {
    log('\n\n🛑 Stopping development servers...', colors.yellow);
    devProcess.kill();
    
    // Also kill ngrok if we started it
    try {
      execSync('pkill ngrok', { stdio: 'ignore' });
      log('✅ Ngrok stopped', colors.green);
    } catch {
      // Ignore if ngrok wasn't running
    }
    
    log('👋 Goodbye!', colors.green);
    process.exit();
  });

  devProcess.on('exit', (code) => {
    process.exit(code);
  });
}

main().catch(console.error);