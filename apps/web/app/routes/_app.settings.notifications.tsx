/**
 * User Notification Preferences Page
 * Allows users to manage their email notification preferences
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { Card } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { useToast } from "~/hooks/use-toast";

interface NotificationPreferences {
  workflowSubmitted: boolean;
  stageApproved: boolean;
  stageRejected: boolean;
  stageAdvanced: boolean;
  workflowApproved: boolean;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await requireAuth({ request });

  try {
    const token = session?.access_token;
    if (!token) {
      throw new Error("No access token");
    }

    const client = createEdenTreatyClient(token);
    const response =
      await client.api.users.me["notification-preferences"].get();

    if (response.error || !response.data) {
      throw new Error("Failed to fetch notification preferences");
    }

    const apiResponse = response.data as {
      success: boolean;
      data: NotificationPreferences;
    };

    return json({
      preferences: apiResponse.data,
      error: null,
    });
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    return json({
      preferences: {
        workflowSubmitted: true,
        stageApproved: true,
        stageRejected: true,
        stageAdvanced: true,
        workflowApproved: true,
      } as NotificationPreferences,
      error: "Failed to load preferences. Showing defaults.",
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await requireAuth({ request });

  try {
    const formData = await request.formData();
    const eventType = formData.get("eventType") as string;
    const emailEnabled = formData.get("emailEnabled") === "true";

    const token = session?.access_token;
    if (!token) {
      throw new Error("No access token");
    }

    const client = createEdenTreatyClient(token);
    const response = await client.api.users.me["notification-preferences"].put({
      eventType,
      emailEnabled,
    });

    if (response.error || !response.data) {
      throw new Error("Failed to update notification preference");
    }

    return json({ success: true, error: null });
  } catch (error) {
    console.error("Error updating notification preference:", error);
    return json(
      { success: false, error: "Failed to update preference" },
      { status: 500 }
    );
  }
}

const notificationTypes = [
  {
    key: "workflowSubmitted" as const,
    eventType: "workflow_submitted",
    title: "Workflow Submitted",
    description: "Notify me when a workflow is assigned to me for review",
  },
  {
    key: "stageApproved" as const,
    eventType: "stage_approved",
    title: "Stage Approved",
    description: "Notify me when my workflow stage is approved",
  },
  {
    key: "stageRejected" as const,
    eventType: "stage_rejected",
    title: "Stage Rejected",
    description: "Notify me when my workflow stage is rejected with feedback",
  },
  {
    key: "stageAdvanced" as const,
    eventType: "stage_advanced",
    title: "Stage Advanced",
    description: "Notify me when a workflow advances to the next stage",
  },
  {
    key: "workflowApproved" as const,
    eventType: "workflow_approved",
    title: "Workflow Approved",
    description: "Notify me when a workflow is fully approved",
  },
];

export default function NotificationPreferencesPage() {
  const { preferences, error } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const { toast } = useToast();
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());

  // Update local state when server data changes
  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  // Show error toast if there was an error loading
  useEffect(() => {
    if (error) {
      toast({
        title: "Warning",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Show success toast after save
  useEffect(() => {
    if (
      navigation.state === "idle" &&
      pendingUpdates.size === 0 &&
      navigation.formData
    ) {
      toast({
        title: "Success",
        description: "Notification preference updated",
      });
    }
  }, [navigation.state, navigation.formData, pendingUpdates, toast]);

  const handleToggle = async (
    key: keyof NotificationPreferences,
    eventType: string
  ) => {
    const newValue = !localPreferences[key];

    // Optimistically update UI
    setLocalPreferences((prev) => ({
      ...prev,
      [key]: newValue,
    }));

    // Track pending update
    setPendingUpdates((prev) => new Set(prev).add(eventType));

    // Submit form
    const formData = new FormData();
    formData.set("eventType", eventType);
    formData.set("emailEnabled", String(newValue));

    try {
      const response = await fetch("?index", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to update");
      }

      // Remove from pending
      setPendingUpdates((prev) => {
        const newSet = new Set(prev);
        newSet.delete(eventType);
        return newSet;
      });
    } catch (error) {
      // Revert on error
      setLocalPreferences((prev) => ({
        ...prev,
        [key]: !newValue,
      }));

      setPendingUpdates((prev) => {
        const newSet = new Set(prev);
        newSet.delete(eventType);
        return newSet;
      });

      toast({
        title: "Error",
        description: "Failed to update preference. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            Email Notifications
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your email notification preferences. You&apos;ll still
            receive important system alerts.
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            {notificationTypes.map((notificationType) => (
              <div
                key={notificationType.key}
                className="flex items-center justify-between py-4 border-b border-gray-200 last:border-b-0"
              >
                <div className="flex-1 pr-4">
                  <Label
                    htmlFor={notificationType.key}
                    className="text-sm font-medium text-gray-900 cursor-pointer"
                  >
                    {notificationType.title}
                  </Label>
                  <p className="text-sm text-gray-500 mt-1">
                    {notificationType.description}
                  </p>
                </div>
                <Switch
                  id={notificationType.key}
                  checked={localPreferences[notificationType.key]}
                  onCheckedChange={() =>
                    handleToggle(
                      notificationType.key,
                      notificationType.eventType
                    )
                  }
                  disabled={pendingUpdates.has(notificationType.eventType)}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              💡 <strong>Tip:</strong> You can also unsubscribe from specific
              notification types using the unsubscribe link at the bottom of any
              email.
            </p>
          </div>
        </Card>

        <div className="mt-6 flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.history.back()}
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
