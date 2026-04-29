/**
 * Supplier Users Tab Component
 * Shows pending invitations and expandable supplier list with their users
 */

import { useState } from "react";
import type { User } from "@supplex/types";
import type { UserRole } from "@supplex/types";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { getRoleDisplayName } from "~/lib/rbac/permissions";

export interface SupplierWithUsers {
  id: string;
  name: string;
  users: User[];
}

interface SupplierUsersTabProps {
  suppliers: SupplierWithUsers[];
  onToggleStatus: (user: User) => void;
  currentUserId?: string;
}

export function SupplierUsersTab({
  suppliers,
  onToggleStatus,
  currentUserId,
}: SupplierUsersTabProps) {
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(
    new Set()
  );

  const toggleSupplier = (supplierId: string) => {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) {
        next.delete(supplierId);
      } else {
        next.add(supplierId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-8">
      {/* Suppliers with Users Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Suppliers & Their Users
        </h3>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {suppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No suppliers with platform access found.
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => {
                  const isExpanded = expandedSuppliers.has(supplier.id);
                  return (
                    <React.Fragment key={supplier.id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleSupplier(supplier.id)}
                      >
                        <td className="px-6 py-4">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {supplier.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {supplier.users.length} user
                          {supplier.users.length !== 1 ? "s" : ""}
                        </td>
                      </tr>
                      {isExpanded && supplier.users.length > 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-4 bg-gray-50">
                            <div className="ml-8">
                              <table className="min-w-full">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                                      Name
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                                      Email
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                                      Role
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                                      Status
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                                      Actions
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {supplier.users.map((user) => (
                                    <tr key={user.id}>
                                      <td className="px-4 py-3 text-sm text-gray-900">
                                        {user.fullName}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-500">
                                        {user.email}
                                      </td>
                                      <td className="px-4 py-3">
                                        <Badge variant="outline">
                                          {getRoleDisplayName(
                                            user.role as UserRole
                                          )}
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-3">
                                        <Badge
                                          variant={
                                            user.isActive
                                              ? "default"
                                              : "secondary"
                                          }
                                        >
                                          {user.isActive
                                            ? "Active"
                                            : "Inactive"}
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-3 text-sm space-x-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleStatus(user);
                                          }}
                                          disabled={user.id === currentUserId}
                                        >
                                          {user.isActive
                                            ? "Deactivate"
                                            : "Activate"}
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Add React import for Fragment
import * as React from "react";
