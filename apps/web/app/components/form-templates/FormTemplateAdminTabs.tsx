/**
 * SUP-32 PR B: Tab container for the form-template edit experience.
 *
 * Drives Builder / Versions / Changelog / Usage tabs from `?tab=` URL
 * state. The loader fetches data for the active tab so the loader stays
 * the source of truth; tabs themselves are pure renderers over that data.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type {
  FormTemplateAuditEventsListData,
  FormTemplateUsageData,
  FormTemplateVersionsListData,
} from "@supplex/types";
import {
  FormTemplateBuilder,
  type FormTemplateBuilderTemplate,
} from "./FormTemplateBuilder";
import { VersionsTab } from "./VersionsTab";
import { ChangelogTab } from "./ChangelogTab";
import { UsageTab } from "./UsageTab";
import { CompareTab } from "./CompareTab";

export const FORM_TEMPLATE_TABS = [
  "builder",
  "versions",
  "changelog",
  "usage",
  "compare",
] as const;
export type FormTemplateTab = (typeof FORM_TEMPLATE_TABS)[number];

interface FormTemplateAdminTabsProps {
  template: FormTemplateBuilderTemplate;
  token: string;
  tab: FormTemplateTab;
  tabData: {
    versions: FormTemplateVersionsListData | null;
    auditEvents: FormTemplateAuditEventsListData | null;
    usage: FormTemplateUsageData | null;
  };
  /** True while client-side tab data (versions / audit / usage) is loading. */
  tabLoading?: boolean;
  onTabChange: (next: FormTemplateTab) => void;
}

export function FormTemplateAdminTabs({
  template,
  token,
  tab,
  tabData,
  tabLoading = false,
  onTabChange,
}: FormTemplateAdminTabsProps) {
  const fetchingVersions =
    tabLoading && (tab === "versions" || tab === "compare");

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as FormTemplateTab)}
    >
      <TabsList className="grid w-full grid-cols-5 max-w-3xl">
        <TabsTrigger value="builder">Builder</TabsTrigger>
        <TabsTrigger value="versions">Versions</TabsTrigger>
        <TabsTrigger value="changelog">Changelog</TabsTrigger>
        <TabsTrigger value="usage">Usage</TabsTrigger>
        <TabsTrigger value="compare">Compare</TabsTrigger>
      </TabsList>

      <TabsContent value="builder" className="mt-6">
        <FormTemplateBuilder template={template} token={token} />
      </TabsContent>

      <TabsContent value="versions" className="mt-6">
        <VersionsTab
          data={tabData.versions}
          loading={tab === "versions" && fetchingVersions}
        />
      </TabsContent>

      <TabsContent value="changelog" className="mt-6">
        <ChangelogTab
          templateId={template.id}
          token={token}
          initialData={tabData.auditEvents}
          loading={tab === "changelog" && tabLoading}
        />
      </TabsContent>

      <TabsContent value="usage" className="mt-6">
        <UsageTab
          data={tabData.usage}
          loading={tab === "usage" && tabLoading}
        />
      </TabsContent>

      <TabsContent value="compare" className="mt-6">
        <CompareTab
          templateId={template.id}
          token={token}
          versions={tabData.versions}
          versionsLoading={tab === "compare" && fetchingVersions}
        />
      </TabsContent>
    </Tabs>
  );
}
