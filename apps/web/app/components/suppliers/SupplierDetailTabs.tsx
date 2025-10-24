import { useState } from "react";
import { useSearchParams } from "@remix-run/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { SupplierOverview } from "./SupplierOverview";
import { StatusChangeDropdown } from "./StatusChangeDropdown";
import { DeleteSupplierModal } from "./DeleteSupplierModal";
import { DocumentsTab } from "./DocumentsTab";
import { QualificationsTab } from "../workflows/QualificationsTab";
import { InitiateWorkflowDialog } from "../workflows/InitiateWorkflowDialog";
import { usePermissions } from "~/hooks/usePermissions";
import { Edit, Trash2, History, CheckCircle } from "lucide-react";
import { Link } from "@remix-run/react";
import type {
  SupplierStatus,
  SupplierCategory,
  Document,
  QualificationWorkflow,
} from "@supplex/types";

interface SupplierDetailTabsProps {
  supplier: {
    id: string;
    name: string;
    taxId: string;
    category: SupplierCategory;
    status: SupplierStatus;
    performanceScore: number | null;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    address: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    certifications: Array<{
      type: string;
      issueDate: string;
      expiryDate: string;
      documentId?: string;
    }>;
    metadata: Record<string, unknown>;
    riskScore: number | null;
    createdAt: string;
    updatedAt: string;
    createdByName?: string;
    createdByEmail?: string | null;
  };
  documents: Document[];
  workflows: QualificationWorkflow[];
  token: string;
}

/**
 * Supplier Detail Tabs Component
 *
 * Main tabbed interface for supplier detail page
 * - Overview Tab: Displays all supplier information
 * - Documents Tab: Placeholder for Story 1.8
 * - History Tab: Placeholder for audit history
 *
 * Features:
 * - URL-based tab state (query param)
 * - Edit button (with permissions check)
 * - Delete button (Admin only)
 * - Status change dropdown (Admin/Procurement Manager)
 * - Keyboard accessible navigation
 */
export function SupplierDetailTabs({
  supplier,
  documents,
  workflows,
  token,
}: SupplierDetailTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = usePermissions();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

  // Get active tab from URL or default to "overview"
  const activeTab = searchParams.get("tab") || "overview";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        {/* Status Change Dropdown */}
        <div className="flex-1">
          <StatusChangeDropdown
            currentStatus={supplier.status}
            supplierId={supplier.id}
            supplierName={supplier.name}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {/* Start Qualification Button - Only visible for Prospect status (AC 1) */}
          {supplier.status === "prospect" &&
            (permissions.isProcurementManager || permissions.isAdmin) && (
              <Button
                onClick={() => setIsWorkflowModalOpen(true)}
                className="flex items-center space-x-2"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Start Qualification</span>
              </Button>
            )}

          {permissions.canEditSupplier && (
            <Button
              asChild
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Link to={`/suppliers/${supplier.id}/edit`}>
                <Edit className="h-4 w-4" />
                <span>Edit</span>
              </Link>
            </Button>
          )}

          {permissions.isAdmin && (
            <Button
              variant="destructive"
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center space-x-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="qualifications">
            Qualifications
            {workflows.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                {workflows.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <SupplierOverview supplier={supplier} />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <DocumentsTab
            supplierId={supplier.id}
            documents={documents}
            token={token}
          />
        </TabsContent>

        {/* Qualifications Tab (AC 8) */}
        <TabsContent value="qualifications" className="mt-6">
          <QualificationsTab
            workflows={workflows}
            onStartQualification={
              supplier.status === "prospect"
                ? () => setIsWorkflowModalOpen(true)
                : undefined
            }
          />
        </TabsContent>

        {/* History Tab - Placeholder */}
        <TabsContent value="history" className="mt-6">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <History className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Audit History Coming Soon
            </h3>
            <p className="text-gray-600">
              View supplier change history and audit trail in a future release.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Modal */}
      <DeleteSupplierModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        supplierId={supplier.id}
        supplierName={supplier.name}
      />

      {/* Workflow Initiation Modal (AC 2-7, 10) */}
      <InitiateWorkflowDialog
        open={isWorkflowModalOpen}
        onOpenChange={setIsWorkflowModalOpen}
        supplier={supplier}
        token={token}
      />
    </div>
  );
}
