import { Link } from "@remix-run/react";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href: string;
  isCurrentPage?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * Breadcrumb Navigation Component
 * 
 * Displays hierarchical navigation breadcrumbs with proper accessibility
 * - Current page is not clickable
 * - Proper ARIA labels for screen readers
 * - Mobile-responsive with text truncation for long names
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex">
      <ol className="flex items-center space-x-2 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isCurrent = item.isCurrentPage || isLast;

          return (
            <li key={item.href || item.label} className="flex items-center">
              {index > 0 && (
                <ChevronRight
                  className="h-4 w-4 text-gray-400 mx-2 flex-shrink-0"
                  aria-hidden="true"
                />
              )}

              {isCurrent ? (
                <span
                  className="text-gray-700 font-medium truncate max-w-[200px] sm:max-w-none"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="text-gray-500 hover:text-gray-700 transition-colors truncate max-w-[200px] sm:max-w-none"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

