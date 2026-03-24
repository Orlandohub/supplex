import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { requireRole } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { UserRole } from "@supplex/types";
import { sessionStorage } from "~/lib/auth/session.server";
import type { Supplier } from "@supplex/types";
import { SupplierForm } from "~/components/suppliers/SupplierForm";
import { Breadcrumb } from "~/components/ui/Breadcrumb";
import { SupplierFormSkeleton } from "~/components/suppliers/SupplierFormSkeleton";

// Type for supplier data after Remix serialization (Dates become strings)
type SerializedSupplier = Omit<
  Supplier,
  "createdAt" | "updatedAt" | "deletedAt" | "certifications"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  certifications: Array<{
    type: string;
    issueDate: string;
    expiryDate: string;
    documentId?: string;
  }>;
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.supplier) {
    return [
      { title: "Edit Supplier | Supplex" },
      { name: "description", content: "Edit supplier information" },
    ];
  }
  return [
    { title: `Edit ${data.supplier.name} | Supplex` },
    {
      name: "description",
      content: `Edit information for ${data.supplier.name}`,
    },
  ];
};

/**
 * Loader function - fetch supplier data and enforce RBAC
 */
export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;

  // Require Admin or Procurement Manager role
  const { session } = await requireRole(args.request, [
    UserRole.ADMIN,
    UserRole.PROCUREMENT_MANAGER,
  ]);

  // Get supplier ID from URL params
  const { id } = params;
  if (!id) {
    throw new Response("Supplier ID is required", { status: 400 });
  }

  // Get auth token
  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  // Fetch supplier from API
  try {
    const response = await client.api.suppliers[id].get();

    // Handle API errors
    if (response.error) {
      const status = response.status || 500;
      if (status === 404) {
        throw new Response("Supplier not found", { status: 404 });
      }
      console.error("API Error:", response.error);
      throw new Response("Failed to load supplier", { status });
    }

    // Validate response data
    if (
      !response.data ||
      typeof response.data !== "object" ||
      !("data" in response.data)
    ) {
      throw new Response("Invalid API response format", { status: 500 });
    }

    const apiResponse = response.data as {
      success: boolean;
      data: { supplier: Supplier };
    };

    return json({
      supplier: apiResponse.data.supplier,
    });
  } catch (error) {
    console.error("Failed to fetch supplier:", error);
    // Re-throw Response errors
    if (error instanceof Response) {
      throw error;
    }
    throw new Response("Failed to load supplier", { status: 500 });
  }
}

/**
 * Action function - handle form submission for updates
 */
export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;

  // Require Admin or Procurement Manager role
  const { session } = await requireRole(request, [
    UserRole.ADMIN,
    UserRole.PROCUREMENT_MANAGER,
  ]);

  const { id } = params;
  if (!id) {
    return json({ error: "Supplier ID is required" }, { status: 400 });
  }

  // Get auth token
  const token = session?.access_token;
  if (!token) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  // Parse form data
  const formData = await request.formData();

  // Build supplier update data object (only include fields that were provided)
  const supplierData: Record<string, unknown> = {
    name: formData.get("name") as string,
    taxId: formData.get("taxId") as string,
    category: formData.get("category") as string,
    status: formData.get("status") as string,
    contactName: formData.get("contactName") as string,
    contactEmail: formData.get("contactEmail") as string,
    address: {
      street: formData.get("address.street") as string,
      city: formData.get("address.city") as string,
      state: formData.get("address.state") as string,
      postalCode: formData.get("address.postalCode") as string,
      country: formData.get("address.country") as string,
    },
  };

  // Optional fields
  const contactPhone = formData.get("contactPhone") as string;
  if (contactPhone) {
    supplierData.contactPhone = contactPhone;
  }

  const website = formData.get("website") as string;
  if (website) {
    supplierData.website = website;
  }

  const notes = formData.get("notes") as string;
  if (notes) {
    supplierData.notes = notes;
  }

  try {
    const response = await client.api.suppliers[id].put(supplierData);

    // Handle not found (404)
    if (response.error && response.status === 404) {
      return json(
        {
          error: "not_found",
          message: "Supplier not found or you don't have access to edit it.",
          formData: supplierData,
        },
        { status: 404 }
      );
    }

    // Handle validation errors (400 Bad Request)
    if (response.error && response.status === 400) {
      const errorData = response.error.value as Record<string, unknown>;
      return json(
        {
          error: "validation",
          errors: (errorData?.error as { errors?: unknown[] })?.errors || [],
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
          message: "Failed to update supplier. Please try again.",
          formData: supplierData,
        },
        { status: 500 }
      );
    }

    // Success - invalidate supplier info cache and redirect to supplier detail page
    // This ensures supplier_user sees updated supplier name immediately
    const remixSession = await sessionStorage.getSession(
      request.headers.get("Cookie")
    );
    remixSession.unset("supplierInfo");
    remixSession.unset("supplierInfoTimestamp");
    
    return redirect(`/suppliers/${id}?success=updated`, {
      headers: {
        "Set-Cookie": await sessionStorage.commitSession(remixSession),
      },
    });
  } catch (error) {
    console.error("Failed to update supplier:", error);
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

export default function EditSupplier() {
  const { supplier } = useLoaderData<typeof loader>() as {
    supplier: SerializedSupplier;
  };
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";
  const isLoading = navigation.state === "loading";

  // Breadcrumb items
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Suppliers", href: "/suppliers" },
    { label: supplier.name, href: `/suppliers/${supplier.id}` },
    { label: "Edit", href: "", isCurrentPage: true },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <SupplierFormSkeleton />
          </div>
        </div>
      </div>
    );
  }

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
              Edit {supplier.name}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Update supplier information
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <SupplierForm
            mode="edit"
            supplier={supplier}
            isSubmitting={isSubmitting}
            actionData={actionData}
          />
        </div>
      </div>
    </div>
  );
}
