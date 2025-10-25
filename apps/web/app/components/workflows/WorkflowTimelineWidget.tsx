/**
 * Workflow Timeline Widget (Placeholder for Story 2.10)
 * Displays workflow history and audit trail
 * Full implementation will be completed in Story 2.10
 */

import { Card } from "~/components/ui/card";

interface WorkflowTimelineWidgetProps {
  workflowId: string;
  token: string;
}

export function WorkflowTimelineWidget(_props: WorkflowTimelineWidgetProps) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Workflow History</h3>
      <p className="text-sm text-muted-foreground">
        Full timeline functionality will be available in Story 2.10.
      </p>
      {/* TODO: Story 2.10 - Implement full audit trail timeline with:
          - Latest 3 events from audit log
          - Event icon, Event description, User name, Timestamp
          - Link to "View Full History" page
          Event format: "Submitted for Stage 1 review by [User Name] on [Oct 24, 2025 2:30 PM]"
      */}
    </Card>
  );
}
