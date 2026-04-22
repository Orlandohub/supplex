/**
 * Settings Overview Component
 * Displays card grid with links to all settings sections
 */

import { Link } from "react-router";
import {
  Users,
  Bell,
  Mail,
  ClipboardList,
  FileCheck,
  Workflow,
  ScrollText,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

interface SettingCard {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const settingsCards: SettingCard[] = [
  {
    title: "User Management",
    description: "Manage users, roles, and invitations for your organization.",
    href: "/settings/users",
    icon: Users,
    adminOnly: true,
  },
  {
    title: "Workflow Templates",
    description:
      "Create and manage workflow templates with steps, approvers, and validation rules.",
    href: "/settings/workflow-templates",
    icon: Workflow,
    adminOnly: true,
  },
  {
    title: "Form Templates",
    description:
      "Create and manage dynamic form templates for supplier qualification and evaluation.",
    href: "/settings/form-templates",
    icon: ClipboardList,
    adminOnly: true,
  },
  {
    title: "Document Templates",
    description:
      "Define required documents for workflow steps. Templates can be reused across workflows.",
    href: "/settings/document-templates",
    icon: FileCheck,
    adminOnly: true,
  },
  {
    title: "Email Notifications",
    description:
      "Configure your email notification preferences for workflow updates.",
    href: "/settings/notifications",
    icon: Bell,
    adminOnly: false,
  },
  {
    title: "Audit Log",
    description:
      "View all workflow events and template changes for compliance and traceability.",
    href: "/settings/audit-log",
    icon: ScrollText,
    adminOnly: true,
  },
  {
    title: "Email Settings",
    description: "Configure SMTP settings and manage email delivery logs.",
    href: "/admin/email-settings",
    icon: Mail,
    adminOnly: true,
  },
];

interface SettingsOverviewProps {
  user: {
    role: string;
  };
}

export function SettingsOverview({ user }: SettingsOverviewProps) {
  const isAdmin = user?.role === "admin";

  // Filter cards based on user role
  const visibleCards = settingsCards.filter((card) => {
    if (card.adminOnly && !isAdmin) {
      return false;
    }
    return true;
  });

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your organization&apos;s configuration and preferences.
        </p>
      </div>

      {/* Settings Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{card.description}</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to={card.href}>Manage â†’</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
