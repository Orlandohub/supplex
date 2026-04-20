import { useSearchParams } from "react-router";
import { useState } from "react";
import { SupplierStatus, SupplierCategory } from "@supplex/types";

interface SupplierFiltersProps {
  activeStatus: string[];
  activeCategory: string[];
}

const statusOptions = [
  { value: SupplierStatus.APPROVED, label: "Approved" },
  { value: SupplierStatus.CONDITIONAL, label: "Conditional" },
  { value: SupplierStatus.BLOCKED, label: "Blocked" },
  { value: SupplierStatus.PROSPECT, label: "Prospect" },
  { value: SupplierStatus.QUALIFIED, label: "Qualified" },
];

const categoryOptions = [
  { value: SupplierCategory.RAW_MATERIALS, label: "Raw Materials" },
  { value: SupplierCategory.COMPONENTS, label: "Components" },
  { value: SupplierCategory.SERVICES, label: "Services" },
  { value: SupplierCategory.PACKAGING, label: "Packaging" },
  { value: SupplierCategory.LOGISTICS, label: "Logistics" },
];

export function SupplierFilters({
  activeStatus,
  activeCategory,
}: SupplierFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const toggleStatus = (status: string) => {
    const newParams = new URLSearchParams(searchParams);
    const currentStatus = newParams.getAll("status");

    if (currentStatus.includes(status)) {
      // Remove the status
      newParams.delete("status");
      currentStatus
        .filter((s) => s !== status)
        .forEach((s) => newParams.append("status", s));
    } else {
      // Add the status
      newParams.append("status", status);
    }

    // Reset to page 1
    newParams.set("page", "1");
    setSearchParams(newParams, { replace: true });
  };

  const toggleCategory = (category: string) => {
    const newParams = new URLSearchParams(searchParams);
    const currentCategory = newParams.getAll("category");

    if (currentCategory.includes(category)) {
      // Remove the category
      newParams.delete("category");
      currentCategory
        .filter((c) => c !== category)
        .forEach((c) => newParams.append("category", c));
    } else {
      // Add the category
      newParams.append("category", category);
    }

    // Reset to page 1
    newParams.set("page", "1");
    setSearchParams(newParams, { replace: true });
  };

  const clearAllFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("status");
    newParams.delete("category");
    newParams.set("page", "1");
    setSearchParams(newParams, { replace: true });
  };

  const removeStatusFilter = (status: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("status");
    activeStatus
      .filter((s) => s !== status)
      .forEach((s) => newParams.append("status", s));
    newParams.set("page", "1");
    setSearchParams(newParams, { replace: true });
  };

  const removeCategoryFilter = (category: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("category");
    activeCategory
      .filter((c) => c !== category)
      .forEach((c) => newParams.append("category", c));
    newParams.set("page", "1");
    setSearchParams(newParams, { replace: true });
  };

  const hasActiveFilters = activeStatus.length > 0 || activeCategory.length > 0;

  return (
    <div className="space-y-3">
      {/* Filter Dropdowns */}
      <div className="flex flex-wrap gap-3">
        {/* Status Filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <span>Status</span>
            {activeStatus.length > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {activeStatus.length}
              </span>
            )}
            <svg
              className="ml-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showStatusDropdown && (
            <>
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- dropdown backdrop; see SUP-8 for a proper <Popover> rewrite */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowStatusDropdown(false)}
              />
              <div className="absolute z-20 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                <div className="py-1" role="menu">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleStatus(option.value)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between"
                      role="menuitem"
                    >
                      <span>{option.label}</span>
                      {activeStatus.includes(option.value) && (
                        <svg
                          className="h-4 w-4 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Category Filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <span>Category</span>
            {activeCategory.length > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {activeCategory.length}
              </span>
            )}
            <svg
              className="ml-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showCategoryDropdown && (
            <>
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- dropdown backdrop; see SUP-8 for a proper <Popover> rewrite */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowCategoryDropdown(false)}
              />
              <div className="absolute z-20 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                <div className="py-1" role="menu">
                  {categoryOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleCategory(option.value)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between"
                      role="menuitem"
                    >
                      <span>{option.label}</span>
                      {activeCategory.includes(option.value) && (
                        <svg
                          className="h-4 w-4 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Clear All Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {activeStatus.map((status) => {
            const option = statusOptions.find((o) => o.value === status);
            return (
              <span
                key={status}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
              >
                <span>Status: {option?.label}</span>
                <button
                  type="button"
                  onClick={() => removeStatusFilter(status)}
                  className="ml-2 inline-flex items-center hover:text-blue-900"
                  aria-label={`Remove ${option?.label} filter`}
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            );
          })}
          {activeCategory.map((category) => {
            const option = categoryOptions.find((o) => o.value === category);
            return (
              <span
                key={category}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
              >
                <span>Category: {option?.label}</span>
                <button
                  type="button"
                  onClick={() => removeCategoryFilter(category)}
                  className="ml-2 inline-flex items-center hover:text-purple-900"
                  aria-label={`Remove ${option?.label} filter`}
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
