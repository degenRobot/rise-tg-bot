#!/bin/bash

echo "🔗 Setting up Telegram Bot Domain for Local Development"
echo ""
echo "This script will help you set up your Telegram bot domain using ngrok."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Please install it first:"
    echo "   brew install ngrok  # macOS"
    echo "   or visit https://ngrok.com/download"
    exit 1
fi

echo "✅ ngrok is installed"
echo ""
echo "📋 Instructions:"
echo "1. Make sure your frontend is running at https://localhost:3000"
echo "2. Run the following command in a new terminal:"
echo ""
echo "   ngrok http https://localhost:3000"
echo ""
echo "3. Copy the HTTPS URL that ngrok provides (e.g., https://abc123.ngrok-free.app)"
echo ""
echo "4. Message @BotFather on Telegram and send:"
echo "   /setdomain"
echo "   @risechain_bot"
echo "   [your-ngrok-url]"
echo ""
echo "5. Once done, the Telegram login widget will work!"
echo ""
echo "Note: The ngrok URL changes each time you restart it. For production, use a permanent domain."