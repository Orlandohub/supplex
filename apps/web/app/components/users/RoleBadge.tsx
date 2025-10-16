/**
 * RoleBadge Component
 * Displays a user's role with semantic colors
 */

import type { UserRole } from "@supplex/types";
import { getRoleDisplayName, getRoleColor } from "../../lib/rbac/permissions";

export interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

const colorClasses: Record<string, string> = {
  red: "bg-red-100 text-red-800 border-red-200",
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  green: "bg-green-100 text-green-800 border-green-200",
  gray: "bg-gray-100 text-gray-800 border-gray-200",
};

export function RoleBadge({ role, className = "" }: RoleBadgeProps) {
  const displayName = getRoleDisplayName(role);
  const color = getRoleColor(role);
  const colorClass = colorClasses[color] || colorClasses.gray;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass} ${className}`}
    >
      {displayName}
    </span>
  );
}
