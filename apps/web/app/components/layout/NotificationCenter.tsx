/**
 * Notification Center Component
 * Placeholder for future notifications feature (Phase 2)
 */

import { Bell } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Placeholder notification count (will be dynamic in Phase 2)
  const notificationCount = 0;

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close menu on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-md text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          transition-colors duration-150"
        aria-label="Notifications"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" />

        {/* Notification Badge */}
        {notificationCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600 text-white text-xs font-medium items-center justify-center">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-900">
              Notifications
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">Phase 2 feature</p>
          </div>

          {/* Empty State */}
          <div className="p-8 text-center">
            <Bell className="h-12 w-12 mx-auto text-neutral-300 mb-3" />
            <p className="text-sm font-medium text-neutral-900">
              No notifications yet
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Notification system coming in Phase 2
            </p>
          </div>

          {/* Footer (for Phase 2) */}
          <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50">
            <button
              disabled
              className="text-xs text-neutral-400 hover:text-neutral-600 font-medium cursor-not-allowed"
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
