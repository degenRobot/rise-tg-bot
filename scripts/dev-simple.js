#!/usr/bin/env node

const { spawn } = require('child_process');

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

async function main() {
  log('\nRISE TG Bot - Development Mode', colors.bright);
  log('─'.repeat(40), colors.reset);
  
  log('\nStarting services:', colors.bright);
  log('   • Frontend (Next.js) on http://localhost:3000', colors.blue);
  log('   • Bot API (Express) on http://localhost:8008', colors.green);
  
  log('\nConfiguration:', colors.bright);
  log('   • Frontend URL: http://localhost:3000', colors.reset);
  log('   • Bot endpoint: http://localhost:8008', colors.reset);
  log('   • Data storage: ./apps/tg-bot/data/', colors.reset);
  
  log('\nTips:', colors.yellow);
  log('   • Logs are prefixed with [frontend] and [bot]', colors.reset);
  log('   • Press Ctrl+C to stop all services', colors.reset);
  log('   • Use "pnpm dev" for ngrok integration', colors.reset);
  
  log('\n' + '─'.repeat(40) + '\n', colors.reset);
  
  // Start both services
  const devProcess = spawn('pnpm', ['run', 'dev:all'], {
    stdio: 'inherit',
    shell: true
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('\n\nShutting down...', colors.yellow);
    devProcess.kill('SIGTERM');
    setTimeout(() => {
      log('All services stopped', colors.green);
      log('Goodbye!', colors.green);
      process.exit(0);
    }, 1000);
  });

  devProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      log(`\n Process exited with code ${code}`, colors.red);
    }
    process.exit(code);
  });
}

main().catch((error) => {
  log(`\n Error: ${error.message}`, colors.red);
  process.exit(1);
});