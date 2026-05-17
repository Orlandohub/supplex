/**
 * Form Template Edit Page
 *
 * Tabbed admin surface driven by `?tab=`. The server loader always fetches
 * `GET /api/form-templates/:id` and, on first paint only, the tab-specific
 * read for the **initial** `?tab=` (deep links). Client-side tab switches
 * use `shouldRevalidate: false` for search-only URL changes (same pattern as
 * supplier detail) so switching tabs does not re-run the loader or refetch
 * the full template; tab payloads are hydrated via Eden Treaty in `useEffect`.
 */

import { data as json, redirect, type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import {
  formTemplatesIndexParamsForId,
  withTreatyBranch,
} from "~/lib/api-helpers";
import {
  UserRole,
  type FormTemplateVersionsListData,
  type FormTemplateAuditEventsListData,
  type FormTemplateUsageData,
} from "@supplex/types";
import { ArrowLeft } from "lucide-react";
import { type FormTemplateBuilderTemplate } from "~/components/form-templates/FormTemplateBuilder";
import {
  FormTemplateAdminTabs,
  FORM_TEMPLATE_TABS,
  type FormTemplateTab,
} from "~/components/form-templates/FormTemplateAdminTabs";

interface AdminTabData {
  versions: FormTemplateVersionsListData | null;
  auditEvents: FormTemplateAuditEventsListData | null;
  usage: FormTemplateUsageData | null;
}

function readTabFromUrl(url: URL): FormTemplateTab {
  const raw = url.searchParams.get("tab");
  return (FORM_TEMPLATE_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as FormTemplateTab)
    : "builder";
}

/** Active tab from live URL search params (client). */
function readTabFromSearchParams(
  searchParams: URLSearchParams
): FormTemplateTab {
  const raw = searchParams.get("tab");
  return (FORM_TEMPLATE_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as FormTemplateTab)
    : "builder";
}

/**
 * Same as supplier detail: skip loader revalidation when only `?tab=` (or
 * other search params) changes on this route — avoids refetching the full
 * template on every tab click.
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: {
  currentUrl: URL;
  nextUrl: URL;
  defaultShouldRevalidate: boolean;
}) {
  if (currentUrl.pathname === nextUrl.pathname) {
    const currentParams = currentUrl.searchParams.toString();
    const nextParams = nextUrl.searchParams.toString();
    if (currentParams !== nextParams) {
      return false;
    }
  }
  return defaultShouldRevalidate;
}

export async function loader(args: LoaderFunctionArgs) {
  const { params, request } = args;
  const { userRecord, session } = await requireAuth(args);

  if (userRecord.role !== UserRole.ADMIN) {
    return redirect("/");
  }

  const { id } = params;
  if (!id) {
    throw new Response("Template ID is required", { status: 400 });
  }

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const tab = readTabFromUrl(new URL(request.url));
  const client = createEdenTreatyClient(token);
  const templateRoute = client.api["form-templates"](
    formTemplatesIndexParamsForId(id)
  );

  try {
    const templateResponse = await withTreatyBranch(templateRoute, "get").get();

    if (templateResponse.error) {
      const status = templateResponse.status || 500;
      if (status === 404)
        throw new Response("Template not found", { status: 404 });
      if (status === 403)
        throw new Response("Access forbidden", { status: 403 });
      throw new Response("Failed to load template", { status });
    }

    const template = templateResponse.data
      ?.data as unknown as FormTemplateBuilderTemplate;

    const initialTabData: AdminTabData = {
      versions: null,
      auditEvents: null,
      usage: null,
    };

    if (tab === "versions" || tab === "compare") {
      const versionsResponse = await withTreatyBranch(
        templateRoute,
        "versions"
      ).versions.get();
      if (!versionsResponse.error && versionsResponse.data?.success) {
        initialTabData.versions = versionsResponse.data
          .data as FormTemplateVersionsListData;
      }
    } else if (tab === "changelog") {
      const auditResponse = await withTreatyBranch(
        templateRoute,
        "audit-events"
      )["audit-events"].get({ query: { limit: 50 } });
      if (!auditResponse.error && auditResponse.data?.success) {
        initialTabData.auditEvents = auditResponse.data
          .data as FormTemplateAuditEventsListData;
      }
    } else if (tab === "usage") {
      const usageResponse = await withTreatyBranch(
        templateRoute,
        "usage"
      ).usage.get();
      if (!usageResponse.error && usageResponse.data?.success) {
        initialTabData.usage = usageResponse.data.data as FormTemplateUsageData;
      }
    }

    return json({
      template,
      token,
      initialTabData,
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Error fetching form template:", error);
    throw new Response("Failed to load template", { status: 500 });
  }
}

export default function FormTemplateEditPage() {
  const { template, token, initialTabData } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = useMemo(
    () => readTabFromSearchParams(searchParams),
    [searchParams]
  );

  const [tabData, setTabData] = useState<AdminTabData>(initialTabData);
  const [tabLoading, setTabLoading] = useState(false);

  const versionsLoadedRef = useRef(initialTabData.versions !== null);
  const auditLoadedRef = useRef(initialTabData.auditEvents !== null);
  const usageLoadedRef = useRef(initialTabData.usage !== null);

  useEffect(() => {
    setTabData(initialTabData);
    versionsLoadedRef.current = initialTabData.versions !== null;
    auditLoadedRef.current = initialTabData.auditEvents !== null;
    usageLoadedRef.current = initialTabData.usage !== null;
  }, [template.id, initialTabData]);

  useEffect(() => {
    if (tab === "builder") {
      return;
    }

    const needsVersions =
      (tab === "versions" || tab === "compare") && !versionsLoadedRef.current;
    const needsAudit = tab === "changelog" && !auditLoadedRef.current;
    const needsUsage = tab === "usage" && !usageLoadedRef.current;

    if (!needsVersions && !needsAudit && !needsUsage) {
      return;
    }

    let cancelled = false;
    setTabLoading(true);

    (async () => {
      const client = createEdenTreatyClient(token);
      const templateRoute = client.api["form-templates"](
        formTemplatesIndexParamsForId(template.id)
      );

      try {
        if (needsVersions) {
          const versionsResponse = await withTreatyBranch(
            templateRoute,
            "versions"
          ).versions.get();
          if (cancelled) return;
          const versionsPayload = versionsResponse.data;
          if (!versionsResponse.error && versionsPayload?.success) {
            versionsLoadedRef.current = true;
            setTabData((prev) => ({
              ...prev,
              versions: versionsPayload.data as FormTemplateVersionsListData,
            }));
          }
        }

        if (needsAudit) {
          const auditResponse = await withTreatyBranch(
            templateRoute,
            "audit-events"
          )["audit-events"].get({ query: { limit: 50 } });
          if (cancelled) return;
          const auditPayload = auditResponse.data;
          if (!auditResponse.error && auditPayload?.success) {
            auditLoadedRef.current = true;
            setTabData((prev) => ({
              ...prev,
              auditEvents: auditPayload.data as FormTemplateAuditEventsListData,
            }));
          }
        }

        if (needsUsage) {
          const usageResponse = await withTreatyBranch(
            templateRoute,
            "usage"
          ).usage.get();
          if (cancelled) return;
          const usagePayload = usageResponse.data;
          if (!usageResponse.error && usagePayload?.success) {
            usageLoadedRef.current = true;
            setTabData((prev) => ({
              ...prev,
              usage: usagePayload.data as FormTemplateUsageData,
            }));
          }
        }
      } finally {
        if (!cancelled) {
          setTabLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, template.id, token]);

  const handleTabChange = (next: FormTemplateTab) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === "builder") {
          params.delete("tab");
        } else {
          params.set("tab", next);
        }
        return params;
      },
      { preventScrollReset: true }
    );
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/settings/form-templates")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
      </div>

      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">
            {template.name}
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Edit form template structure and configuration
          </p>
        </div>
      </div>

      <div className="mt-8">
        <FormTemplateAdminTabs
          template={template}
          token={token}
          tab={tab}
          tabData={tabData}
          tabLoading={tabLoading}
          onTabChange={handleTabChange}
        />
      </div>
    </div>
  );
}
