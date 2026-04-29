/**
 * Supplier Forms Tab Component
 * Story: 2.2.16 - Workflow Execution Bug Fixes & UX Enhancements
 *
 * Displays all form submissions linked to a supplier's workflow processes
 */

import { useNavigate } from "react-router";
import { Badge } from "~/components/ui/badge";
import { FileText } from "lucide-react";

/**
 * Post-serialization shape for a supplier-linked form submission. Exported
 * so the loader can declare the same contract when narrowing the API
 * response.
 */
export interface SupplierFormSubmission {
  id: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  formTemplateName: string;
  workflowName: string;
  stepName: string;
  processInstanceId: string;
}

interface SupplierFormsTabProps {
  submissions: SupplierFormSubmission[];
  supplierName: string;
  supplierId: string;
}

export function SupplierFormsTab({
  submissions,
  supplierName,
  supplierId,
}: SupplierFormsTabProps) {
  const navigate = useNavigate();

  if (submissions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Forms Yet
        </h3>
        <p className="text-gray-600">
          No forms have been filled out for this supplier yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Form Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Workflow
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Step
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {submissions.map((sub) => (
            <tr
              key={sub.id}
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() =>
                navigate(
                  `/forms/${sub.id}?from=supplier&supplierId=${supplierId}&supplierName=${encodeURIComponent(supplierName)}`
                )
              }
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {sub.formTemplateName}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {sub.workflowName}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {sub.stepName}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Badge
                  className={
                    sub.status === "submitted"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }
                >
                  {sub.status}
                </Badge>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {sub.submittedAt
                  ? new Date(sub.submittedAt).toLocaleDateString()
                  : new Date(sub.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
