import type { DocumentChecklist } from "@supplex/types";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Edit2, Trash2, Plus } from "lucide-react";

// Type for checklist data with dates as strings (after serialization)
type SerializedDocumentChecklist = Omit<
  DocumentChecklist,
  "createdAt" | "updatedAt" | "deletedAt"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

interface ChecklistTableProps {
  checklists: SerializedDocumentChecklist[];
  onCreateClick: () => void;
  onEditClick: (checklist: SerializedDocumentChecklist) => void;
  onDeleteClick: (checklist: SerializedDocumentChecklist) => void;
}

export function ChecklistTable({
  checklists,
  onCreateClick,
  onEditClick,
  onDeleteClick,
}: ChecklistTableProps) {
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getDocumentCount = (checklist: SerializedDocumentChecklist) => {
    return checklist.requiredDocuments.filter((doc) => doc.required).length;
  };

  // Empty state
  if (checklists.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No checklist templates
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating a new checklist template.
        </p>
        <div className="mt-6">
          <Button onClick={onCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Template Name
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                # of Required Docs
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Created Date
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Last Modified
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {checklists.map((checklist) => (
              <tr key={checklist.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {checklist.templateName}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {getDocumentCount(checklist)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {checklist.isDefault && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                      Default
                    </Badge>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(checklist.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(checklist.updatedAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onEditClick(checklist)}
                    className="text-blue-600 hover:text-blue-900 mr-4 inline-flex items-center"
                    aria-label={`Edit ${checklist.templateName}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDeleteClick(checklist)}
                    className="text-red-600 hover:text-red-900 inline-flex items-center"
                    aria-label={`Delete ${checklist.templateName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {checklists.map((checklist) => (
          <Card key={checklist.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">
                  {checklist.templateName}
                </CardTitle>
                {checklist.isDefault && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    Default
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Required Documents:</span>
                <span className="font-medium">
                  {getDocumentCount(checklist)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Created:</span>
                <span className="text-gray-900">
                  {formatDate(checklist.createdAt)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Last Modified:</span>
                <span className="text-gray-900">
                  {formatDate(checklist.updatedAt)}
                </span>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditClick(checklist)}
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDeleteClick(checklist)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
}
