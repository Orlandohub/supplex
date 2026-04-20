/**
 * Required Documents List Component
 * Manages the list of required documents in a template
 * Story 2.2.11
 */

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { X, Plus } from "lucide-react";
import type { RequiredDocumentItem } from "@supplex/types";

interface RequiredDocumentsListProps {
  documents: RequiredDocumentItem[];
  onChange: (documents: RequiredDocumentItem[]) => void;
}

export function RequiredDocumentsList({
  documents,
  onChange,
}: RequiredDocumentsListProps) {
  const addDocument = () => {
    onChange([
      ...documents,
      {
        name: "",
        description: "",
        required: true,
        type: "other",
      },
    ]);
  };

  const removeDocument = (index: number) => {
    onChange(documents.filter((_, i) => i !== index));
  };

  const updateDocument = (
    index: number,
    field: keyof RequiredDocumentItem,
    value: any
  ) => {
    const updated = documents.map((doc, i) => {
      if (i === index) {
        return { ...doc, [field]: value };
      }
      return doc;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Required Documents</Label>
        <Button type="button" variant="outline" size="sm" onClick={addDocument}>
          <Plus className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </div>

      {documents.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center border-2 border-dashed rounded-lg">
          No documents added yet. Click &ldquo;Add Document&rdquo; to get
          started.
        </p>
      )}

      {documents.map((doc, index) => (
        <div key={index} className="border rounded-lg p-4 space-y-3 relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => removeDocument(index)}
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="space-y-2 pr-10">
            <Label htmlFor={`doc-name-${index}`}>Document Name *</Label>
            <Input
              id={`doc-name-${index}`}
              value={doc.name}
              onChange={(e) => updateDocument(index, "name", e.target.value)}
              placeholder="e.g., ISO 9001 Certificate"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`doc-description-${index}`}>Description *</Label>
            <Textarea
              id={`doc-description-${index}`}
              value={doc.description}
              onChange={(e) =>
                updateDocument(index, "description", e.target.value)
              }
              placeholder="e.g., Current ISO certification"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`doc-type-${index}`}>Type *</Label>
              <Select
                value={doc.type}
                onValueChange={(value) => updateDocument(index, "type", value)}
              >
                <SelectTrigger id={`doc-type-${index}`}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="certification">Certification</SelectItem>
                  <SelectItem value="tax">Tax</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end pb-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`doc-required-${index}`}
                  checked={doc.required}
                  onCheckedChange={(checked) =>
                    updateDocument(index, "required", checked)
                  }
                />
                <Label
                  htmlFor={`doc-required-${index}`}
                  className="cursor-pointer"
                >
                  Required
                </Label>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
