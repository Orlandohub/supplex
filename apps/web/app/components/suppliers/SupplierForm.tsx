import { Form, useNavigate, useBeforeUnload } from "@remix-run/react";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  SupplierCategory,
  SupplierStatus,
  type SerializedSupplier,
} from "@supplex/types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { UnsavedChangesModal } from "./UnsavedChangesModal";

// Form validation schema
const supplierFormSchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  taxId: z.string().min(1, "Tax ID is required").max(50),
  category: z.nativeEnum(SupplierCategory),
  status: z.nativeEnum(SupplierStatus),
  contactName: z.string().min(1, "Contact name is required").max(200),
  contactEmail: z.string().email("Invalid email format").max(255),
  contactPhone: z.string().max(50).optional().or(z.literal("")),
  address: z.object({
    street: z.string().min(1, "Street is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    postalCode: z.string().min(1, "Postal code is required"),
    country: z.string().min(1, "Country is required"),
  }),
  website: z.string().url("Invalid URL format").optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type SupplierFormData = z.infer<typeof supplierFormSchema>;

interface SupplierFormProps {
  mode: "create" | "edit";
  supplier?: SerializedSupplier;
  isSubmitting: boolean;
  actionData?: {
    error?: string;
    duplicate?: { id: string; name: string };
  };
}

export function SupplierForm({
  mode,
  supplier,
  isSubmitting,
  actionData,
}: SupplierFormProps) {
  const navigate = useNavigate();
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftData, setDraftData] = useState<SupplierFormData | null>(null);

  const storageKey = `supplier-form-draft-${mode}-${supplier?.id || "new"}`;

  // Initialize React Hook Form
  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
    mode: "onBlur", // Validate on blur for better UX
    defaultValues: supplier
      ? {
          name: supplier.name,
          taxId: supplier.taxId,
          category: supplier.category,
          status: supplier.status,
          contactName: supplier.contactName,
          contactEmail: supplier.contactEmail,
          contactPhone: supplier.contactPhone || "",
          address: supplier.address,
          website: supplier.metadata?.website || "",
          notes: supplier.metadata?.notes || "",
        }
      : {
          name: "",
          taxId: "",
          category: SupplierCategory.RAW_MATERIALS,
          status: SupplierStatus.PROSPECT,
          contactName: "",
          contactEmail: "",
          contactPhone: "",
          address: {
            street: "",
            city: "",
            state: "",
            postalCode: "",
            country: "",
          },
          website: "",
          notes: "",
        },
  });

  const { formState, watch } = form;
  const { errors, isDirty, isValid } = formState;
  const formValues = watch();

  // Load draft from localStorage on mount
  useEffect(() => {
    if (mode === "create") {
      const draft = localStorage.getItem(storageKey);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          setDraftData(parsed);
          setShowDraftPrompt(true);
        } catch (error) {
          console.error("Failed to parse draft:", error);
          localStorage.removeItem(storageKey);
        }
      }
    }
  }, [mode, storageKey]);

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    if (isDirty && mode === "create") {
      const timer = setTimeout(() => {
        localStorage.setItem(storageKey, JSON.stringify(formValues));
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [formValues, isDirty, mode, storageKey]);

  // Warn before unload if form is dirty
  useBeforeUnload(
    isDirty
      ? (event) => {
          event.preventDefault();
        }
      : undefined
  );

  // Handle cancel
  const handleCancel = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      navigate(mode === "edit" ? `/suppliers/${supplier?.id}` : "/suppliers");
    }
  };

  // Handle restore draft
  const handleRestoreDraft = () => {
    if (draftData) {
      form.reset(draftData);
    }
    setShowDraftPrompt(false);
  };

  // Handle discard draft
  const handleDiscardDraft = () => {
    localStorage.removeItem(storageKey);
    setShowDraftPrompt(false);
  };

  // Clear draft on successful submission
  useEffect(() => {
    if (actionData?.success || (!actionData?.error && !isSubmitting)) {
      localStorage.removeItem(storageKey);
    }
  }, [actionData, isSubmitting, storageKey]);

  return (
    <>
      <Form method="post" className="p-6">
        <input type="hidden" name="forceSave" value="false" />

        <div className="space-y-6">
          {/* Company Information Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Company Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Company Name */}
              <div>
                <Label htmlFor="name">
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  className="mt-1"
                  placeholder="Enter company name"
                  {...form.register("name")}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Tax ID */}
              <div>
                <Label htmlFor="taxId">
                  Tax ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="taxId"
                  type="text"
                  className="mt-1"
                  placeholder="Enter tax ID"
                  {...form.register("taxId")}
                />
                {errors.taxId && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.taxId.message}
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <Label htmlFor="category">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Controller
                  name="category"
                  control={form.control}
                  render={({ field }) => (
                    <>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SupplierCategory.RAW_MATERIALS}>
                            Raw Materials
                          </SelectItem>
                          <SelectItem value={SupplierCategory.COMPONENTS}>
                            Components
                          </SelectItem>
                          <SelectItem value={SupplierCategory.SERVICES}>
                            Services
                          </SelectItem>
                          <SelectItem value={SupplierCategory.PACKAGING}>
                            Packaging
                          </SelectItem>
                          <SelectItem value={SupplierCategory.LOGISTICS}>
                            Logistics
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <input
                        type="hidden"
                        name="category"
                        value={field.value}
                      />
                    </>
                  )}
                />
                {errors.category && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.category.message}
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Controller
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SupplierStatus.PROSPECT}>
                            Prospect
                          </SelectItem>
                          <SelectItem value={SupplierStatus.QUALIFIED}>
                            Qualified
                          </SelectItem>
                          <SelectItem value={SupplierStatus.APPROVED}>
                            Approved
                          </SelectItem>
                          <SelectItem value={SupplierStatus.CONDITIONAL}>
                            Conditional
                          </SelectItem>
                          <SelectItem value={SupplierStatus.BLOCKED}>
                            Blocked
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <input type="hidden" name="status" value={field.value} />
                    </>
                  )}
                />
                {errors.status && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.status.message}
                  </p>
                )}
              </div>

              {/* Website */}
              <div className="md:col-span-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  className="mt-1"
                  placeholder="https://example.com"
                  {...form.register("website")}
                />
                {errors.website && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.website.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Address
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Street */}
              <div className="md:col-span-2">
                <Label htmlFor="address.street">
                  Street <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address.street"
                  type="text"
                  className="mt-1"
                  placeholder="Enter street address"
                  {...form.register("address.street")}
                />
                {errors.address?.street && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.address.street.message}
                  </p>
                )}
              </div>

              {/* City */}
              <div>
                <Label htmlFor="address.city">
                  City <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address.city"
                  type="text"
                  className="mt-1"
                  placeholder="Enter city"
                  {...form.register("address.city")}
                />
                {errors.address?.city && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.address.city.message}
                  </p>
                )}
              </div>

              {/* State */}
              <div>
                <Label htmlFor="address.state">
                  State <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address.state"
                  type="text"
                  className="mt-1"
                  placeholder="Enter state"
                  {...form.register("address.state")}
                />
                {errors.address?.state && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.address.state.message}
                  </p>
                )}
              </div>

              {/* Postal Code */}
              <div>
                <Label htmlFor="address.postalCode">
                  Postal Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address.postalCode"
                  type="text"
                  className="mt-1"
                  placeholder="Enter postal code"
                  {...form.register("address.postalCode")}
                />
                {errors.address?.postalCode && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.address.postalCode.message}
                  </p>
                )}
              </div>

              {/* Country */}
              <div>
                <Label htmlFor="address.country">
                  Country <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address.country"
                  type="text"
                  className="mt-1"
                  placeholder="Enter country"
                  {...form.register("address.country")}
                />
                {errors.address?.country && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.address.country.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Primary Contact Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Primary Contact
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact Name */}
              <div>
                <Label htmlFor="contactName">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contactName"
                  type="text"
                  className="mt-1"
                  placeholder="Enter contact name"
                  {...form.register("contactName")}
                />
                {errors.contactName && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.contactName.message}
                  </p>
                )}
              </div>

              {/* Contact Email */}
              <div>
                <Label htmlFor="contactEmail">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  className="mt-1"
                  placeholder="contact@example.com"
                  {...form.register("contactEmail")}
                />
                {errors.contactEmail && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.contactEmail.message}
                  </p>
                )}
              </div>

              {/* Contact Phone */}
              <div className="md:col-span-2">
                <Label htmlFor="contactPhone">Phone</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  className="mt-1"
                  placeholder="+1 (555) 123-4567"
                  {...form.register("contactPhone")}
                />
                {errors.contactPhone && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.contactPhone.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              className="mt-1"
              placeholder="Additional notes about this supplier"
              rows={4}
              {...form.register("notes")}
            />
            {errors.notes && (
              <p className="mt-1 text-sm text-red-600">
                {errors.notes.message}
              </p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting
                ? mode === "create"
                  ? "Creating..."
                  : "Saving..."
                : mode === "create"
                  ? "Create Supplier"
                  : "Save Changes"}
            </Button>
          </div>

          {/* Error Messages */}
          {actionData?.error && actionData.error !== "duplicate" && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                {actionData.message || "An error occurred. Please try again."}
              </p>
            </div>
          )}
        </div>
      </Form>

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onClose={() => setShowUnsavedModal(false)}
        onLeave={() => {
          localStorage.removeItem(storageKey);
          navigate(
            mode === "edit" ? `/suppliers/${supplier?.id}` : "/suppliers"
          );
        }}
      />

      {/* Draft Restore Prompt */}
      {showDraftPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-2">Restore Draft?</h3>
            <p className="text-gray-600 mb-4">
              You have unsaved changes from a previous session. Would you like
              to restore them?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleDiscardDraft}>
                Discard
              </Button>
              <Button onClick={handleRestoreDraft}>Restore</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
