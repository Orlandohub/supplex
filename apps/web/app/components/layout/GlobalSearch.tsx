/**
 * Global Search Component
 * Placeholder for future search functionality (Phase 2)
 */

import { Search } from "lucide-react";
import { useState } from "react";

export function GlobalSearch() {
  const [isFocused, setIsFocused] = useState(false);

  // Detect OS for keyboard shortcut display
  const isMac =
    typeof window !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shortcutKey = isMac ? "⌘K" : "Ctrl+K";

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Search suppliers, documents..."
          disabled
          className="w-full pl-10 pr-20 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-md
            text-neutral-900 placeholder:text-neutral-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150"
          aria-label="Search"
          aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-medium text-neutral-500 bg-white border border-neutral-200 rounded">
            {shortcutKey}
          </kbd>
        </div>
      </div>

      {/* Tooltip shown when disabled input is interacted with */}
      {isFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-white border border-neutral-200 rounded-md shadow-lg z-50">
          <p className="text-sm text-neutral-600">
            🚧 Search coming in Phase 2
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            Full-text search across suppliers, documents, and more.
          </p>
        </div>
      )}
    </div>
  );
}
