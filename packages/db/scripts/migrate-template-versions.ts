/**
 * Template Version Data Migration Script
 * Story: 2.2.14 - Remove Template Versioning
 * 
 * Purpose: Export version data to JSON before dropping version tables
 * 
 * Usage:
 *   bun run packages/db/scripts/migrate-template-versions.ts
 * 
 * Output:
 *   - .ai/template-version-archive.json (full version data backup)
 *   - Console logs showing migration progress
 */

import { db } from "../src/db";
import { 
  formTemplateVersion, 
  workflowTemplateVersion,
  formSection,
  workflowStepTemplate,
  formSubmission
} from "../src/schema";
import { eq } from "drizzle-orm";
import { writeFile } from "fs/promises";
import { join } from "path";

interface FormVersionArchive {
  id: string;
  formTemplateId: string;
  tenantId: string;
  version: number;
  status: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  sections: any[];
}

interface WorkflowVersionArchive {
  id: string;
  workflowTemplateId: string;
  tenantId: string;
  version: number;
  status: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  steps: any[];
}

interface MigrationSummary {
  formVersions: FormVersionArchive[];
  workflowVersions: WorkflowVersionArchive[];
  summary: {
    formTemplateCount: number;
    formVersionCount: number;
    formSectionCount: number;
    workflowTemplateCount: number;
    workflowVersionCount: number;
    workflowStepCount: number;
    formSubmissionCount: number;
  };
  exportDate: string;
  migrationStory: string;
}

async function exportVersionData(): Promise<MigrationSummary> {
  console.log("🔍 Starting template version data export...\n");

  // Export form template versions with their sections
  console.log("📋 Exporting form template versions...");
  const formVersions = await db
    .select()
    .from(formTemplateVersion);

  const formVersionArchive: FormVersionArchive[] = [];
  
  for (const version of formVersions) {
    const sections = await db
      .select()
      .from(formSection)
      .where(eq(formSection.formTemplateVersionId, version.id));

    formVersionArchive.push({
      id: version.id,
      formTemplateId: version.formTemplateId,
      tenantId: version.tenantId,
      version: version.version,
      status: version.status,
      isPublished: version.isPublished,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      sections,
    });
  }

  console.log(`  ✅ Exported ${formVersionArchive.length} form template versions`);
  console.log(`  ✅ Total sections: ${formVersionArchive.reduce((sum, v) => sum + v.sections.length, 0)}`);

  // Export workflow template versions with their steps
  console.log("\n⚙️  Exporting workflow template versions...");
  const workflowVersions = await db
    .select()
    .from(workflowTemplateVersion);

  const workflowVersionArchive: WorkflowVersionArchive[] = [];
  
  for (const version of workflowVersions) {
    const steps = await db
      .select()
      .from(workflowStepTemplate)
      .where(eq(workflowStepTemplate.workflowTemplateVersionId, version.id));

    workflowVersionArchive.push({
      id: version.id,
      workflowTemplateId: version.workflowTemplateId,
      tenantId: version.tenantId,
      version: version.version,
      status: version.status,
      isPublished: version.isPublished,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      steps,
    });
  }

  console.log(`  ✅ Exported ${workflowVersionArchive.length} workflow template versions`);
  console.log(`  ✅ Total steps: ${workflowVersionArchive.reduce((sum, v) => sum + v.steps.length, 0)}`);

  // Count form submissions that reference versions
  const submissionCount = await db
    .select()
    .from(formSubmission)
    .then(results => results.length);

  console.log(`\n📊 Data Summary:`);
  console.log(`  - Form template versions: ${formVersionArchive.length}`);
  console.log(`  - Workflow template versions: ${workflowVersionArchive.length}`);
  console.log(`  - Form submissions: ${submissionCount}`);

  const summary: MigrationSummary = {
    formVersions: formVersionArchive,
    workflowVersions: workflowVersionArchive,
    summary: {
      formTemplateCount: new Set(formVersionArchive.map(v => v.formTemplateId)).size,
      formVersionCount: formVersionArchive.length,
      formSectionCount: formVersionArchive.reduce((sum, v) => sum + v.sections.length, 0),
      workflowTemplateCount: new Set(workflowVersionArchive.map(v => v.workflowTemplateId)).size,
      workflowVersionCount: workflowVersionArchive.length,
      workflowStepCount: workflowVersionArchive.reduce((sum, v) => sum + v.steps.length, 0),
      formSubmissionCount: submissionCount,
    },
    exportDate: new Date().toISOString(),
    migrationStory: "2.2.14",
  };

  return summary;
}

async function analyzeLatestVersions(summary: MigrationSummary): Promise<void> {
  console.log("\n🔬 Analyzing latest published versions...\n");

  // Group form versions by template
  const formTemplateMap = new Map<string, FormVersionArchive[]>();
  for (const version of summary.formVersions) {
    if (!formTemplateMap.has(version.formTemplateId)) {
      formTemplateMap.set(version.formTemplateId, []);
    }
    formTemplateMap.get(version.formTemplateId)!.push(version);
  }

  console.log("📋 Form Templates:");
  for (const [templateId, versions] of formTemplateMap) {
    const published = versions.filter(v => v.isPublished);
    const latest = versions.reduce((max, v) => v.version > max.version ? v : max);
    console.log(`  Template ${templateId.slice(0, 8)}...:`);
    console.log(`    - Total versions: ${versions.length}`);
    console.log(`    - Published versions: ${published.length}`);
    console.log(`    - Latest version: ${latest.version} (${latest.status})`);
    if (published.length > 0) {
      console.log(`    - ⚠️  Has published versions - data will be migrated to template`);
    }
  }

  // Group workflow versions by template
  const workflowTemplateMap = new Map<string, WorkflowVersionArchive[]>();
  for (const version of summary.workflowVersions) {
    if (!workflowTemplateMap.has(version.workflowTemplateId)) {
      workflowTemplateMap.set(version.workflowTemplateId, []);
    }
    workflowTemplateMap.get(version.workflowTemplateId)!.push(version);
  }

  console.log("\n⚙️  Workflow Templates:");
  for (const [templateId, versions] of workflowTemplateMap) {
    const published = versions.filter(v => v.isPublished);
    const latest = versions.reduce((max, v) => v.version > max.version ? v : max);
    console.log(`  Template ${templateId.slice(0, 8)}...:`);
    console.log(`    - Total versions: ${versions.length}`);
    console.log(`    - Published versions: ${published.length}`);
    console.log(`    - Latest version: ${latest.version} (${latest.status})`);
    if (published.length > 0) {
      console.log(`    - ⚠️  Has published versions - data will be migrated to template`);
    }
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Template Version Data Migration Script                   ║");
  console.log("║  Story 2.2.14: Remove Template Versioning                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  try {
    // Export all version data
    const summary = await exportVersionData();

    // Analyze latest versions
    await analyzeLatestVersions(summary);

    // Write to JSON file
    const outputPath = join(process.cwd(), ".ai", "template-version-archive.json");
    await writeFile(outputPath, JSON.stringify(summary, null, 2), "utf-8");

    console.log(`\n✅ Archive saved to: ${outputPath}`);
    console.log("\n📝 Migration Summary:");
    console.log(`  - Form templates: ${summary.summary.formTemplateCount}`);
    console.log(`  - Form versions: ${summary.summary.formVersionCount}`);
    console.log(`  - Form sections: ${summary.summary.formSectionCount}`);
    console.log(`  - Workflow templates: ${summary.summary.workflowTemplateCount}`);
    console.log(`  - Workflow versions: ${summary.summary.workflowVersionCount}`);
    console.log(`  - Workflow steps: ${summary.summary.workflowStepCount}`);
    console.log(`  - Form submissions: ${summary.summary.formSubmissionCount}`);

    console.log("\n✅ Export complete! You can now run the SQL migration.");
    console.log("   Run: bun run packages/db/migrate\n");

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

main();
