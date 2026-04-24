import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "react-router";
import { data as json, redirect } from "react-router";
import { useActionData, useNavigation } from "react-router";
import { requireRole } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { UserRole } from "@supplex/types";
import { SupplierForm } from "~/components/suppliers/SupplierForm";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useState, useEffect } from "react";
import { DuplicateWarningModal } from "~/components/suppliers/DuplicateWarningModal";
import { InvitationLinkModal } from "~/components/suppliers/InvitationLinkModal";
import { useNavigate } from "react-router";

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
  const createPlatformAccess = formData.get("createPlatformAccess") === "on";

  // Build supplier data object
  const supplierData: any = {
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

  // Add supplier contact if platform access is requested
  if (createPlatformAccess) {
    const contactName = formData.get("supplierContact.name") as string;
    const contactEmail = formData.get("supplierContact.email") as string;
    const contactPhone =
      (formData.get("supplierContact.phone") as string) || undefined;

    if (contactName && contactEmail) {
      supplierData.supplierContact = {
        name: contactName,
        email: contactEmail,
        phone: contactPhone,
      };
    }
  }

  try {
    const response = await client.api.suppliers.post(supplierData);

    // Handle duplicate detection (409 Conflict)
    if (response.error && response.status === 409) {
      const errorData = response.error.value as {
        error?: { code?: string; duplicates?: unknown[]; message?: string };
      };

      // Check if it's a USER_EMAIL_EXISTS error
      if (errorData?.error?.code === "USER_EMAIL_EXISTS") {
        return json(
          {
            error: "email_exists",
            message:
              errorData.error.message ||
              "A user with this email already exists",
            formData: supplierData,
          },
          { status: 409 }
        );
      }

      // Otherwise it's a duplicate supplier
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
      const errorData = response.error.value as {
        error?: { errors?: unknown[]; message?: string };
      };
      return json(
        {
          error: "validation",
          message: errorData?.error?.message || "Validation failed",
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
      data: {
        supplier: { id: string };
        supplierUser?: { id: string; email: string; fullName: string };
        invitationToken?: string;
      };
    };

    // If invitation token is present, return it for display in modal
    if (apiResponse.data.invitationToken) {
      return json({
        success: true,
        supplierId: apiResponse.data.supplier.id,
        invitationToken: apiResponse.data.invitationToken,
        supplierUser: apiResponse.data.supplierUser,
      });
    }

    // Success without invitation - redirect to supplier detail page
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

type SupplierCreateActionData =
  | {
      error?: string;
      message?: string;
      duplicates?: unknown[];
      formData?: Record<string, unknown>;
      errors?: unknown[];
      success?: undefined;
      supplierId?: undefined;
      invitationToken?: undefined;
      supplierUser?: undefined;
    }
  | {
      success: boolean;
      supplierId: string;
      invitationToken: string;
      supplierUser: { id: string; email: string; fullName: string } | undefined;
      error?: undefined;
      message?: undefined;
      duplicates?: undefined;
      formData?: undefined;
      errors?: undefined;
    }
  | undefined;

export default function CreateSupplier() {
  const actionData = useActionData<typeof action>() as SupplierCreateActionData;
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [showDuplicateModal, setShowDuplicateModal] = useState(
    actionData?.error === "duplicate"
  );
  const [showInvitationModal, setShowInvitationModal] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  // Show invitation modal if we have an invitation token
  useEffect(() => {
    if (actionData?.success && actionData?.invitationToken) {
      setShowInvitationModal(true);
    }
  }, [actionData]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/suppliers")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Suppliers
            </Button>
          </div>

          {/* Page Title */}
          <div>
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
          duplicates={(actionData.duplicates as any[]) || []}
          formData={actionData.formData as any}
          onSaveAnyway={() => {
            // The form will be resubmitted with forceSave=true
            setShowDuplicateModal(false);
          }}
        />
      )}

      {/* Invitation Link Modal */}
      {showInvitationModal &&
        actionData?.success &&
        actionData?.invitationToken && (
          <InvitationLinkModal
            isOpen={showInvitationModal}
            onClose={() => {
              setShowInvitationModal(false);
              // Navigate to supplier detail page after closing modal
              navigate(`/suppliers/${actionData.supplierId}?success=created`);
            }}
            invitationToken={actionData.invitationToken}
            supplierUser={actionData.supplierUser}
          />
        )}
    </div>
  );
}
