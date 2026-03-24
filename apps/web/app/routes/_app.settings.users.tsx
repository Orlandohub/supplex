/**
 * User Management Settings Page
 * Allows admins to view and manage users in their tenant
 */

import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useRevalidator } from "@remix-run/react";
import { useState } from "react";
import {
  UserListTable,
  UserListTableSkeleton,
} from "../components/users/UserListTable";
import { SupplierUsersTab } from "../components/users/SupplierUsersTab";
import { PendingInvitationsTab } from "../components/users/PendingInvitationsTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { useAuth } from "../hooks/useAuth";
import type { User, UserRole } from "@supplex/types";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { InviteUserModal } from "~/components/users/InviteUserModal";
import { ChangeRoleModal } from "~/components/users/ChangeRoleModal";
import { DeactivateUserModal } from "~/components/users/DeactivateUserModal";
import { useToast } from "~/hooks/use-toast";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { hasPermission, PermissionAction } from "@supplex/types";

export async function loader(args: LoaderFunctionArgs) {
  // Require authentication
  const { userRecord, session } = await requireAuth(args);
  
  // Server-side permission check - redirect if not authorized
  if (!hasPermission(userRecord.role, PermissionAction.MANAGE_USERS)) {
    return redirect("/");
  }

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Create Eden Treaty client
  const client = createEdenTreatyClient(token);

  try {
    // Fetch all users
    const usersResponse = await client.api.users.get();

    // Fetch ALL pending invitations (not filtered by role)
    const invitationsResponse = await client.api.users["pending-invitations"].get();

    // Fetch suppliers (max limit is 100 per API validation)
    const suppliersResponse = await client.api.suppliers.get({
      query: { page: 1, limit: 100 },
    });

    // Process data
    const allUsers = (usersResponse.data?.data?.users || []) as User[];
    const pendingInvitations = invitationsResponse.data?.data || [];
    const allSuppliers = suppliersResponse.data?.data?.suppliers || [];

    // Group users by supplier
    // Only include suppliers that have platform access (supplierUserId is not null)
    const suppliersWithPlatformAccess = allSuppliers.filter(
      (s: any) => s.supplierUserId !== null
    );

    const suppliersWithUsers = suppliersWithPlatformAccess.map((supplier: any) => {
      const supplierUsers = allUsers.filter(
        (user) => user.role === "supplier_user" && supplier.supplierUserId === user.id
      );
      return {
        id: supplier.id,
        name: supplier.name,
        supplierUserId: supplier.supplierUserId,
        users: supplierUsers,
      };
    });

    // Filter internal users (not supplier users)
    const internalUsers = allUsers.filter((user) => user.role !== "supplier_user");

    return json({
      internalUsers,
      allUsers,
      pendingInvitations,
      suppliersWithUsers,
      error: null,
    });
  } catch (error) {
    console.error("Error fetching user management data:", error);
    return json({
      internalUsers: [] as User[],
      allUsers: [] as User[],
      pendingInvitations: [],
      suppliersWithUsers: [],
      error: "Failed to load user data",
    });
  }
}

export default function UsersSettingsPage() {
  const { internalUsers, allUsers, pendingInvitations, suppliersWithUsers } =
    useLoaderData<typeof loader>();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const { toast } = useToast();
  
  // Tab state - removed manual management, Tabs component handles it now
  
  // Filter state
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Modal states
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // ✅ No client-side permission check needed - server redirects unauthorized users

  const filteredInternalUsers = internalUsers.filter((u) => {
    if (filterStatus === "all") return true;
    return filterStatus === "active" ? u.isActive : !u.isActive;
  });

  const handleInviteUser = () => {
    setIsInviteModalOpen(true);
  };

  const handleInviteSubmit = async (data: {
    email: string;
    role: UserRole;
    message?: string;
  }) => {
    const token = session?.access_token;
    if (!token) {
      toast({
        title: "Error",
        description: "Authentication token not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.users.invite.post(data);

      if (response.error || !response.data?.success) {
        throw new Error(
          (response.error as any)?.message || "Failed to send invitation"
        );
      }

      toast({
        title: "Invitation sent",
        description: `Successfully invited ${data.email} to your organization.`,
      });

      // Refresh the user list
      revalidator.revalidate();
      setIsInviteModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleEditRole = (targetUser: User) => {
    setSelectedUser(targetUser);
    setIsRoleModalOpen(true);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const token = session?.access_token;
    if (!token) {
      toast({
        title: "Error",
        description: "Authentication token not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.users({ id: userId }).role.patch({
        role: newRole,
      });

      if (response.error || !response.data?.success) {
        throw new Error(
          (response.error as any)?.message || "Failed to update role"
        );
      }

      toast({
        title: "Role updated",
        description: `Successfully updated user role to ${newRole}.`,
      });

      // Refresh the user list
      revalidator.revalidate();
      setIsRoleModalOpen(false);
      setSelectedUser(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleToggleStatus = (targetUser: User) => {
    setSelectedUser(targetUser);
    setIsStatusModalOpen(true);
  };

  const handleStatusChange = async (userId: string, isActive: boolean) => {
    const token = session?.access_token;
    if (!token) {
      toast({
        title: "Error",
        description: "Authentication token not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.users({ id: userId }).status.patch({
        isActive,
      });

      if (response.error || !response.data?.success) {
        throw new Error(
          (response.error as any)?.message || "Failed to update status"
        );
      }

      toast({
        title: isActive ? "User reactivated" : "User deactivated",
        description: `Successfully ${isActive ? "reactivated" : "deactivated"} the user.`,
      });

      // Refresh the user list
      revalidator.revalidate();
      setIsStatusModalOpen(false);
      setSelectedUser(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleResendInvitation = async (userId: string) => {
    const token = session?.access_token;
    if (!token) {
      toast({
        title: "Error",
        description: "Authentication token not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.users["resend-invitation"].post({
        userId,
      });

      if (response.error || !response.data?.success) {
        throw new Error(
          (response.error as any)?.message || "Failed to resend invitation"
        );
      }

      toast({
        title: "Invitation resent",
        description: "Successfully sent a new invitation link.",
      });

      // Refresh data
      revalidator.revalidate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend invitation",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Settings
        </Button>
      </div>

      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Team Members</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage users and their roles within your organization.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6">
        <Tabs defaultValue="internal" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-3">
            <TabsTrigger value="internal">
              Internal Users
            </TabsTrigger>
            <TabsTrigger value="supplier">
              Supplier Users
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending Invitations
            </TabsTrigger>
          </TabsList>

          {/* Internal Users Tab */}
          <TabsContent value="internal">
            {/* Invite Button and Filters */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
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
                  {filteredInternalUsers.length}{" "}
                  {filteredInternalUsers.length === 1 ? "user" : "users"}
                </div>
              </div>
              
              {/* Invite User Button */}
              <button
                type="button"
                onClick={handleInviteUser}
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Invite User
              </button>
            </div>

            {/* User List Table */}
            <div className="mt-8">
              {revalidator.state === "loading" ? (
                <UserListTableSkeleton />
              ) : (
                <UserListTable
                  users={filteredInternalUsers as unknown as User[]}
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
                    Total Internal Users
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {internalUsers.length}
                  </dd>
                </div>
              </div>
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Users
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {internalUsers.filter((u) => u.isActive).length}
                  </dd>
                </div>
              </div>
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Inactive Users
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {internalUsers.filter((u) => !u.isActive).length}
                  </dd>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Supplier Users Tab */}
          <TabsContent value="supplier">
            <div className="mt-8">
              {revalidator.state === "loading" ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                </div>
              ) : (
                <SupplierUsersTab
                  suppliers={suppliersWithUsers as any[]}
                  onToggleStatus={handleToggleStatus}
                  currentUserId={user?.id}
                />
              )}
            </div>
          </TabsContent>

          {/* Pending Invitations Tab */}
          <TabsContent value="pending">
            <div className="mt-8">
              {revalidator.state === "loading" ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                </div>
              ) : (
                <PendingInvitationsTab
                  invitations={pendingInvitations as any[]}
                  onResendInvitation={handleResendInvitation}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={handleInviteSubmit}
      />

      <ChangeRoleModal
        isOpen={isRoleModalOpen}
        user={selectedUser}
        onClose={() => {
          setIsRoleModalOpen(false);
          setSelectedUser(null);
        }}
        onConfirm={handleRoleChange}
      />

      <DeactivateUserModal
        isOpen={isStatusModalOpen}
        user={selectedUser}
        onClose={() => {
          setIsStatusModalOpen(false);
          setSelectedUser(null);
        }}
        onConfirm={handleStatusChange}
      />
    </div>
  );
}
