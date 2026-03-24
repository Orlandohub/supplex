import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { SupplierContactCard } from "./SupplierContactCard";
import type { SupplierCategory, SupplierStatus } from "@supplex/types";
import { MapPin, Mail, Phone, Globe, User } from "lucide-react";

interface SupplierOverviewProps {
  supplier: {
    id: string;
    name: string;
    taxId: string;
    category: SupplierCategory;
    status: SupplierStatus;
    performanceScore: number | null;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    address: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    certifications: Array<{
      type: string;
      issueDate: string;
      expiryDate: string;
      documentId?: string;
    }>;
    metadata: Record<string, unknown>;
    riskScore: number | null;
    createdAt: string;
    updatedAt: string;
    createdByName?: string;
    createdByEmail?: string | null;
  };
  supplierUser?: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    status: string;
    isActive: boolean;
  } | null;
  token: string;
}

/**
 * Map category enum to readable labels
 */
const categoryLabels: Record<string, string> = {
  raw_materials: "Raw Materials",
  components: "Components",
  services: "Services",
  packaging: "Packaging",
  logistics: "Logistics",
};

/**
 * Format date string to readable format
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Supplier Overview Component
 *
 * Displays comprehensive supplier information including:
 * - Company details (name, tax ID, status)
 * - Contact information
 * - Address
 * - Categories and certifications
 * - Metadata and notes
 * - Audit information (created by, dates)
 */
export function SupplierOverview({ supplier, supplierUser, token }: SupplierOverviewProps) {
  const address = supplier.address;

  const _getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending_activation":
        return "bg-yellow-100 text-yellow-800";
      case "deactivated":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const _getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "pending_activation":
        return "Pending Activation";
      case "deactivated":
        return "Deactivated";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Information Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {supplier.name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Tax ID: {supplier.taxId}
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <StatusBadge status={supplier.status} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Primary Contact
                  </p>
                  <p className="text-sm text-gray-900">
                    {supplier.contactName}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Email</p>
                  <a
                    href={`mailto:${supplier.contactEmail}`}
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {supplier.contactEmail}
                  </a>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Phone className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Phone</p>
                  <a
                    href={`tel:${supplier.contactPhone}`}
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {supplier.contactPhone}
                  </a>
                </div>
              </div>

              {supplier.metadata?.website && (
                <div className="flex items-start space-x-3">
                  <Globe className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Website</p>
                    <a
                      href={supplier.metadata.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {supplier.metadata.website}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>


          {/* Address */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Address
            </h3>
            <div className="flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-900">{address.street}</p>
                <p className="text-sm text-gray-900">
                  {address.city}, {address.state} {address.postalCode}
                </p>
                <p className="text-sm text-gray-900">{address.country}</p>
              </div>
            </div>
          </div>

          {/* Category */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Category
            </h3>
            <Badge variant="secondary">
              {categoryLabels[supplier.category] || supplier.category}
            </Badge>
          </div>

          {/* Performance & Risk Scores */}
          {(supplier.performanceScore !== null ||
            supplier.riskScore !== null) && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Metrics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {supplier.performanceScore !== null && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Performance Score
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {supplier.performanceScore}/5
                    </p>
                  </div>
                )}
                {supplier.riskScore !== null && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Risk Score
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {supplier.riskScore}/10
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Certifications */}
          {supplier.certifications.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Certifications
              </h3>
              <div className="space-y-3">
                {supplier.certifications.map((cert, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {cert.type}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Issued: {formatDate(cert.issueDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Expires:</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(cert.expiryDate)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {supplier.metadata?.notes && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Notes
              </h3>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {supplier.metadata.notes}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Access Card */}
      <SupplierContactCard supplierUser={supplierUser} supplierId={supplier.id} token={token} />

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">
            Record Information
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Created</p>
              <p className="text-gray-900 font-medium">
                {formatDate(supplier.createdAt)}
              </p>
              {supplier.createdByName && (
                <p className="text-gray-600 text-xs mt-1">
                  by {supplier.createdByName}
                </p>
              )}
            </div>
            <div>
              <p className="text-gray-500">Last Modified</p>
              <p className="text-gray-900 font-medium">
                {formatDate(supplier.updatedAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
