import { Form, useNavigate, useBeforeUnload } from "@remix-run/react";
import { useEffect, useState } from "react";
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
import { ContactFields } from "./ContactFields";
import { UnsavedChangesModal } from "./UnsavedChangesModal";

interface SupplierFormProps {
  mode: "create" | "edit";
  supplier?: SerializedSupplier;
  isSubmitting: boolean;
  actionData?: any;
}

export function SupplierForm({
  mode,
  supplier,
  isSubmitting,
  actionData,
}: SupplierFormProps) {
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const [formData, setFormData] = useState<any>(
    supplier || {
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
    }
  );

  const storageKey = `supplier-form-draft-${mode}-${supplier?.id || "new"}`;

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
        localStorage.setItem(storageKey, JSON.stringify(formData));
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [formData, isDirty, mode, storageKey]);

  // Warn before unload if form is dirty
  useBeforeUnload(
    isDirty
      ? (event) => {
          event.preventDefault();
        }
      : undefined
  );

  // Handle input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // Handle nested address fields
    if (name.startsWith("address.")) {
      const addressField = name.split(".")[1];
      setFormData((prev: any) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else {
      setFormData((prev: any) => ({
        ...prev,
        [name]: value,
      }));
    }

    if (!isDirty) setIsDirty(true);
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [name]: value,
    }));

    if (!isDirty) setIsDirty(true);
  };

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
      setFormData(draftData);
      setIsDirty(true);
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

  // Get validation errors from actionData
  const errors: Record<string, string> = {};
  if (actionData?.errors) {
    actionData.errors.forEach((error: any) => {
      errors[error.field] = error.message;
    });
  }

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
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="mt-1"
                  placeholder="Enter company name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              {/* Tax ID */}
              <div>
                <Label htmlFor="taxId">
                  Tax ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="taxId"
                  name="taxId"
                  type="text"
                  required
                  value={formData.taxId}
                  onChange={handleInputChange}
                  className="mt-1"
                  placeholder="Enter tax ID"
                />
                {errors.taxId && (
                  <p className="mt-1 text-sm text-red-600">{errors.taxId}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <Label htmlFor="category">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  name="category"
                  value={formData.category}
                  onValueChange={(value) =>
                    handleSelectChange("category", value)
                  }
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
                  value={formData.category}
                />
                {errors.category && (
                  <p className="mt-1 text-sm text-red-600">{errors.category}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select
                  name="status"
                  value={formData.status}
                  onValueChange={(value) => handleSelectChange("status", value)}
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
                <input type="hidden" name="status" value={formData.status} />
                {errors.status && (
                  <p className="mt-1 text-sm text-red-600">{errors.status}</p>
                )}
              </div>

              {/* Website */}
              <div className="md:col-span-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  value={formData.website}
                  onChange={handleInputChange}
                  className="mt-1"
                  placeholder="https://example.com"
                />
                {errors.website && (
                  <p className="mt-1 text-sm text-red-600">{errors.website}</p>
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
                  name="address.street"
                  type="text"
                  required
                  value={formData.address?.street || ""}
                  onChange={handleInputChange}
                  className="mt-1"
                  placeholder="Enter street address"
                />
                {errors["address.street"] && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors["address.street"]}
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
                  name="address.city"
                  type="text"
                  required
                  value={formData.address?.city || ""}
                  onChange={handleInputChange}
                  className="mt-1"
                  placeholder="Enter city"
                />
                {errors["address.city"] && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors["address.city"]}
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
                  name="address.state"
                  type="text"
                  required
                  value={formData.address?.state || ""}
                  onChange={handleInputChange}
                  className="mt-1"
                  placeholder="Enter state"
                />
                {errors["address.state"] && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors["address.state"]}
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
                  name="address.postalCode"
                  type="text"
                  required
                  value={formData.address?.postalCode || ""}
                  onChange={handleInputChange}
                  className="mt-1"
                  placeholder="Enter postal code"
                />
                {errors["address.postalCode"] && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors["address.postalCode"]}
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
                  name="address.country"
                  type="text"
                  required
                  value={formData.address?.country || ""}
                  onChange={handleInputChange}
                  className="mt-1"
                  placeholder="Enter country"
                />
                {errors["address.country"] && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors["address.country"]}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Primary Contact Section */}
          <ContactFields
            formData={formData}
            errors={errors}
            onChange={handleInputChange}
          />

          {/* Notes Section */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              className="mt-1"
              placeholder="Additional notes about this supplier"
              rows={4}
            />
            {errors.notes && (
              <p className="mt-1 text-sm text-red-600">{errors.notes}</p>
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
            <Button type="submit" disabled={isSubmitting}>
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
