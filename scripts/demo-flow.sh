#!/bin/bash

echo "🚀 RISE Telegram Bot - Demo Flow"
echo "================================"
echo ""
echo "This demo will show you how the complete flow works."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check services
echo -e "${BLUE}Step 1: Checking services...${NC}"
if curl -s http://localhost:8008/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Bot API is running on port 8008${NC}"
else
    echo -e "${YELLOW}⚠ Bot API is not running. Start it with: pnpm dev${NC}"
    exit 1
fi

# Step 2: Simulate telegram link
TELEGRAM_ID="123456789"
echo -e "\n${BLUE}Step 2: Simulating Telegram /link command${NC}"
echo -e "The bot would send you this link:"
echo -e "${GREEN}http://localhost:3000?telegram_id=${TELEGRAM_ID}${NC}"

# Step 3: Check link status
echo -e "\n${BLUE}Step 3: Checking if Telegram ID is already linked...${NC}"
STATUS=$(curl -s http://localhost:8008/api/verify/status/${TELEGRAM_ID})
LINKED=$(echo $STATUS | jq -r '.linked')

if [ "$LINKED" = "true" ]; then
    echo -e "${YELLOW}This Telegram ID is already linked to:${NC}"
    echo $STATUS | jq '.'
else
    echo -e "${GREEN}✓ Not linked yet (ready for verification)${NC}"
fi

# Step 4: Instructions
echo -e "\n${BLUE}Step 4: Complete the flow${NC}"
echo "1. Open your browser and go to:"
echo -e "   ${GREEN}http://localhost:3000?telegram_id=${TELEGRAM_ID}${NC}"
echo ""
echo "2. Connect your RISE wallet"
echo ""
echo "3. Grant permissions to the bot"
echo ""
echo "4. Enter your Telegram username (e.g., @yourusername)"
echo ""
echo "5. Sign the verification message"
echo ""

echo -e "\n${BLUE}Step 5: After verification${NC}"
echo "You can test with the bot using commands like:"
echo "- 'what's my balance'"
echo "- 'show my MockUSD balance'"
echo "- 'send 10 MockUSD to 0x...'"
echo "- 'swap 50 MockUSD for MockToken'"

echo -e "\n${BLUE}Useful Commands:${NC}"
echo "- Check link status: curl http://localhost:8008/api/verify/status/${TELEGRAM_ID} | jq"
echo "- View all test scripts: ls apps/tg-bot/test*.ts"
echo "- Run API tests: cd apps/tg-bot && npx tsx test-api-endpoints.ts"

echo -e "\n${GREEN}✓ Demo setup complete!${NC}"