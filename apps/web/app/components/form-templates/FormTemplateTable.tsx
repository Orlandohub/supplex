/**
 * Form Template Table Component
 * Displays list of form templates with actions
 * Updated: Story 2.2.14 - Removed versioning, added copy functionality
 */

import { useState } from "react";
import { useNavigate } from "@remix-run/react";
import type { FormTemplateListItem } from "@supplex/types";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Edit, Trash2, FileText, Eye, Copy, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CopyFormTemplateDialog } from "./CopyTemplateDialog";
import { useToast } from "~/hooks/use-toast";

interface FormTemplateTableProps {
  templates: FormTemplateListItem[];
  onDelete: (templateId: string) => Promise<void>;
  token: string;
}

export function FormTemplateTable({
  templates,
  onDelete,
  token,
}: FormTemplateTableProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [copyTemplate, setCopyTemplate] = useState<{ id: string; name: string } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (templateId: string) => {
    navigate(`/settings/form-templates/${templateId}/edit`);
  };

  const confirmDelete = (templateId: string) => {
    setDeleteTemplateId(templateId);
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    if (deleteTemplateId) {
      setIsDeleting(true);
      try {
        await onDelete(deleteTemplateId);
        setDeleteTemplateId(null);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleTogglePublish = async (templateId: string, currentStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPublishing) return;
    setIsPublishing(true);
    
    try {
      const response = await fetch(`/api/form-templates/${templateId}/publish`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to toggle publish status");
      }

      toast({
        title: currentStatus === "draft" ? "Template Published" : "Template Unpublished",
        description: currentStatus === "draft" 
          ? "Template is now published and ready for use"
          : "Template returned to draft status",
      });

      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update template status",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

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
        <h3 className="text-lg font-semibold mb-2">No templates found</h3>
        <p className="text-sm text-muted-foreground text-center">
          Get started by creating your first form template
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => {
              const isPublished = template.status === "published";
              
              return (
                <TableRow
                  key={template.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleEdit(template.id)}
                >
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(template.status)}>
                      {template.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(template.updatedAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      role="toolbar"
                      className="flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                        }
                      }}
                      role="group"
                      tabIndex={-1}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(template.id)}
                        title={isPublished ? "View template (read-only)" : "Edit template"}
                      >
                        {isPublished ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <Edit className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCopyTemplate({ id: template.id, name: template.name })}
                        title="Copy template"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleTogglePublish(template.id, template.status, e)}
                        title={isPublished ? "Unpublish template" : "Publish template"}
                        disabled={template.status === "archived" || isPublishing}
                      >
                        <CheckCircle className={`h-4 w-4 ${isPublished ? "text-green-600" : "text-gray-400"}`} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirmDelete(template.id)}
                        title="Delete template"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Copy Template Dialog */}
      {copyTemplate && (
        <CopyFormTemplateDialog
          open={!!copyTemplate}
          onOpenChange={(open) => !open && setCopyTemplate(null)}
          templateId={copyTemplate.id}
          templateName={copyTemplate.name}
          token={token}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteTemplateId !== null}
        onOpenChange={(open) => !open && setDeleteTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will soft delete the template. Are you sure you want
              to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

