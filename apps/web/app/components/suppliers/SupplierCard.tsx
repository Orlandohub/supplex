import { Link } from "react-router";
import type { Supplier, SupplierStatus } from "@supplex/types";
import { StatusBadge } from "./StatusBadge";
import { SupplierCategory } from "@supplex/types";

// Type for supplier data with dates as strings (after serialization)
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
  }>;
};

interface SupplierCardProps {
  supplier: SerializedSupplier;
}

const categoryLabels: Record<SupplierCategory, string> = {
  [SupplierCategory.RAW_MATERIALS]: "Raw Materials",
  [SupplierCategory.COMPONENTS]: "Components",
  [SupplierCategory.SERVICES]: "Services",
  [SupplierCategory.PACKAGING]: "Packaging",
  [SupplierCategory.LOGISTICS]: "Logistics",
};

export function SupplierCard({ supplier }: SupplierCardProps) {
  return (
    <Link
      to={`/suppliers/${supplier.id}`}
      className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 active:bg-gray-50"
      style={{ touchAction: "manipulation" }}
      prefetch="intent"
    >
      <div className="space-y-3">
        {/* Header: Name and Status */}
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {supplier.name}
            </h3>
            <p className="text-sm text-gray-500 truncate">{supplier.taxId}</p>
          </div>
          <StatusBadge status={supplier.status as SupplierStatus} />
        </div>

        {/* Category */}
        <div className="flex items-center space-x-2">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          <span className="text-sm text-gray-600">
            {categoryLabels[supplier.category as SupplierCategory]}
          </span>
        </div>

        {/* Location */}
        <div className="flex items-center space-x-2">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-sm text-gray-600">
            {supplier.address.city}, {supplier.address.country}
          </span>
        </div>

        {/* Contact */}
        <div className="space-y-1 pt-2 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-sm text-gray-700">
              {supplier.contactName}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs text-gray-500 truncate">
              {supplier.contactEmail}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
