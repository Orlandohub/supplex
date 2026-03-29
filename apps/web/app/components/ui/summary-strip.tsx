import { cn } from "~/lib/utils";

export interface SummaryCountItem {
  label: string;
  count: number;
  view: string;
  accent?: "default" | "warning" | "success";
}

interface SummaryStripProps {
  items: SummaryCountItem[];
  activeView: string;
  onViewChange: (view: string) => void;
}

export function SummaryStrip({
  items,
  activeView,
  onViewChange,
}: SummaryStripProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
      {items.map((item) => {
        const isActive = activeView === item.view;
        return (
          <button
            key={item.view}
            onClick={() => onViewChange(item.view)}
            className={cn(
              "flex flex-col items-center min-w-[100px] rounded-lg border px-4 py-2.5 text-center transition-colors cursor-pointer shrink-0",
              isActive
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-white hover:bg-gray-50",
              item.accent === "warning" && item.count > 0 && "border-red-200",
            )}
          >
            <span
              className={cn(
                "text-xl font-bold tabular-nums",
                item.accent === "warning" && item.count > 0
                  ? "text-red-600"
                  : item.accent === "success"
                    ? "text-green-600"
                    : "text-foreground",
              )}
            >
              {item.count}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
