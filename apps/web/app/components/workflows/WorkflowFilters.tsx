import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Search, X } from "lucide-react";

interface WorkflowFiltersProps {
  currentFilters: {
    status?: string;
    stage?: string;
    riskLevel?: string;
    search?: string;
  };
  onFilterChange: (filterName: string, value: string | undefined) => void;
}

export function WorkflowFilters({
  currentFilters,
  onFilterChange,
}: WorkflowFiltersProps) {
  const [searchInput, setSearchInput] = useState(currentFilters.search || "");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null
  );

  // Debounced search handler (300ms delay)
  useEffect(() => {
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for search
    const timeout = setTimeout(() => {
      onFilterChange("search", searchInput || undefined);
    }, 300);

    setSearchTimeout(timeout);

    // Cleanup on unmount
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchInput]);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchInput("");
    onFilterChange("status", undefined);
    onFilterChange("stage", undefined);
    onFilterChange("riskLevel", undefined);
    onFilterChange("search", undefined);
  };

  // Check if any filters are active
  const hasActiveFilters =
    currentFilters.status ||
    currentFilters.stage ||
    currentFilters.riskLevel ||
    currentFilters.search;

  return (
    <div className="flex flex-col gap-4 p-4 bg-card rounded-lg border">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search Input */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by supplier name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-[180px]">
          <Select
            value={currentFilters.status || "All"}
            onValueChange={(value) => onFilterChange("status", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="InProgress">In Progress</SelectItem>
              <SelectItem value="Stage1">Stage 1</SelectItem>
              <SelectItem value="Stage2">Stage 2</SelectItem>
              <SelectItem value="Stage3">Stage 3</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stage Filter */}
        <div className="w-full sm:w-[150px]">
          <Select
            value={currentFilters.stage || "All"}
            onValueChange={(value) => onFilterChange("stage", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Stages</SelectItem>
              <SelectItem value="1">Stage 1</SelectItem>
              <SelectItem value="2">Stage 2</SelectItem>
              <SelectItem value="3">Stage 3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Risk Level Filter */}
        <div className="w-full sm:w-[150px]">
          <Select
            value={currentFilters.riskLevel || "All"}
            onValueChange={(value) => onFilterChange("riskLevel", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Risk Levels</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="whitespace-nowrap"
          >
            <X className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
