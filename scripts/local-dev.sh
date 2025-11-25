#!/bin/bash

# RISE TG Bot Local Development Setup Script
# This script helps you run the full system locally for testing

set -e

echo "🚀 RISE TG Bot Local Development Setup"
echo "====================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check dependencies
check_dependency() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed${NC}"
        echo "Please install $1 to continue"
        exit 1
    else
        echo -e "${GREEN}✓ $1 found${NC}"
    fi
}

echo -e "\n${YELLOW}Checking dependencies...${NC}"
check_dependency node
check_dependency pnpm

# Function to create required directories
setup_directories() {
    echo -e "\n${YELLOW}Setting up data directories...${NC}"
    mkdir -p apps/tg-bot/data/{verified-links,permissions,conversations,messages,tool-executions,backups}
    echo -e "${GREEN}✓ Data directories created${NC}"
}

# Function to check environment variables
check_env() {
    echo -e "\n${YELLOW}Checking environment variables...${NC}"
    
    if [ ! -f .env ]; then
        echo -e "${RED}❌ .env file not found in root directory${NC}"
        echo "Creating example .env file..."
        cat > .env.example << EOF
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_BOT_NAME=your_bot_name

# Backend Signer
BACKEND_SIGNER_PRIVATE_KEY=0x...
BACKEND_SIGNER_ADDRESS=0x038AEBDbDEcd7F4604Fd6902b40BE063e5fc3f7B

# RISE RPC
RISE_RPC_URL=https://testnet.riselabs.xyz

# OpenRouter API (for LLM)
OPENROUTER_API_KEY=sk-or-v1-...

# Server Port
PORT=4000

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Data Directory (for file storage)
DATA_DIR=./data

# Points API
POINTS_API_URL=https://points-api.marble.live

# Token Addresses
MOCK_USD_ADDRESS=0x044b54e85D3ba9ae376Aeb00eBD09F21421f7f50
MOCK_TOKEN_ADDRESS=0x6166a6e02b4CF0e1E0397082De1B4fc9CC9D6ceD

# UniswapV2 Contracts
UNISWAP_FACTORY_ADDRESS=0xf6A86076ce8e9A2ff628CD3a728FcC5876FA70C6
UNISWAP_ROUTER_ADDRESS=0x6c10B45251F5D3e650bcfA9606c662E695Af97ea
UNISWAP_PAIR_ADDRESS=0xf8da515e51e5B1293c2430d406aE41E6e5B9C992
EOF
        echo -e "${YELLOW}Please copy .env.example to .env and fill in your values${NC}"
        exit 1
    fi
    
    # Check critical env vars
    source .env
    
    if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
        echo -e "${YELLOW}⚠️  TELEGRAM_BOT_TOKEN not set - bot won't connect to Telegram${NC}"
    fi
    
    if [ -z "$OPENROUTER_API_KEY" ]; then
        echo -e "${YELLOW}⚠️  OPENROUTER_API_KEY not set - LLM features won't work${NC}"
    fi
    
    echo -e "${GREEN}✓ Environment variables checked${NC}"
}

# Function to install dependencies
install_deps() {
    echo -e "\n${YELLOW}Installing dependencies...${NC}"
    pnpm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Function to run tests
run_tests() {
    echo -e "\n${YELLOW}Running tests...${NC}"
    cd apps/tg-bot
    
    # Run tool tests
    echo "Testing tools..."
    pnpm tsx test-tools.ts
    
    # Run E2E tests
    echo -e "\nRunning E2E tests..."
    pnpm tsx test-e2e.ts
    
    cd ../..
    echo -e "${GREEN}✓ Tests completed${NC}"
}

# Function to start services
start_services() {
    echo -e "\n${YELLOW}Starting services...${NC}"
    
    # Check if ports are free
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}❌ Port 3000 is already in use${NC}"
        echo "Please stop the service using port 3000"
        exit 1
    fi
    
    if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}❌ Port 4000 is already in use${NC}"
        echo "Please stop the service using port 4000"
        exit 1
    fi
    
    echo -e "${GREEN}Starting services in separate terminals...${NC}"
    
    # Start bot/backend
    osascript -e 'tell app "Terminal" to do script "cd '$(pwd)' && pnpm dev:tg-bot"' 2>/dev/null || \
    gnome-terminal -- bash -c "cd $(pwd) && pnpm dev:tg-bot; exec bash" 2>/dev/null || \
    xterm -e "cd $(pwd) && pnpm dev:tg-bot" &
    
    echo "✓ Started TG Bot backend on port 4000"
    
    # Wait a bit for backend to start
    sleep 3
    
    # Start frontend
    osascript -e 'tell app "Terminal" to do script "cd '$(pwd)' && pnpm dev:frontend"' 2>/dev/null || \
    gnome-terminal -- bash -c "cd $(pwd) && pnpm dev:frontend; exec bash" 2>/dev/null || \
    xterm -e "cd $(pwd) && pnpm dev:frontend" &
    
    echo "✓ Started Frontend on port 3000"
    
    echo -e "\n${GREEN}Services started!${NC}"
    echo -e "\nYou can now:"
    echo "1. Open http://localhost:3000 to access the frontend"
    echo "2. Chat with your bot on Telegram"
    echo "3. Check the logs in the terminal windows"
}

# Function to show usage instructions
show_usage() {
    echo -e "\n${GREEN}Local Development Setup Complete!${NC}"
    echo "================================"
    echo -e "\n${YELLOW}Testing the full flow:${NC}"
    echo "1. Open Telegram and message your bot (/start)"
    echo "2. Use /link to get the verification URL"
    echo "3. Open the URL, connect your wallet, and sign the verification"
    echo "4. Grant permissions to the bot"
    echo "5. Try commands like:"
    echo "   - 'What's my balance?'"
    echo "   - 'Send 10 MockUSD to 0x...'"
    echo "   - 'Swap 5 MockUSD for MockToken'"
    echo -e "\n${YELLOW}Monitoring:${NC}"
    echo "- Bot logs: Check the bot terminal"
    echo "- Frontend logs: Check the frontend terminal"
    echo "- Data files: Check apps/tg-bot/data/"
    echo -e "\n${YELLOW}Stopping services:${NC}"
    echo "Press Ctrl+C in each terminal window"
}

# Main menu
echo -e "\n${YELLOW}What would you like to do?${NC}"
echo "1. Full setup (install deps, setup dirs, run tests, start services)"
echo "2. Just start services"
echo "3. Just run tests"
echo "4. Setup directories only"
echo "5. Check environment"

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        check_env
        setup_directories
        install_deps
        run_tests
        start_services
        show_usage
        ;;
    2)
        check_env
        start_services
        show_usage
        ;;
    3)
        check_env
        run_tests
        ;;
    4)
        setup_directories
        ;;
    5)
        check_env
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}Done!${NC}"