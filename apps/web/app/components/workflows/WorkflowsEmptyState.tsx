import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { FileQuestion, Plus } from "lucide-react";
import { Link } from "@remix-run/react";

export function WorkflowsEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No qualifications found</h3>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          Try adjusting your filters or start a new qualification workflow for a
          supplier
        </p>
        <Link to="/suppliers">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Start New Qualification
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
