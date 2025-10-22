/**
 * Supplier Detail Skeleton Loading Component
 * 
 * Displays a skeleton UI while supplier details are loading
 * Matches the layout of the actual detail page for smooth transitions
 */
export function SupplierDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Breadcrumb Skeleton */}
      <div className="flex items-center space-x-2">
        <div className="h-4 w-12 bg-gray-200 rounded"></div>
        <div className="h-4 w-4 bg-gray-200 rounded"></div>
        <div className="h-4 w-20 bg-gray-200 rounded"></div>
        <div className="h-4 w-4 bg-gray-200 rounded"></div>
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
      </div>

      {/* Page Title Skeleton */}
      <div className="h-8 w-64 bg-gray-200 rounded"></div>

      {/* Tabs Skeleton */}
      <div className="flex space-x-4 border-b border-gray-200">
        <div className="h-10 w-24 bg-gray-200 rounded-t"></div>
        <div className="h-10 w-28 bg-gray-200 rounded-t"></div>
        <div className="h-10 w-20 bg-gray-200 rounded-t"></div>
      </div>

      {/* Content Skeleton */}
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Status Badge Skeleton */}
        <div className="h-6 w-24 bg-gray-200 rounded-full"></div>

        {/* Content Rows */}
        <div className="space-y-4">
          <div className="h-4 w-full bg-gray-200 rounded"></div>
          <div className="h-4 w-5/6 bg-gray-200 rounded"></div>
          <div className="h-4 w-4/6 bg-gray-200 rounded"></div>
          <div className="h-4 w-full bg-gray-200 rounded"></div>
          <div className="h-4 w-3/6 bg-gray-200 rounded"></div>
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex space-x-4 pt-4">
          <div className="h-10 w-24 bg-gray-200 rounded"></div>
          <div className="h-10 w-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

