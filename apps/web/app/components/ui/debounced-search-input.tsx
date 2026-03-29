import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "~/lib/utils";

interface DebouncedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function DebouncedSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  debounceMs = 300,
  className,
}: DebouncedSearchInputProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  };

  const handleClear = () => {
    setLocalValue("");
    clearTimeout(timerRef.current);
    onChange("");
  };

  React.useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-9 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
