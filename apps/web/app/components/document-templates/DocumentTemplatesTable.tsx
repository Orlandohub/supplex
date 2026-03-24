/**
 * Document Template Table Component
 * Displays list of document templates with actions
 * Story 2.2.11
 */

import type { DocumentTemplate } from "@supplex/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Edit, Trash2, FileText, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DocumentTemplatesTableProps {
  templates: DocumentTemplate[];
  onEdit: (template: DocumentTemplate) => void;
  onDelete: (template: DocumentTemplate) => void;
}

export function DocumentTemplatesTable({
  templates,
  onEdit,
  onDelete,
}: DocumentTemplatesTableProps) {
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "published":
        return "default";
      case "draft":
        return "secondary";
      case "archived":
        return "outline";
      default:
        return "secondary";
    }
  };

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 border rounded-lg bg-muted/50">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No document templates yet</h3>
        <p className="text-sm text-muted-foreground text-center">
          Create your first template to get started
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Template Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Default</TableHead>
            <TableHead>Documents</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => (
            <TableRow key={template.id}>
              <TableCell className="font-medium">{template.templateName}</TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(template.status)}>
                  {template.status}
                </Badge>
              </TableCell>
              <TableCell>
                {template.isDefault && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
              </TableCell>
              <TableCell>
                {Array.isArray(template.requiredDocuments) 
                  ? template.requiredDocuments.length 
                  : 0} {template.requiredDocuments?.length === 1 ? "document" : "documents"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(template.createdAt), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(template)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(template)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

