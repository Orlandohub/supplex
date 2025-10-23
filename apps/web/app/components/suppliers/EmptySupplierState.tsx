import { Link } from "@remix-run/react";
import { usePermissions } from "~/hooks/usePermissions";

export function EmptySupplierState() {
  const { canCreateSuppliers } = usePermissions();

  return (
    <div className="bg-white rounded-lg shadow p-12 text-center">
      <svg
        className="mx-auto h-24 w-24 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-gray-900">
        No suppliers yet
      </h3>
      <p className="mt-2 text-sm text-gray-500">
        Get started by adding your first supplier to your database.
      </p>
      {canCreateSuppliers && (
        <div className="mt-6">
          <Link
            to="/suppliers/new"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg
              className="-ml-1 mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Your First Supplier
          </Link>
        </div>
      )}
    </div>
  );
}
