import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigation } from "@remix-run/react";
import { requireRole } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { UserRole } from "@supplex/types";
import { SupplierForm } from "~/components/suppliers/SupplierForm";
import { Breadcrumb } from "~/components/ui/Breadcrumb";
import { useState } from "react";
import { DuplicateWarningModal } from "~/components/suppliers/DuplicateWarningModal";

export const meta: MetaFunction = () => {
  return [
    { title: "Create Supplier | Supplex" },
    { name: "description", content: "Create a new supplier" },
  ];
};

/**
 * Loader function - enforce authentication and RBAC
 */
export async function loader(args: LoaderFunctionArgs) {
  // Require Admin or Procurement Manager role
  await requireRole(args.request, [
    UserRole.ADMIN,
    UserRole.PROCUREMENT_MANAGER,
  ]);

  return json({});
}

/**
 * Action function - handle form submission
 */
export async function action(args: ActionFunctionArgs) {
  const { request } = args;

  // Require Admin or Procurement Manager role
  const { session } = await requireRole(request, [
    UserRole.ADMIN,
    UserRole.PROCUREMENT_MANAGER,
  ]);

  // Get auth token
  const token = session?.access_token;
  if (!token) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  // Parse form data
  const formData = await request.formData();
  const forceSave = formData.get("forceSave") === "true";

  // Build supplier data object
  const supplierData = {
    name: formData.get("name") as string,
    taxId: formData.get("taxId") as string,
    category: formData.get("category") as string,
    status: formData.get("status") as string,
    contactName: formData.get("contactName") as string,
    contactEmail: formData.get("contactEmail") as string,
    contactPhone: (formData.get("contactPhone") as string) || undefined,
    address: {
      street: formData.get("address.street") as string,
      city: formData.get("address.city") as string,
      state: formData.get("address.state") as string,
      postalCode: formData.get("address.postalCode") as string,
      country: formData.get("address.country") as string,
    },
    website: (formData.get("website") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
    forceSave,
  };

  try {
    const response = await client.api.suppliers.post(supplierData);

    // Handle duplicate detection (409 Conflict)
    if (response.error && response.status === 409) {
      const errorData = response.error.value as any;
      return json(
        {
          error: "duplicate",
          duplicates: errorData?.error?.duplicates || [],
          formData: supplierData,
        },
        { status: 409 }
      );
    }

    // Handle validation errors (400 Bad Request)
    if (response.error && response.status === 400) {
      const errorData = response.error.value as any;
      return json(
        {
          error: "validation",
          errors: errorData?.error?.errors || [],
          formData: supplierData,
        },
        { status: 400 }
      );
    }

    // Handle other errors
    if (response.error) {
      console.error("API Error:", response.error);
      return json(
        {
          error: "server",
          message: "Failed to create supplier. Please try again.",
          formData: supplierData,
        },
        { status: 500 }
      );
    }

    // Validate response data
    if (
      !response.data ||
      typeof response.data !== "object" ||
      !("data" in response.data)
    ) {
      return json(
        {
          error: "server",
          message: "Invalid API response format",
          formData: supplierData,
        },
        { status: 500 }
      );
    }

    const apiResponse = response.data as {
      success: boolean;
      data: { supplier: { id: string } };
    };

    // Success - redirect to supplier detail page with success message
    return redirect(
      `/suppliers/${apiResponse.data.supplier.id}?success=created`
    );
  } catch (error) {
    console.error("Failed to create supplier:", error);
    return json(
      {
        error: "server",
        message: "An unexpected error occurred. Please try again.",
        formData: supplierData,
      },
      { status: 500 }
    );
  }
}

export default function CreateSupplier() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showDuplicateModal, setShowDuplicateModal] = useState(
    actionData?.error === "duplicate"
  );

  const isSubmitting = navigation.state === "submitting";

  // Breadcrumb items
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Suppliers", href: "/suppliers" },
    { label: "Create", href: "", isCurrentPage: true },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Breadcrumb */}
          <Breadcrumb items={breadcrumbItems} />

          {/* Page Title */}
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Create Supplier
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Add a new supplier to your organization
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <SupplierForm
            mode="create"
            isSubmitting={isSubmitting}
            actionData={actionData}
          />
        </div>
      </div>

      {/* Duplicate Warning Modal */}
      {showDuplicateModal && actionData?.error === "duplicate" && (
        <DuplicateWarningModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          duplicates={actionData.duplicates || []}
          onSaveAnyway={() => {
            // The form will be resubmitted with forceSave=true
            setShowDuplicateModal(false);
          }}
        />
      )}
    </div>
  );
}
