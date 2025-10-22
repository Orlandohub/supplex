export function SupplierTableSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Desktop Skeleton */}
      <div className="hidden md:block">
        <div className="animate-pulse">
          {/* Table Header */}
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <div className="grid grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>

          {/* Table Rows */}
          {[...Array(10)].map((_, rowIndex) => (
            <div key={rowIndex} className="px-6 py-4 border-b border-gray-100">
              <div className="grid grid-cols-6 gap-4 items-center">
                {/* Name */}
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                {/* Status */}
                <div className="h-6 bg-gray-200 rounded w-20"></div>
                {/* Category */}
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                {/* Location */}
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                {/* Contact */}
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                {/* Date */}
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Skeleton */}
      <div className="block md:hidden space-y-4 p-4">
        <div className="animate-pulse">
          {[...Array(5)].map((_, cardIndex) => (
            <div key={cardIndex} className="bg-white rounded-lg shadow p-4 space-y-3">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>

              {/* Category */}
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>

              {/* Location */}
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>

              {/* Contact */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search and Filter Skeleton */}
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          {/* Search Bar */}
          <div className="h-12 bg-gray-200 rounded-lg"></div>

          {/* Filter Buttons */}
          <div className="flex gap-3">
            <div className="h-10 bg-gray-200 rounded w-24"></div>
            <div className="h-10 bg-gray-200 rounded w-28"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

