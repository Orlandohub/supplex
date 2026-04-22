/**
 * Edit Section Modal Component
 * Modal form for editing an existing section
 */

import { useState, useEffect } from "react";
import { useRevalidator } from "react-router";
import type { FormSectionWithFields } from "@supplex/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/hooks/use-toast";
import { createClientEdenTreatyClient } from "~/lib/api-client";

interface EditSectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: FormSectionWithFields;
  token: string;
}

export function EditSectionModal({
  open,
  onOpenChange,
  section,
  token,
}: EditSectionModalProps) {
  const revalidator = useRevalidator();
  const { toast } = useToast();

  const [title, setTitle] = useState(section.title);
  const [description, setDescription] = useState(section.description || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when section changes
  useEffect(() => {
    setTitle(section.title);
    setDescription(section.description || "");
  }, [section]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api["form-templates"].sections[
        section.id
      ].patch({
        title: title.trim(),
        description: description.trim() || undefined,
      });

      if (response.error) {
        toast({
          title: "Error",
          description: "Failed to update section",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Section updated successfully",
      });

      onOpenChange(false);
      revalidator.revalidate();
    } catch (error) {
      console.error("Error updating section:", error);
      toast({
        title: "Error",
        description: "Failed to update section",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
            <DialogDescription>Update section details</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Section Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
