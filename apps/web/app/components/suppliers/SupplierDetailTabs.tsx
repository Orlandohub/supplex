import { useState } from "react";
import { useSearchParams, useRouteLoaderData } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button, buttonVariants } from "~/components/ui/button";
import { SupplierOverview } from "./SupplierOverview";
import { StatusChangeDropdown } from "./StatusChangeDropdown";
import { DeleteSupplierModal } from "./DeleteSupplierModal";
import { DocumentsTab } from "./DocumentsTab";
import { WorkflowsTab } from "../workflows/WorkflowsTab";
import { InitiateWorkflowDialog } from "../workflows/InitiateWorkflowDialog";
import type { AppLoaderData } from "~/routes/_app";
import { Edit, Trash2, History, CheckCircle } from "lucide-react";
import { SupplierFormsTab } from "./SupplierFormsTab";
import { Link } from "react-router";
import { cn } from "~/lib/utils";
import type {
  SupplierStatus,
  SupplierCategory,
  Document,
} from "@supplex/types";

// Process Instance type for new workflow engine
interface ProcessInstance {
  id: string;
  processType: string;
  status: string;
  initiatedDate: string;
  completedDate?: string | null;
  entityType: string;
  entityId: string;
  activeStep?: {
    id: string;
    assignedTo?: string | null;
  } | null;
}

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
  supplierUser?: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    status: string;
    isActive: boolean;
  } | null;
  documents: Document[];
  workflows: ProcessInstance[];
  formSubmissions: Array<{
    id: string;
    status: string;
    submittedAt: string | null;
    createdAt: string;
    formTemplateName: string;
    workflowName: string;
    stepName: string;
    processInstanceId: string;
  }>;
  supplierStatuses?: Array<{ id: string; name: string }>;
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
  supplierUser,
  documents,
  workflows,
  formSubmissions,
  supplierStatuses,
  token,
}: SupplierDetailTabsProps) {
  const [searchParams] = useSearchParams();

  // âœ… Get permissions from parent loader (SSR-safe, prevents flash)
  const appData = useRouteLoaderData<AppLoaderData>("routes/_app");
  const permissions = appData?.permissions;
  const _currentUser = appData?.user;

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

  // Use client-side state for instant tab switching
  // Initialize from URL param on mount
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (value: string) => {
    // Update local state immediately (instant UI update)
    setActiveTab(value);

    // Update URL without triggering navigation (for bookmarking)
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        {/* Status Change (Admin only) */}
        <StatusChangeDropdown
          currentStatus={supplier.status}
          supplierId={supplier.id}
          supplierName={supplier.name}
          supplierStatuses={supplierStatuses}
        />

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {/* Start Process Button - Only visible for Prospect status */}
          {supplier.status === "prospect" &&
            permissions?.canCreateSuppliers && (
              <Button
                onClick={() => setIsWorkflowModalOpen(true)}
                className="flex items-center space-x-2"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Start Process</span>
              </Button>
            )}

          {permissions?.canEditSuppliers && (
            <Link
              to={`/suppliers/${supplier.id}/edit`}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "inline-flex items-center gap-2"
              )}
            >
              <Edit className="h-4 w-4" />
              <span>Edit</span>
            </Link>
          )}

          {permissions?.isAdmin && (
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="workflows">
            Workflows
            {workflows.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                {workflows.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="forms">
            Forms
            {formSubmissions.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                {formSubmissions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <SupplierOverview
            supplier={supplier}
            supplierUser={supplierUser}
            token={token}
          />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <DocumentsTab
            supplierId={supplier.id}
            documents={documents}
            token={token}
          />
        </TabsContent>

        {/* Workflows Tab (Story 2.2.9 - AC 6) */}
        <TabsContent value="workflows" className="mt-6">
          <WorkflowsTab
            workflows={workflows}
            supplierId={supplier.id}
            onStartProcess={
              supplier.status === "prospect" && permissions?.canCreateSuppliers
                ? () => setIsWorkflowModalOpen(true)
                : undefined
            }
          />
        </TabsContent>

        {/* Forms Tab (Story 2.2.16 - AC 26-30) */}
        <TabsContent value="forms" className="mt-6">
          <SupplierFormsTab
            submissions={formSubmissions}
            supplierName={supplier.name}
            supplierId={supplier.id}
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
