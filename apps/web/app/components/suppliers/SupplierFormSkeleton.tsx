/**
 * SupplierFormSkeleton Component
 * Loading skeleton for supplier form
 *
 * Displays animated placeholders for form fields while data is loading
 */
export function SupplierFormSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Company Information Section */}
      <div>
        <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-9 w-full bg-gray-200 rounded" />
          </div>
          <div>
            <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-9 w-full bg-gray-200 rounded" />
          </div>
          <div>
            <div className="h-4 w-28 bg-gray-200 rounded mb-2" />
            <div className="h-9 w-full bg-gray-200 rounded" />
          </div>
          <div>
            <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-9 w-full bg-gray-200 rounded" />
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div>
        <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-9 w-full bg-gray-200 rounded" />
          </div>
          <div>
            <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-9 w-full bg-gray-200 rounded" />
          </div>
          <div>
            <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-9 w-full bg-gray-200 rounded" />
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div>
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-9 w-full bg-gray-200 rounded" />
          </div>
          <div>
            <div className="h-4 w-36 bg-gray-200 rounded mb-2" />
            <div className="h-9 w-full bg-gray-200 rounded" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t">
        <div className="h-9 w-24 bg-gray-200 rounded" />
        <div className="h-9 w-32 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
