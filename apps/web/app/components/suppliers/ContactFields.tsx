import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface ContactFieldsProps {
  formData: any;
  errors: Record<string, string>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * ContactFields Component
 * Renders primary contact fields for supplier form
 *
 * Current Implementation: Single primary contact (MVP)
 * - contactName (required)
 * - contactEmail (required, email validation)
 * - contactPhone (optional, tel input type)
 *
 * TODO: Future enhancement (Story 1.11) - Support multiple contacts with title,
 * isPrimary via contacts JSONB array
 */
export function ContactFields({
  formData,
  errors,
  onChange,
}: ContactFieldsProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Primary Contact
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact Name */}
        <div>
          <Label htmlFor="contactName">
            Contact Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="contactName"
            name="contactName"
            type="text"
            required
            value={formData.contactName || ""}
            onChange={onChange}
            className="mt-1"
            placeholder="Enter contact name"
          />
          {errors.contactName && (
            <p className="mt-1 text-sm text-red-600">{errors.contactName}</p>
          )}
        </div>

        {/* Contact Email */}
        <div>
          <Label htmlFor="contactEmail">
            Contact Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            value={formData.contactEmail || ""}
            onChange={onChange}
            className="mt-1"
            placeholder="contact@example.com"
          />
          {errors.contactEmail && (
            <p className="mt-1 text-sm text-red-600">{errors.contactEmail}</p>
          )}
        </div>

        {/* Contact Phone */}
        <div>
          <Label htmlFor="contactPhone">Contact Phone</Label>
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            value={formData.contactPhone || ""}
            onChange={onChange}
            className="mt-1"
            placeholder="+1 (555) 000-0000"
          />
          {errors.contactPhone && (
            <p className="mt-1 text-sm text-red-600">{errors.contactPhone}</p>
          )}
        </div>
      </div>
    </div>
  );
}
