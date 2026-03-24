/**
 * Sidebar Component
 * Collapsible sidebar navigation with role-based menu filtering
 * 
 * Uses SSR permissions from parent loader to prevent flash of unauthorized content
 */

import { Link, useLocation, useRouteLoaderData } from "@remix-run/react";
import { Fragment } from "react";
import {
  Home,
  Building2,
  CheckCircle,
  BarChart3,
  AlertTriangle,
  PieChart,
  Settings,
  Code,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { useNavigationStore } from "~/stores/navigationStore";
import { cn } from "~/lib/utils";
import type { AppLoaderData } from "~/routes/_app";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions?: keyof AppLoaderData["permissions"];
  adminOnly?: boolean;
  showBadge?: boolean;
  supplierUserExcluded?: boolean;
}

const navigationItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: Home,
  },
  {
    name: "Suppliers",
    href: "/suppliers",
    icon: Building2,
    supplierUserExcluded: true,
  },
  {
    name: "My Tasks",
    href: "/tasks",
    icon: ClipboardList,
  },
  {
    name: "Workflows",
    href: "/workflows",
    icon: CheckCircle,
  },
  {
    name: "Evaluations",
    href: "/evaluations",
    icon: BarChart3,
  },
  {
    name: "Complaints",
    href: "/complaints",
    icon: AlertTriangle,
  },
  {
    name: "Analytics",
    href: "/analytics",
    icon: PieChart,
    requiredPermissions: "canViewAnalytics",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    adminOnly: true,
  },
  {
    name: "API",
    href: "/api-docs",
    icon: Code,
    supplierUserExcluded: true,
  },
];

export function Sidebar() {
  const location = useLocation();
  const { isSidebarCollapsed, toggleSidebar } = useNavigationStore();

  // ✅ Get permissions from parent loader (SSR-safe, prevents flash)
  const appData = useRouteLoaderData<AppLoaderData>("routes/_app");
  const permissions = appData?.permissions;

  // Filter navigation based on SERVER-COMPUTED permissions
  // This ensures correct HTML on initial render (no flash of unauthorized content)
  const visibleNavItems = navigationItems.filter((item) => {
    // If item is admin-only, check if user is admin
    if (item.adminOnly && !permissions?.isAdmin) {
      return false;
    }

    // If item is excluded for supplier users, hide it
    if (item.supplierUserExcluded && permissions?.isSupplierUser) {
      return false;
    }

    // If item requires specific permission, check it
    if (item.requiredPermissions && permissions) {
      return permissions[item.requiredPermissions];
    }

    // Show item by default
    return true;
  });

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col",
        "bg-neutral-50 border-r border-neutral-200",
        "transition-all duration-200 ease-in-out",
        isSidebarCollapsed ? "w-16" : "w-64",
        "hidden lg:flex" // Hide on mobile
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo Section */}
      <div className="flex h-16 items-center border-b border-neutral-200 px-4">
        <div className="flex items-center">
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
          {!isSidebarCollapsed && (
            <span className="ml-2 text-lg font-semibold text-neutral-900">
              Supplex
            </span>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {visibleNavItems.map((item, index) => {
          const Icon = item.icon;
          
          // Fix navigation highlighting - prevent parent routes from matching child routes
          // e.g., /workflows shouldn't match /workflows/templates
          let isActive = false;
          
          if (item.href === "/") {
            // Home route - only match exactly
            isActive = location.pathname === "/";
          } else {
            // Check if any other nav item has a longer href that starts with this item's href
            const hasChildRoute = navigationItems.some(
              (otherItem) =>
                otherItem.href !== item.href &&
                otherItem.href.startsWith(item.href + "/")
            );
            
            if (hasChildRoute) {
              // If this item has child routes, only match exactly
              isActive = location.pathname === item.href;
            } else {
              // Otherwise, match this route and any sub-routes
              isActive =
                location.pathname === item.href ||
                location.pathname.startsWith(item.href + "/");
            }
          }

          return (
            <Fragment key={item.name}>
              <Link
                to={item.href}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md",
                  "transition-colors duration-150",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
                  isSidebarCollapsed && "justify-center"
                )}
                aria-current={isActive ? "page" : undefined}
                title={isSidebarCollapsed ? item.name : undefined}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isActive
                      ? "text-blue-600"
                      : "text-neutral-400 group-hover:text-neutral-500"
                  )}
                />
                {!isSidebarCollapsed && (
                  <span className="ml-3 flex items-center gap-2">
                    {item.name}
                    {item.showBadge && (
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                    )}
                  </span>
                )}
                {isSidebarCollapsed && item.showBadge && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-600" />
                )}
              </Link>
              {/* Insert supplier name link for supplier_user after Dashboard */}
              {index === 0 &&
                permissions?.isSupplierUser &&
                appData?.supplierInfo && (
                  <Link
                    key="supplier-user-link"
                    to={`/suppliers/${appData.supplierInfo.id}`}
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md",
                      "transition-colors duration-150",
                      location.pathname.startsWith(
                        `/suppliers/${appData.supplierInfo.id}`
                      )
                        ? "bg-blue-50 text-blue-600"
                        : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
                      isSidebarCollapsed && "justify-center"
                    )}
                    aria-current={
                      location.pathname.startsWith(
                        `/suppliers/${appData.supplierInfo.id}`
                      )
                        ? "page"
                        : undefined
                    }
                    title={
                      isSidebarCollapsed ? appData.supplierInfo.name : undefined
                    }
                  >
                    <Building2
                      className={cn(
                        "h-5 w-5 flex-shrink-0",
                        location.pathname.startsWith(
                          `/suppliers/${appData.supplierInfo.id}`
                        )
                          ? "text-blue-600"
                          : "text-neutral-400 group-hover:text-neutral-500"
                      )}
                    />
                    {!isSidebarCollapsed && (
                      <span className="ml-3">{appData.supplierInfo.name}</span>
                    )}
                  </Link>
                )}
            </Fragment>
          );
        })}
      </nav>

      {/* Collapse Toggle Button */}
      <div className="flex items-center border-t border-neutral-200 p-4">
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex items-center text-sm font-medium text-neutral-700",
            "hover:text-neutral-900 hover:bg-neutral-100 rounded-md p-2",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            "transition-colors duration-150",
            isSidebarCollapsed ? "w-full justify-center" : "w-full"
          )}
          aria-label={
            isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
          }
          aria-expanded={!isSidebarCollapsed}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span className="ml-2">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
