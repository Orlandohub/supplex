import { Link } from "@remix-run/react";
import type { Supplier } from "@supplex/types";
import { StatusBadge } from "./StatusBadge";
import { SupplierStatus, SupplierCategory } from "@supplex/types";

interface SupplierTableProps {
  suppliers: Supplier[];
  currentSort?: string;
}

const categoryLabels: Record<SupplierCategory, string> = {
  [SupplierCategory.RAW_MATERIALS]: "Raw Materials",
  [SupplierCategory.COMPONENTS]: "Components",
  [SupplierCategory.SERVICES]: "Services",
  [SupplierCategory.PACKAGING]: "Packaging",
  [SupplierCategory.LOGISTICS]: "Logistics",
};

export function SupplierTable({ suppliers, currentSort = "updated_at_desc" }: SupplierTableProps) {
  const [sortColumn, sortDirection] = currentSort.split("_") as [string, "asc" | "desc"];

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    if (sortDirection === "asc") {
      return (
        <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }

    return (
      <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const toggleSort = (column: string) => {
    const newDirection = sortColumn === column && sortDirection === "asc" ? "desc" : "asc";
    return `${column}_${newDirection}`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <Link
                to={`?sort=${toggleSort("name")}`}
                className="flex items-center space-x-1 hover:text-gray-700"
                prefetch="intent"
              >
                <span>Supplier Name</span>
                {getSortIcon("name")}
              </Link>
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <Link
                to={`?sort=${toggleSort("status")}`}
                className="flex items-center space-x-1 hover:text-gray-700"
                prefetch="intent"
              >
                <span>Status</span>
                {getSortIcon("status")}
              </Link>
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Category
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Location
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Contact
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <Link
                to={`?sort=${toggleSort("updated_at")}`}
                className="flex items-center space-x-1 hover:text-gray-700"
                prefetch="intent"
              >
                <span>Last Updated</span>
                {getSortIcon("updated_at")}
              </Link>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {suppliers.map((supplier) => (
            <tr
              key={supplier.id}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => {
                window.location.href = `/suppliers/${supplier.id}`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  window.location.href = `/suppliers/${supplier.id}`;
                }
              }}
              tabIndex={0}
              role="button"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
                <div className="text-sm text-gray-500">{supplier.taxId}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={supplier.status as SupplierStatus} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {categoryLabels[supplier.category as SupplierCategory]}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {supplier.address.city}, {supplier.address.country}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div>{supplier.contactName}</div>
                <div className="text-xs text-gray-400">{supplier.contactEmail}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(supplier.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

