import { db } from "../db";
import { auditLogs } from "@supplex/db";
import type { AuditAction } from "@supplex/types";

/**
 * Audit Log Entry Parameters
 */
export interface AuditLogEntry {
  tenantId: string;
  userId: string;
  targetUserId?: string | null;
  action: AuditAction;
  details: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Log an audit event
 * Records user actions for security and compliance
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      tenantId: entry.tenantId,
      userId: entry.userId,
      targetUserId: entry.targetUserId || null,
      action: entry.action,
      details: entry.details,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
    });

    console.log(
      `[AUDIT] ${entry.action} by user ${entry.userId}`,
      entry.details
    );
  } catch (error) {
    // Log audit failures but don't throw - don't block operations due to audit failures
    console.error("[AUDIT ERROR] Failed to log audit event:", error, entry);
  }
}

/**
 * Extract IP address from request headers
 */
export function extractIpAddress(
  headers: Record<string, string | undefined>
): string | null {
  // Try various common headers for IP address
  const ip =
    headers["x-forwarded-for"]?.split(",")[0].trim() ||
    headers["x-real-ip"] ||
    headers["cf-connecting-ip"] || // Cloudflare
    headers["x-client-ip"] ||
    null;

  return ip;
}

/**
 * Extract user agent from request headers
 */
export function extractUserAgent(
  headers: Record<string, string | undefined>
): string | null {
  return headers["user-agent"] || null;
}

/**
 * Helper to create audit context from request
 */
export function createAuditContext(
  headers: Record<string, string | undefined>
) {
  return {
    ipAddress: extractIpAddress(headers),
    userAgent: extractUserAgent(headers),
  };
}
