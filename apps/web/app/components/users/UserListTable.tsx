/**
 * UserListTable Component
 * Displays a table of users with their roles and status
 */

import type { User } from "@supplex/types";
import { RoleBadge } from "./RoleBadge";

export interface UserListTableProps {
  users: User[];
  onEditRole?: (user: User) => void;
  onToggleStatus?: (user: User) => void;
  currentUserId?: string;
}

export function UserListTable({
  users,
  onEditRole,
  onToggleStatus,
  currentUserId,
}: UserListTableProps) {
  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No users</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by inviting a new team member.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
            >
              Name
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Email
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Role
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Last Login
            </th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {users.map((user) => {
            const isCurrentUser = user.id === currentUserId;
            const lastLogin = user.lastLoginAt
              ? new Date(user.lastLoginAt).toLocaleDateString()
              : "Never";

            return (
              <tr key={user.id} className={isCurrentUser ? "bg-blue-50" : ""}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {user.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="font-medium text-gray-900">
                        {user.fullName}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-blue-600">
                            (You)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  <RoleBadge role={user.role} />
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  {user.isActive ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {lastLogin}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div className="flex justify-end gap-2">
                    {!isCurrentUser && onEditRole && (
                      <button
                        onClick={() => onEditRole(user)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit Role
                      </button>
                    )}
                    {!isCurrentUser && onToggleStatus && (
                      <button
                        onClick={() => onToggleStatus(user)}
                        className={
                          user.isActive
                            ? "text-red-600 hover:text-red-900"
                            : "text-green-600 hover:text-green-900"
                        }
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Loading Skeleton for UserListTable
 */
export function UserListTableSkeleton() {
  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
              Name
            </th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Email
            </th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Role
            </th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Status
            </th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Last Login
            </th>
            <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {[1, 2, 3, 4, 5].map((i) => (
            <tr key={i}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
                  <div className="ml-4 h-4 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-4">
                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
              </td>
              <td className="whitespace-nowrap px-3 py-4">
                <div className="h-6 w-24 bg-gray-200 rounded-full animate-pulse" />
              </td>
              <td className="whitespace-nowrap px-3 py-4">
                <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
              </td>
              <td className="whitespace-nowrap px-3 py-4">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              </td>
              <td className="whitespace-nowrap py-4 pl-3 pr-4 sm:pr-6">
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
