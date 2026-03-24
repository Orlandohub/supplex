import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { User, Mail, UserX, Edit, UserPlus } from "lucide-react";
import { useState } from "react";
import { EditSupplierContactModal } from "./EditSupplierContactModal";
import { AddSupplierContactModal } from "./AddSupplierContactModal";
import { useRouteLoaderData } from "@remix-run/react";
import type { AppLoaderData } from "~/routes/_app";

interface SupplierContactCardProps {
  supplierUser: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
    status: string;
  } | null;
  supplierId: string;
  token: string;
}

/**
 * SupplierContactCard Component
 * 
 * Displays supplier contact information with platform access status
 * Follows SSR-first permissions pattern to prevent flash of unauthorized content
 * 
 * Features:
 * - Shows contact name, email, and access status
 * - Edit button visible only to authorized roles (admin/procurement_manager)
 * - Add Contact button visible when no contact exists (admin/procurement_manager)
 * - Uses server-computed permissions via useRouteLoaderData (no flash)
 */
export function SupplierContactCard({ supplierUser, supplierId, token }: SupplierContactCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // SSR-first permissions (no flash)
  const appData = useRouteLoaderData<AppLoaderData>("routes/_app");
  const canEdit = appData?.permissions?.canEditSuppliers ?? false;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Platform Access</CardTitle>
            
            {/* Action Buttons */}
            {canEdit && (
              <>
                {supplierUser ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Contact
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsAddModalOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                )}
              </>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {!supplierUser ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-gray-500">
                <UserX className="h-5 w-5" />
                <span>No contact user associated</span>
              </div>
              {canEdit && (
                <p className="text-sm text-gray-600 mt-2">
                  Add a contact to grant this supplier access to the platform.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Contact Name */}
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Contact Name</p>
                  <p className="text-sm text-gray-900">{supplierUser.fullName}</p>
                </div>
              </div>

              {/* Contact Email */}
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Contact Email</p>
                  <p className="text-sm text-gray-900">{supplierUser.email}</p>
                </div>
              </div>

              {/* Access Status */}
              <div className="flex items-start space-x-3">
                <div className="h-5 w-5" /> {/* Spacer for alignment */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Access Status</p>
                  {supplierUser.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="destructive">Deactivated</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {supplierUser && (
        <EditSupplierContactModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          supplierUser={supplierUser}
          supplierId={supplierId}
          token={token}
        />
      )}

      {/* Add Modal */}
      {!supplierUser && (
        <AddSupplierContactModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          supplierId={supplierId}
          token={token}
        />
      )}
    </>
  );
}

