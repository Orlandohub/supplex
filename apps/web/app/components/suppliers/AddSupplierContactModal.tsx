import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFetcher, useRevalidator } from "react-router";
import { useEffect } from "react";
import { useToast } from "~/hooks/use-toast";

const addContactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email format").max(255),
  phone: z.string().max(50).optional().or(z.literal("")),
});

type AddContactFormData = z.infer<typeof addContactSchema>;

interface AddSupplierContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  token: string;
}

/**
 * AddSupplierContactModal Component
 *
 * Modal form for adding a contact user to a supplier without one.
 * Creates a new supplier_user and links them to the supplier.
 *
 * Features:
 * - Form validation with Zod
 * - Email uniqueness enforcement
 * - Success toast with contact name
 * - Automatic page revalidation after creation
 * - Error handling for duplicate emails and server errors
 */
export function AddSupplierContactModal({
  isOpen,
  onClose,
  supplierId,
  token: _token,
}: AddSupplierContactModalProps) {
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const { toast } = useToast();

  const form = useForm<AddContactFormData>({
    resolver: zodResolver(addContactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
    },
  });

  const { formState, handleSubmit, setError, reset } = form;
  const { errors, isSubmitting } = formState;

  // Handle API response
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success) {
        const contactName =
          fetcher.data.data?.supplierUser?.fullName || "contact";
        toast({
          title: "Contact added successfully",
          description: `Platform access granted to ${contactName}.`,
        });
        reset(); // Clear form
        onClose();
        revalidator.revalidate(); // Refresh page data
      } else if (fetcher.data.error?.code === "USER_EMAIL_EXISTS") {
        setError("email", {
          type: "manual",
          message: "A user with this email already exists",
        });
      } else if (fetcher.data.error?.code === "SUPPLIER_HAS_CONTACT") {
        toast({
          title: "Cannot add contact",
          description: "This supplier already has a contact user.",
          variant: "destructive",
        });
        onClose();
      } else {
        toast({
          title: "Failed to add contact",
          description: fetcher.data.error?.message || "An error occurred",
          variant: "destructive",
        });
      }
    }
  }, [fetcher.data, onClose, revalidator, setError, toast, reset]);

  const onSubmit = (data: AddContactFormData) => {
    fetcher.submit(
      {
        intent: "add-contact",
        supplierId,
        name: data.name,
        email: data.email,
        phone: data.phone || "",
      },
      { method: "post" }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Supplier Contact</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-600 mb-4">
          Create a user account for this supplier to access the platform and
          manage their tasks.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Contact Name */}
          <div>
            <Label htmlFor="name">Contact Name *</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="Enter contact name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
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
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">
                {errors.email.message}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              This email will be used for platform login
            </p>
          </div>

          {/* Contact Phone */}
          <div>
            <Label htmlFor="phone">Contact Phone</Label>
            <Input
              id="phone"
              type="tel"
              {...form.register("phone")}
              placeholder="+1 (555) 123-4567"
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600">
                {errors.phone.message}
              </p>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <strong>â„¹ï¸ Note:</strong> This user will be assigned the
              &apos;Supplier User&apos; role and can view their own supplier
              information and tasks only.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
