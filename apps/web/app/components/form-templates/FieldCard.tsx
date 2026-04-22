/**
 * Field Card Component
 * Displays a field with its configuration
 */

import { useState } from "react";
import { useRevalidator } from "react-router";
import type { FormFieldWithDetails } from "@supplex/types";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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
import { useToast } from "~/hooks/use-toast";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { Edit, Trash2, ChevronUp, ChevronDown, Asterisk } from "lucide-react";
import { EditFieldModal } from "./EditFieldModal";

interface FieldCardProps {
  field: FormFieldWithDetails;
  sectionId: string;
  token: string;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  allFields: FormFieldWithDetails[];
}

export function FieldCard({
  field,
  sectionId,
  token,
  canEdit,
  isFirst,
  isLast,
  allFields,
}: FieldCardProps) {
  const revalidator = useRevalidator();
  const { toast } = useToast();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const response =
        await client.api["form-templates"].fields[field.id].delete();

      if (response.error) {
        toast({
          title: "Error",
          description: "Failed to delete field",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Field deleted successfully",
      });

      revalidator.revalidate();
    } catch (error) {
      console.error("Error deleting field:", error);
      toast({
        title: "Error",
        description: "Failed to delete field",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReorder = async (direction: "up" | "down") => {
    if (isReordering) return;
    setIsReordering(true);
    try {
      const currentIndex = allFields.findIndex((f) => f.id === field.id);
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= allFields.length) return;

      // Create new order array by swapping
      const newOrder = [...allFields];
      [newOrder[currentIndex], newOrder[targetIndex]] = [
        newOrder[targetIndex],
        newOrder[currentIndex],
      ];

      const fieldIds = newOrder.map((f) => f.id);

      const client = createClientEdenTreatyClient(token);
      const response = await client.api["form-templates"].sections[
        sectionId
      ].fields.reorder.post({
        fieldIds,
      });

      if (response.error) {
        toast({
          title: "Error",
          description: "Failed to reorder fields",
          variant: "destructive",
        });
        return;
      }

      revalidator.revalidate();
    } catch (error) {
      console.error("Error reordering fields:", error);
      toast({
        title: "Error",
        description: "Failed to reorder fields",
        variant: "destructive",
      });
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-sm text-muted-foreground">
            {field.fieldOrder}.
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{field.label}</span>
              {field.required && (
                <Asterisk className="h-3 w-3 text-destructive" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {field.fieldType}
              </Badge>
              {field.placeholder && (
                <span className="text-xs text-muted-foreground">
                  Placeholder: {field.placeholder}
                </span>
              )}
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReorder("up")}
              disabled={isFirst || isReordering}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReorder("down")}
              disabled={isLast || isReordering}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      {/* Edit Field Modal */}
      <EditFieldModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        field={field}
        token={token}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the field &quot;{field.label}&quot;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
