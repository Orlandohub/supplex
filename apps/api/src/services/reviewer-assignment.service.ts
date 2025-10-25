/**
 * Reviewer Assignment Service
 * Logic for assigning reviewers to qualification workflow stages
 * Based on tenant configuration with role-based fallbacks
 */

import { db } from "../lib/db";
import { tenants, users } from "@supplex/db";
import { eq, and } from "drizzle-orm";

export interface ReviewerInfo {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

/**
 * Get Stage 2 Reviewer (Quality Manager)
 * Implements fallback hierarchy for Stage 2 reviewer assignment
 *
 * Hierarchy:
 * 1. Check tenant.settings.workflowReviewers.stage2 (if exists)
 * 2. Fallback 1: First user with role = "quality_manager" in tenant
 * 3. Fallback 2: First user with role = "admin" in tenant
 * 4. Error: Return null if no users found
 *
 * @param tenantId - Tenant ID
 * @returns ReviewerInfo or null if no reviewer available
 */
export async function getStage2Reviewer(
  tenantId: string
): Promise<ReviewerInfo | null> {
  try {
    // Try tenant settings first
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (tenant?.settings) {
      const settings = tenant.settings as {
        workflowReviewers?: {
          stage1?: string;
          stage2?: string;
          stage3?: string;
        };
      };

      if (settings.workflowReviewers?.stage2) {
        const reviewer = await db.query.users.findFirst({
          where: and(
            eq(users.id, settings.workflowReviewers.stage2),
            eq(users.tenantId, tenantId),
            eq(users.isActive, true)
          ),
        });

        if (reviewer) {
          return {
            id: reviewer.id,
            fullName: reviewer.fullName,
            email: reviewer.email,
            role: reviewer.role,
          };
        }
      }
    }

    // Fallback 1: First quality manager
    const qualityManager = await db.query.users.findFirst({
      where: and(
        eq(users.tenantId, tenantId),
        eq(users.role, "quality_manager"),
        eq(users.isActive, true)
      ),
    });

    if (qualityManager) {
      return {
        id: qualityManager.id,
        fullName: qualityManager.fullName,
        email: qualityManager.email,
        role: qualityManager.role,
      };
    }

    // Fallback 2: First admin
    const admin = await db.query.users.findFirst({
      where: and(
        eq(users.tenantId, tenantId),
        eq(users.role, "admin"),
        eq(users.isActive, true)
      ),
    });

    if (admin) {
      return {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
      };
    }

    // No reviewer found
    return null;
  } catch (error) {
    console.error("Error getting Stage 2 reviewer:", error);
    return null;
  }
}

/**
 * Get Stage 1 Reviewer (Procurement Manager)
 * Reusable from Story 2.5 - included here for reference
 *
 * Hierarchy:
 * 1. Check tenant.settings.workflowReviewers.stage1 (if exists)
 * 2. Fallback 1: First user with role = "procurement_manager" in tenant
 * 3. Fallback 2: First user with role = "admin" in tenant
 * 4. Error: Return null if no users found
 *
 * @param tenantId - Tenant ID
 * @returns ReviewerInfo or null if no reviewer available
 */
export async function getStage1Reviewer(
  tenantId: string
): Promise<ReviewerInfo | null> {
  try {
    // Try tenant settings first
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (tenant?.settings) {
      const settings = tenant.settings as {
        workflowReviewers?: {
          stage1?: string;
          stage2?: string;
          stage3?: string;
        };
      };

      if (settings.workflowReviewers?.stage1) {
        const reviewer = await db.query.users.findFirst({
          where: and(
            eq(users.id, settings.workflowReviewers.stage1),
            eq(users.tenantId, tenantId),
            eq(users.isActive, true)
          ),
        });

        if (reviewer) {
          return {
            id: reviewer.id,
            fullName: reviewer.fullName,
            email: reviewer.email,
            role: reviewer.role,
          };
        }
      }
    }

    // Fallback 1: First procurement manager
    const procurementManager = await db.query.users.findFirst({
      where: and(
        eq(users.tenantId, tenantId),
        eq(users.role, "procurement_manager"),
        eq(users.isActive, true)
      ),
    });

    if (procurementManager) {
      return {
        id: procurementManager.id,
        fullName: procurementManager.fullName,
        email: procurementManager.email,
        role: procurementManager.role,
      };
    }

    // Fallback 2: First admin
    const admin = await db.query.users.findFirst({
      where: and(
        eq(users.tenantId, tenantId),
        eq(users.role, "admin"),
        eq(users.isActive, true)
      ),
    });

    if (admin) {
      return {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
      };
    }

    // No reviewer found
    return null;
  } catch (error) {
    console.error("Error getting Stage 1 reviewer:", error);
    return null;
  }
}
