import * as React from "react";
import { cn } from "../lib/utils";

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, onChange, disabled, label, ...props }, ref) => {
    return (
      <label className={cn("flex items-center cursor-pointer", disabled && "cursor-not-allowed", className)}>
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only"
            ref={ref}
            checked={checked}
            onChange={(e) => {
              onCheckedChange?.(e.target.checked);
              onChange?.(e);
            }}
            disabled={disabled}
            {...props}
          />
          <div
            className={cn(
              "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
              checked ? "bg-primary" : "bg-input"
            )}
          >
            <div
              className={cn(
                "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                checked ? "translate-x-4" : "translate-x-0"
              )}
            />
          </div>
        </div>
        {label && (
          <span className={cn("ml-3 text-sm font-medium", disabled && "opacity-50")}>
            {label}
          </span>
        )}
      </label>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };