/**
 * Add Section Modal Component
 * Modal form for adding a new section to a form template
 * Updated: Story 2.2.14 - Removed versionId
 */

import { useState } from "react";
import { useRevalidator } from "@remix-run/react";
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

interface AddSectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  token: string;
  nextOrder: number;
}

export function AddSectionModal({
  open,
  onOpenChange,
  templateId,
  token,
  nextOrder,
}: AddSectionModalProps) {
  const revalidator = useRevalidator();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api["form-templates"][templateId].sections.post({
        title: title.trim(),
        description: description.trim() || undefined,
        sectionOrder: nextOrder,
      });

      if (response.error) {
        toast({
          title: "Error",
          description: "Failed to create section",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Section created successfully",
      });

      // Reset form and close
      setTitle("");
      setDescription("");
      onOpenChange(false);
      revalidator.revalidate();
    } catch (error) {
      console.error("Error creating section:", error);
      toast({
        title: "Error",
        description: "Failed to create section",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTitle("");
      setDescription("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
            <DialogDescription>
              Create a new section to group related fields
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Section Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Company Information"
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
                placeholder="Brief description of this section"
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
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? "Creating..." : "Create Section"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

