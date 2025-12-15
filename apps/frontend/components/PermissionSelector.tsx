import { PERMISSION_ITEMS } from "../config/permissions";
import { Button } from "./Button";

interface PermissionSelectorProps {
  selectedCalls: string[];
  selectedSpend: string[];
  onCallToggle: (id: string) => void;
  onSpendToggle: (id: string) => void;
  onToggleAll: (type: "calls" | "spend", value: boolean) => void;
  expiryDays: number;
  setExpiryDays: (days: number) => void;
}

export function PermissionSelector({
  selectedCalls,
  selectedSpend,
  onCallToggle,
  onSpendToggle,
  onToggleAll,
  expiryDays,
  setExpiryDays,
}: PermissionSelectorProps) {
  return (
    <div className="space-y-8">
      {/* Function Calls Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-(--foreground)">Function Permissions</h3>
            <p className="text-sm text-muted-foreground">Select which actions the bot can perform</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => onToggleAll("calls", true)}>
              All
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onToggleAll("calls", false)}>
              None
            </Button>
          </div>
        </div>
        
        <div className="grid gap-3 sm:grid-cols-2">
          {PERMISSION_ITEMS.calls.map((item) => {
            const isSelected = selectedCalls.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => onCallToggle(item.id)}
                className={`
                  group flex items-center p-4 rounded-xl border cursor-pointer transition-all duration-200
                  ${isSelected 
                    ? "bg-purple-50/50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 shadow-sm" 
                    : "bg-background border-border hover:border-purple-300 dark:hover:border-purple-700"}
                `}
              >
                <div className={`
                  shrink-0 w-5 h-5 rounded-full border flex items-center justify-center mr-3 transition-colors
                  ${isSelected
                    ? "bg-purple-600 border-purple-600"
                    : "border-gray-300 dark:border-gray-600 group-hover:border-purple-400"}
                `}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`font-medium ${isSelected ? "text-purple-900 dark:text-purple-100" : "text-foreground"}`}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spending Limits Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-(--foreground)">Spending Limits</h3>
            <p className="text-sm text-muted-foreground">Define token allowance limits</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => onToggleAll("spend", true)}>
              All
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onToggleAll("spend", false)}>
              None
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {PERMISSION_ITEMS.spend.map((item) => {
            const isSelected = selectedSpend.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => onSpendToggle(item.id)}
                className={`
                  group flex items-center p-4 rounded-xl border cursor-pointer transition-all duration-200
                  ${isSelected 
                    ? "bg-purple-50/50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 shadow-sm" 
                    : "bg-background border-border hover:border-purple-300 dark:hover:border-purple-700"}
                `}
              >
                <div className={`
                  shrink-0 w-5 h-5 rounded-full border flex items-center justify-center mr-3 transition-colors
                  ${isSelected
                    ? "bg-purple-600 border-purple-600"
                    : "border-gray-300 dark:border-gray-600 group-hover:border-purple-400"}
                `}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`font-medium ${isSelected ? "text-purple-900 dark:text-purple-100" : "text-foreground"}`}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expiry Section */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center gap-4">
          <h3 className="font-medium text-foreground">Session Expiry</h3>
          <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-purple-500">
            <input
              type="number"
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              min={1}
              max={365}
              className="w-12 bg-transparent border-none outline-none text-center font-medium"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </div>
      </div>
    </div>
  );
}

