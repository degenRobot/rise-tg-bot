"use client";

import { useEffect, useState } from "react";

export default function DebugPage() {
  const [urlParams, setUrlParams] = useState<Record<string, string>>({});
  const [windowLocation, setWindowLocation] = useState("");

  useEffect(() => {
    // Get URL params
    const params = new URLSearchParams(window.location.search);
    const paramsObj: Record<string, string> = {};
    params.forEach((value, key) => {
      paramsObj[key] = value;
    });
    setUrlParams(paramsObj);
    setWindowLocation(window.location.href);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Page</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold">Current URL:</h2>
          <code className="bg-gray-100 p-2 block rounded">{windowLocation}</code>
        </div>

        <div>
          <h2 className="font-semibold">URL Parameters:</h2>
          {Object.keys(urlParams).length > 0 ? (
            <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(urlParams, null, 2)}</pre>
          ) : (
            <p>No URL parameters found</p>
          )}
        </div>

        <div>
          <h2 className="font-semibold">Telegram ID:</h2>
          <p className="bg-gray-100 p-2 rounded">
            {urlParams.telegram_id || "Not found"}
          </p>
        </div>

        <div className="mt-8">
          <h2 className="font-semibold">Test Links:</h2>
          <ul className="space-y-2">
            <li>
              <a href="/debug?telegram_id=123456789" className="text-blue-500 underline">
                Test with telegram_id=123456789
              </a>
            </li>
            <li>
              <a href="/?telegram_id=123456789" className="text-blue-500 underline">
                Main page with telegram_id=123456789
              </a>
            </li>
            <li>
              <a href="/debug" className="text-blue-500 underline">
                Debug page without params
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}