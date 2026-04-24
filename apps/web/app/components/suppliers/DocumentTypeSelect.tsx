import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { DocumentType } from "@supplex/types";

interface DocumentTypeSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Document Type Select Component
 *
 * Dropdown for selecting document type
 * Maps DocumentType enum to human-readable labels
 *
 * Acceptance Criteria: AC #2, #5
 */
export function DocumentTypeSelect({
  value,
  onValueChange,
  disabled = false,
}: DocumentTypeSelectProps) {
  // Map enum values to human-readable labels
  const documentTypeLabels: Record<DocumentType, string> = {
    [DocumentType.CERTIFICATE]: "Certificate",
    [DocumentType.CONTRACT]: "Contract",
    [DocumentType.INSURANCE]: "Insurance",
    [DocumentType.AUDIT_REPORT]: "Audit Report",
    [DocumentType.WORKFLOW_DOCUMENT]: "Workflow Document",
    [DocumentType.OTHER]: "Other",
  };

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select document type" />
      </SelectTrigger>
      <SelectContent>
        {Object.values(DocumentType).map((type) => (
          <SelectItem key={type} value={type}>
            {documentTypeLabels[type]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
