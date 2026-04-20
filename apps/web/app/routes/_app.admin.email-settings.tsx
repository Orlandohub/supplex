/**
 * Admin Email Settings Page
 * Allows admins to manage tenant-wide email notification settings
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data as json } from "react-router";
import { useLoaderData, Form, useNavigation, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { requireAdmin } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { Card } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { useToast } from "~/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

interface TenantEmailSettings {
  workflowSubmitted: boolean;
  stageApproved: boolean;
  stageRejected: boolean;
  stageAdvanced: boolean;
  workflowApproved: boolean;
}

export async function loader(args: LoaderFunctionArgs) {
  const { request } = args;
  const { session, userRecord: _userRecord } = await requireAdmin(request);

  try {
    const token = session?.access_token;
    if (!token) {
      throw new Error("No access token");
    }

    const client = createEdenTreatyClient(token);
    const response = await client.api.admin["email-settings"].get();

    if (response.error || !response.data) {
      throw new Error("Failed to fetch email settings");
    }

    const apiResponse = response.data as {
      success: boolean;
      data: TenantEmailSettings;
    };

    return json({
      settings: apiResponse.data,
      error: null,
    });
  } catch (error) {
    console.error("Error fetching email settings:", error);
    return json({
      settings: {
        workflowSubmitted: true,
        stageApproved: true,
        stageRejected: true,
        stageAdvanced: true,
        workflowApproved: true,
      } as TenantEmailSettings,
      error: "Failed to load settings. Showing defaults.",
    });
  }
}

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const { session, userRecord: _userRecord } = await requireAdmin(request);

  try {
    const formData = await request.formData();
    const action = formData.get("_action");

    if (action === "save") {
      const settings = {
        workflowSubmitted: formData.get("workflowSubmitted") === "true",
        stageApproved: formData.get("stageApproved") === "true",
        stageRejected: formData.get("stageRejected") === "true",
        stageAdvanced: formData.get("stageAdvanced") === "true",
        workflowApproved: formData.get("workflowApproved") === "true",
      };

      const token = session?.access_token;
      if (!token) {
        throw new Error("No access token");
      }

      const client = createEdenTreatyClient(token);
      const response = await client.api.admin["email-settings"].put(settings);

      if (response.error || !response.data) {
        throw new Error("Failed to update email settings");
      }

      return json({ success: true, error: null });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating email settings:", error);
    return json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

const notificationTypes = [
  {
    key: "workflowSubmitted" as const,
    title: "Workflow Submitted",
    description:
      "Send email notifications when workflows are submitted for review",
  },
  {
    key: "stageApproved" as const,
    title: "Stage Approved",
    description: "Send email notifications when workflow stages are approved",
  },
  {
    key: "stageRejected" as const,
    title: "Stage Rejected",
    description: "Send email notifications when workflow stages are rejected",
  },
  {
    key: "stageAdvanced" as const,
    title: "Stage Advanced",
    description:
      "Send email notifications when workflows advance to next stage",
  },
  {
    key: "workflowApproved" as const,
    title: "Workflow Approved",
    description:
      "Send email notifications when workflows are fully approved (to suppliers)",
  },
];

export default function AdminEmailSettingsPage() {
  const { settings, error } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  // Update local state when server data changes
  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

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
    if (navigation.state === "idle" && navigation.formData && !hasChanges) {
      toast({
        title: "Success",
        description: "Email settings updated successfully",
      });
    }
  }, [navigation.state, navigation.formData, hasChanges, toast]);

  const handleToggle = (key: keyof TenantEmailSettings) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setHasChanges(true);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    formData.set("_action", "save");

    // Add all settings to form data
    Object.entries(localSettings).forEach(([key, value]) => {
      formData.set(key, String(value));
    });

    try {
      const response = await fetch("?index", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      setHasChanges(false);

      toast({
        title: "Success",
        description: "Email settings updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/settings")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            Email Notification Settings
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Configure tenant-wide email notification settings. These settings
            apply to all users in your organization, but users can still manage
            their individual preferences.
          </p>
        </div>

        <Form onSubmit={handleSave}>
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
                    checked={localSettings[notificationType.key]}
                    onCheckedChange={() => handleToggle(notificationType.key)}
                    disabled={isSubmitting}
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                <strong>Note:</strong> Disabling a notification type will
                prevent <strong>all users</strong> in your organization from
                receiving those emails, regardless of their individual
                preferences.
              </p>
            </div>
          </Card>

          <div className="mt-6 flex items-center gap-4">
            <Button type="submit" disabled={!hasChanges || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLocalSettings(settings);
                setHasChanges(false);
              }}
              disabled={!hasChanges || isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
