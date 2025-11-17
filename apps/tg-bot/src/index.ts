import "dotenv/config";
import express from "express";
import { Telegraf } from "telegraf";
import cors from "cors";
import { registerPermissionRoutes } from "./routes/permissions.js";
// import { createLlmRouter } from "./llm/router.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

async function main() {
  const app = express();
  app.use(express.json());
  app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000"
  }));

  // Register HTTP routes used by frontend
  registerPermissionRoutes(app);

  // LLM router (OpenRouter) - to be implemented
  // const llmRouter = createLlmRouter();

  // Telegram bot
  const bot = new Telegraf(BOT_TOKEN);

  bot.start(async (ctx) => {
    await ctx.reply(
      "Welcome to RISE Wallet Bot! 🚀\n\n" +
      "To get started:\n" +
      "1. Link your wallet using /link\n" +
      "2. Then you can ask me to check balances or send transactions\n\n" +
      "Examples:\n" +
      "- 'What's my RISE balance?'\n" +
      "- 'Send 0.1 RISE to 0x123...'\n" +
      "- 'Send 10 USDC to alice.eth'"
    );
  });

  bot.command("link", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const linkUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}?telegram_id=${telegramId}`;
    
    await ctx.reply(
      `To link your wallet, please visit:\n\n${linkUrl}\n\n` +
      "Sign in with your wallet and grant permissions for the bot to act on your behalf."
    );
  });

  bot.on("text", async (ctx) => {
    const userText = ctx.message.text;
    const telegramId = ctx.from.id.toString();

    // Check if user has linked their wallet
    try {
      const response = await fetch(`http://localhost:${process.env.PORT || 4000}/api/users/by-telegram/${telegramId}`);
      if (!response.ok) {
        await ctx.reply(
          "Please link your wallet first using /link command."
        );
        return;
      }

      // TODO: Implement LLM routing
      await ctx.reply(
        "I received your message. Natural language processing is coming soon! 🚧"
      );
    } catch (error) {
      console.error("Error processing message:", error);
      await ctx.reply("Sorry, I encountered an error. Please try again later.");
    }
  });

  // Start HTTP server
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`HTTP API listening on ${port}`);
  });

  // Start bot
  bot.launch();
  console.log("Telegram bot launched");

  // Enable graceful stop
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});