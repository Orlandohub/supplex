import * as path from "path";
import * as fs from "fs";
import { logger } from "../../lib/logger";

const templateLogger = logger.child({ module: "template-renderer" });

/**
 * Email Template Renderer
 *
 * Loads HTML email templates and replaces placeholders with dynamic data
 * - Templates are cached after first load for performance
 * - HTML escaping prevents injection attacks
 * - Base template provides consistent branding
 */

// Template cache to avoid re-reading files on every email
const templateCache = new Map<string, string>();

/**
 * Load template from file system
 * Caches template after first load
 */
function loadTemplate(templatePath: string): string {
  const cached = templateCache.get(templatePath);
  if (cached !== undefined) {
    return cached;
  }

  const absolutePath = path.join(__dirname, templatePath);
  const content = fs.readFileSync(absolutePath, "utf-8");
  templateCache.set(templatePath, content);
  return content;
}

/**
 * Escape HTML to prevent injection attacks
 */
function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(text).replace(/[<>&"']/g, (char) => escapeMap[char] || char);
}

/**
 * Render email template with dynamic data
 *
 * @param templateName - Name of template file (without .html extension)
 * @param data - Dynamic data to replace placeholders
 * @returns Rendered HTML email
 */
export function renderEmailTemplate(
  templateName: string,
  data: Record<string, unknown>
): string {
  try {
    // Load templates (cached after first load)
    const baseTemplate = loadTemplate("base.html");
    const contentTemplate = loadTemplate(`${templateName}.html`);

    // Replace placeholders in content template
    let renderedContent = contentTemplate;
    for (const [key, value] of Object.entries(data)) {
      // Skip unsubscribe link (will be added at base level)
      if (key === "unsubscribeLink") {
        continue;
      }

      // Escape HTML to prevent injection, convert to string
      const safeValue =
        value !== null && value !== undefined ? escapeHtml(String(value)) : "";
      renderedContent = renderedContent.replace(
        new RegExp(`{{${key}}}`, "g"),
        safeValue
      );
    }

    // Insert content into base template
    let finalHtml = baseTemplate.replace("{{CONTENT}}", renderedContent);

    // Add unsubscribe link
    const unsubscribeLink = data.unsubscribeLink
      ? String(data.unsubscribeLink)
      : "#";
    finalHtml = finalHtml.replace("{{UNSUBSCRIBE_LINK}}", unsubscribeLink);

    return finalHtml;
  } catch (error) {
    templateLogger.error(
      { err: error, templateName },
      "Error rendering email template"
    );
    throw new Error(`Failed to render email template: ${templateName}`);
  }
}

/**
 * Clear template cache (useful for development/testing)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}
