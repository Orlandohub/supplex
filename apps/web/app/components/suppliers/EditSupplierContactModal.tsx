import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRevalidator } from "react-router";
import { useEffect, useState } from "react";
import { useToast } from "~/hooks/use-toast";
import { createEdenTreatyClient } from "~/lib/api-client";

const editContactSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email format").max(255),
  isActive: z.boolean(),
});

type EditContactFormData = z.infer<typeof editContactSchema>;

interface EditSupplierContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierUser: {
    id: string;
    email: string;
    fullName: string;
    isActive: boolean;
  };
  supplierId: string;
  token: string;
}

/**
 * EditSupplierContactModal Component
 *
 * Modal form for editing supplier contact information
 * Uses React Hook Form with Zod validation
 *
 * Features:
 * - Edit contact name, email, and access status
 * - Validation with helpful error messages
 * - Confirmation dialog when deactivating user
 * - Duplicate email error handling (409)
 * - Page revalidation after successful update (refreshes data + cache)
 */
export function EditSupplierContactModal({
  isOpen,
  onClose,
  supplierUser,
  supplierId,
  token,
}: EditSupplierContactModalProps) {
  const revalidator = useRevalidator();
  const { toast } = useToast();
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditContactFormData>({
    resolver: zodResolver(editContactSchema),
    defaultValues: {
      fullName: supplierUser.fullName,
      email: supplierUser.email,
      isActive: supplierUser.isActive,
    },
  });

  const { formState, watch, handleSubmit, setError, reset } = form;
  const { errors } = formState;
  const isActiveValue = watch("isActive");

  // Reset form when modal opens/closes or supplierUser changes
  useEffect(() => {
    if (isOpen) {
      reset({
        fullName: supplierUser.fullName,
        email: supplierUser.email,
        isActive: supplierUser.isActive,
      });
    }
  }, [isOpen, supplierUser, reset]);

  const onSubmit = async (data: EditContactFormData) => {
    // If deactivating, show confirmation first
    if (!data.isActive && supplierUser.isActive && !showDeactivateConfirm) {
      setShowDeactivateConfirm(true);
      return;
    }

    setIsSubmitting(true);

    try {
      // Create API client with token from loader (passed via props)
      const client = createEdenTreatyClient(token);

      // Submit update request
      const response = await (client.api.suppliers as any)[
        supplierId
      ].contact.patch({
        fullName: data.fullName,
        email: data.email,
        isActive: data.isActive,
      });

      if (response.error) {
        const errorData = response.data as any;

        // Handle duplicate email error (409)
        if (
          response.status === 409 ||
          errorData?.error?.code === "USER_EMAIL_EXISTS"
        ) {
          setError("email", {
            type: "manual",
            message: "A user with this email already exists",
          });
          toast({
            title: "Email already exists",
            description: "Please choose a different email address",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Update failed",
            description:
              errorData?.error?.message ||
              "Failed to update contact information",
            variant: "destructive",
          });
        }
        setIsSubmitting(false);
        return;
      }

      // Success!
      toast({
        title: "Contact updated successfully",
        description: "The supplier contact information has been saved.",
        variant: "success",
      });

      // Close modal and reset confirmation state
      setShowDeactivateConfirm(false);
      onClose();

      // Revalidate page data (refreshes loader data including session cache)
      revalidator.revalidate();
    } catch (error) {
      console.error("Failed to update contact:", error);
      toast({
        title: "Update failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={isOpen && !showDeactivateConfirm}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Supplier Contact</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Contact Name */}
            <div>
              <Label htmlFor="fullName">Contact Name *</Label>
              <Input
                id="fullName"
                {...form.register("fullName")}
                placeholder="Enter contact name"
                disabled={isSubmitting}
              />
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Contact Email */}
            <div>
              <Label htmlFor="email">Contact Email *</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="contact@supplier.com"
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Access Status Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="isActive">Platform Access</Label>
                <p className="text-sm text-gray-500">
                  {isActiveValue
                    ? "User can access the platform"
                    : "User access is disabled"}
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActiveValue}
                onCheckedChange={(checked) =>
                  form.setValue("isActive", checked)
                }
                disabled={isSubmitting}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivation Confirmation Modal */}
      <Dialog
        open={showDeactivateConfirm}
        onOpenChange={setShowDeactivateConfirm}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Supplier Contact?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-4">
            This user will no longer be able to access the platform. Any pending
            tasks may need to be reassigned in the future.
          </p>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeactivateConfirm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDeactivateConfirm(false);
                handleSubmit(onSubmit)();
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deactivating..." : "Deactivate User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
