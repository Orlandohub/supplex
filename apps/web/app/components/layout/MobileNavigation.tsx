/**
 * Mobile Navigation Component
 * Bottom tab bar for mobile with "More" drawer
 * Uses SSR permissions from parent loader to prevent flash
 */

import { Link, useLocation, useRouteLoaderData } from "react-router";
import { Home, Building2, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "~/lib/utils";
import type { AppLoaderData } from "~/routes/_app";
import {
  CheckCircle,
  BarChart3,
  AlertTriangle,
  PieChart,
  Settings,
  Code,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions?: keyof AppLoaderData["permissions"];
  adminOnly?: boolean;
}

const primaryNavItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Suppliers", href: "/suppliers", icon: Building2 },
];

const moreNavItems: NavItem[] = [
  { name: "Workflows", href: "/workflows", icon: CheckCircle },
  { name: "Evaluations", href: "/evaluations", icon: BarChart3 },
  { name: "Complaints", href: "/complaints", icon: AlertTriangle },
  {
    name: "Analytics",
    href: "/analytics",
    icon: PieChart,
    requiredPermissions: "canViewAnalytics",
  },
  { name: "Settings", href: "/settings", icon: Settings, adminOnly: true },
  { name: "API", href: "/api-docs", icon: Code },
];

export function MobileNavigation() {
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // âœ… Get permissions from parent loader (SSR-safe, prevents flash)
  const appData = useRouteLoaderData<AppLoaderData>("routes/_app");
  const permissions = appData?.permissions;

  // Close drawer when route changes
  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isMoreOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMoreOpen]);

  // Filter navigation based on SERVER permissions (prevents flash)
  const visibleMoreItems = moreNavItems.filter((item) => {
    if (item.adminOnly && !permissions?.isAdmin) return false;
    if (item.requiredPermissions && permissions)
      return permissions[item.requiredPermissions];
    return true;
  });

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 shadow-lg"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex justify-around items-center h-16 px-2">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.href ||
              (item.href !== "/" && location.pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-2 px-3",
                  "text-xs font-medium rounded-md transition-colors duration-150",
                  "min-h-[44px]", // Touch-optimized tap target
                  isActive
                    ? "text-blue-600 bg-blue-50"
                    : "text-neutral-600 hover:bg-neutral-50"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={cn("h-6 w-6 mb-1")} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setIsMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 py-2 px-3",
              "text-xs font-medium rounded-md transition-colors duration-150",
              "min-h-[44px]", // Touch-optimized tap target
              "text-neutral-600 hover:bg-neutral-50"
            )}
            aria-label="More menu"
            aria-expanded={isMoreOpen}
          >
            <Menu className="h-6 w-6 mb-1" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* More Drawer */}
      {isMoreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsMoreOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div
            className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl
              transform transition-transform duration-300 ease-out"
            role="dialog"
            aria-label="More menu"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1 bg-neutral-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">More</h2>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="px-4 py-4 space-y-1 max-h-[60vh] overflow-y-auto">
              {visibleMoreItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== "/" &&
                    location.pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center px-4 py-3 text-sm font-medium rounded-md",
                      "transition-colors duration-150 min-h-[44px]",
                      isActive
                        ? "bg-blue-50 text-blue-600"
                        : "text-neutral-700 hover:bg-neutral-100"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 mr-3",
                        isActive ? "text-blue-600" : "text-neutral-400"
                      )}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Safe area padding for bottom notch */}
            <div className="h-safe-bottom pb-4" />
          </div>
        </>
      )}
    </>
  );
}
