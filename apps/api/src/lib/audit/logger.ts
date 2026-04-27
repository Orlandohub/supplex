import { db } from "../db";
import { auditLogs } from "@supplex/db";
import type { AuditAction } from "@supplex/types";
import { logger } from "../logger";

const auditLogger = logger.child({ module: "audit" });

/**
 * Audit Log Entry Parameters
 */
export interface AuditLogEntry {
  tenantId: string;
  userId: string;
  targetUserId?: string | null;
  action: AuditAction;
  details: Record<string, unknown>;
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

    auditLogger.info(
      {
        action: entry.action,
        userId: entry.userId,
        tenantId: entry.tenantId,
        details: entry.details,
      },
      "Audit event logged"
    );
  } catch (error) {
    auditLogger.error(
      {
        err: error,
        action: entry.action,
        userId: entry.userId,
        tenantId: entry.tenantId,
      },
      "Failed to persist audit event"
    );
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
    headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
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
