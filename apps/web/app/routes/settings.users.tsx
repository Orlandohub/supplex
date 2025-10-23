/**
 * User Management Settings Page
 * Allows admins to view and manage users in their tenant
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useRevalidator } from "@remix-run/react";
import { useState } from "react";
import {
  UserListTable,
  UserListTableSkeleton,
} from "../components/users/UserListTable";
import { usePermissions } from "../hooks/usePermissions";
import { useAuth } from "../hooks/useAuth";
import type { User } from "@supplex/types";

// TODO: Replace with actual API client when Eden Treaty is configured
// For now, this is a placeholder structure
// async function fetchUsers(tenantId: string, status?: 'active' | 'inactive'): Promise<User[]> {
//   // Placeholder - will be replaced with Eden Treaty client
//   const queryParams = status ? `?status=${status}` : '';
//   // TODO: JWT token will be passed from session
//   const response = await fetch(`/api/users${queryParams}`, {
//     headers: {
//       'Authorization': 'Bearer TOKEN_PLACEHOLDER',
//     },
//   });
//
//   if (!response.ok) {
//     throw new Error('Failed to fetch users');
//   }
//
//   const data = await response.json();
//   return data.data.users;
// }

export async function loader(_: LoaderFunctionArgs) {
  // TODO: Get user from session/auth
  // For now, return empty array as placeholder
  return json({
    users: [] as User[],
    error: null,
  });
}

export default function UsersSettingsPage() {
  const { users } = useLoaderData<typeof loader>();
  const { user } = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Redirect if not admin
  if (!permissions.canManageUsers) {
    navigate("/");
    return null;
  }

  const filteredUsers = users.filter((u) => {
    if (filterStatus === "all") return true;
    return filterStatus === "active" ? u.isActive : !u.isActive;
  });

  const handleInviteUser = () => {
    // Will be implemented in Task 7
    console.log("Invite user clicked");
  };

  const handleEditRole = (targetUser: User) => {
    // Will be implemented in Task 8
    console.log("Edit role clicked for user:", targetUser.email);
  };

  const handleToggleStatus = (targetUser: User) => {
    // Will be implemented in Task 8
    console.log("Toggle status clicked for user:", targetUser.email);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Team Members</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage users and their roles within your organization.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={handleInviteUser}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            Invite User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex items-center gap-4">
        <label
          htmlFor="status-filter"
          className="text-sm font-medium text-gray-700"
        >
          Filter by status:
        </label>
        <select
          id="status-filter"
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as "all" | "active" | "inactive")
          }
          className="block rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
        >
          <option value="all">All Users</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <div className="text-sm text-gray-500">
          {filteredUsers.length} {filteredUsers.length === 1 ? "user" : "users"}
        </div>
      </div>

      {/* User List Table */}
      <div className="mt-8">
        {revalidator.state === "loading" ? (
          <UserListTableSkeleton />
        ) : (
          <UserListTable
            users={filteredUsers as unknown as User[]}
            currentUserId={user?.id}
            onEditRole={handleEditRole}
            onToggleStatus={handleToggleStatus}
          />
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Total Users
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {users.length}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Active Users
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {users.filter((u) => u.isActive).length}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Inactive Users
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {users.filter((u) => !u.isActive).length}
            </dd>
          </div>
        </div>
      </div>
    </div>
  );
}
