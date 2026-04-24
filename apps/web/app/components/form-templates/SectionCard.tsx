/**
 * Section Card Component
 * Displays a section with its fields and actions
 * Updated: Story 2.2.14 - Removed versionId
 */

import { useState } from "react";
import { useRevalidator } from "react-router";
import type { FormSectionWithFieldsUI } from "@supplex/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { Plus, Edit, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { FieldCard } from "./FieldCard";
import { EditSectionModal } from "./EditSectionModal";
import { AddFieldModal } from "./AddFieldModal";

interface SectionCardProps {
  section: FormSectionWithFieldsUI;
  templateId: string;
  token: string;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  allSections: FormSectionWithFieldsUI[];
}

export function SectionCard({
  section,
  templateId,
  token,
  canEdit,
  isFirst,
  isLast,
  allSections,
}: SectionCardProps) {
  const revalidator = useRevalidator();
  const { toast } = useToast();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const fields = section.fields.sort((a, b) => a.fieldOrder - b.fieldOrder);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const response = await (client.api["form-templates"].sections as any)[
        section.id
      ].delete();

      if (response.error) {
        toast({
          title: "Error",
          description: "Failed to delete section",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Section deleted successfully",
      });

      revalidator.revalidate();
    } catch (error) {
      console.error("Error deleting section:", error);
      toast({
        title: "Error",
        description: "Failed to delete section",
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
      const currentIndex = allSections.findIndex((s) => s.id === section.id);
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= allSections.length) return;

      // Create new order array by swapping
      const newOrder = [...allSections];
      const a = newOrder[currentIndex];
      const b = newOrder[targetIndex];
      if (!a || !b) return;
      newOrder[currentIndex] = b;
      newOrder[targetIndex] = a;

      const sectionIds = newOrder.map((s) => s.id);

      const client = createClientEdenTreatyClient(token);
      const response = await (client.api["form-templates"] as any)[
        templateId
      ].sections.reorder.post({
        sectionIds,
      });

      if (response.error) {
        toast({
          title: "Error",
          description: "Failed to reorder sections",
          variant: "destructive",
        });
        return;
      }

      revalidator.revalidate();
    } catch (error) {
      console.error("Error reordering sections:", error);
      toast({
        title: "Error",
        description: "Failed to reorder sections",
        variant: "destructive",
      });
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>{section.title}</CardTitle>
                <span className="text-sm text-muted-foreground">
                  (Order: {section.sectionOrder})
                </span>
              </div>
              {section.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {section.description}
                </p>
              )}
            </div>
            {canEdit && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReorder("up")}
                  disabled={isFirst || isReordering}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReorder("down")}
                  disabled={isLast || isReordering}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                Fields ({fields.length})
              </h4>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddFieldModalOpen(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Field
                </Button>
              )}
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No fields yet. Add your first field to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <FieldCard
                    key={field.id}
                    field={field}
                    sectionId={section.id}
                    token={token}
                    canEdit={canEdit}
                    isFirst={index === 0}
                    isLast={index === fields.length - 1}
                    allFields={fields}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Section Modal */}
      <EditSectionModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        section={section}
        token={token}
      />

      {/* Add Field Modal */}
      <AddFieldModal
        open={isAddFieldModalOpen}
        onOpenChange={setIsAddFieldModalOpen}
        sectionId={section.id}
        token={token}
        nextOrder={fields.length + 1}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the section and all its fields ({fields.length}{" "}
              fields). This action cannot be undone.
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
