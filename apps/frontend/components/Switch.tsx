interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function Switch({ checked, onChange, disabled = false, label }: SwitchProps) {
  return (
    <label className="flex items-center cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <div className={`
          block w-12 h-6 rounded-full transition-colors
          ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}>
          <div className={`
            absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-0'}
          `} />
        </div>
      </div>
      {label && (
        <span className={`ml-3 text-sm font-medium text-gray-900 dark:text-gray-100 ${disabled ? 'opacity-50' : ''}`}>
          {label}
        </span>
      )}
    </label>
  );
}