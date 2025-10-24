/**
 * App Shell Component
 * Main layout wrapper with sidebar, top navigation, and content area
 */

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNavigation } from "./TopNavigation";
import { MobileNavigation } from "./MobileNavigation";
import { useNavigationStore } from "~/stores/navigationStore";
import { useKeyboardShortcuts } from "~/hooks/useKeyboardShortcuts";
import { cn } from "~/lib/utils";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isSidebarCollapsed } = useNavigationStore();

  // Enable global keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Skip to main content link (accessibility) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50
          px-4 py-2 bg-blue-600 text-white rounded-md font-medium
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Skip to main content
      </a>

      {/* Sidebar - Desktop only */}
      <Sidebar />

      {/* Main Content Area */}
      <div
        className={cn(
          "flex flex-col min-h-screen transition-all duration-200",
          "lg:pl-64", // Default left padding for sidebar
          isSidebarCollapsed && "lg:pl-16" // Collapsed sidebar padding
        )}
      >
        {/* Top Navigation Bar */}
        <TopNavigation />

        {/* Main Content */}
        <main
          id="main-content"
          className="flex-1 pb-20 lg:pb-6" // Extra padding bottom for mobile nav
          role="main"
        >
          {children}
        </main>
      </div>

      {/* Mobile Navigation - Mobile only */}
      <MobileNavigation />
    </div>
  );
}
