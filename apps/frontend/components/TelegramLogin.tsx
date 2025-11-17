"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface TelegramLoginProps {
  botName: string;
  onAuth: (user: any) => void;
  buttonSize?: "large" | "medium" | "small";
}

export function TelegramLogin({ botName, onAuth, buttonSize = "large" }: TelegramLoginProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set the callback on window
    (window as any).onTelegramAuth = onAuth;
  }, [onAuth]);

  useEffect(() => {
    if (containerRef.current && botName && botName !== "your_bot_name") {
      // Clear any existing content
      containerRef.current.innerHTML = "";
      
      // Create the Telegram login widget
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.setAttribute("data-telegram-login", botName);
      script.setAttribute("data-size", buttonSize);
      script.setAttribute("data-onauth", "onTelegramAuth(user)");
      script.setAttribute("data-request-access", "write");
      script.async = true;
      
      containerRef.current.appendChild(script);
    }
  }, [botName, buttonSize]);

  if (!botName || botName === "your_bot_name") {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          Telegram bot name not configured. Please set NEXT_PUBLIC_TELEGRAM_BOT_NAME in your .env.local file.
        </p>
      </div>
    );
  }

  return (
    <>
      <Script src="https://telegram.org/js/telegram-widget.js?22" />
      <div ref={containerRef} />
    </>
  );
}