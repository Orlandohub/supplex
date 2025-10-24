/**
 * Top Navigation Component
 * Contains logo, global search, notifications, and user menu
 */

import { useNavigationStore } from "~/stores/navigationStore";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationCenter } from "./NotificationCenter";
import { UserMenu } from "~/components/auth/UserMenu";
import { cn } from "~/lib/utils";
import { Menu } from "lucide-react";

export function TopNavigation() {
  const { isSidebarCollapsed, toggleSidebar } = useNavigationStore();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 shadow-sm">
      <div className="flex h-16 items-center px-4 gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-md text-neutral-700 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Mobile Logo (shown when sidebar is hidden) */}
        <div className="flex items-center lg:hidden">
          <div className="bg-blue-600 text-white rounded-lg p-2">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
          </div>
          <span className="ml-2 text-lg font-semibold text-neutral-900">
            Supplex
          </span>
        </div>

        {/* Spacer - pushes content to account for sidebar */}
        <div
          className={cn(
            "hidden lg:block transition-all duration-200",
            isSidebarCollapsed ? "w-16" : "w-64"
          )}
        />

        {/* Global Search */}
        <div className="flex-1 max-w-2xl">
          <GlobalSearch />
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
