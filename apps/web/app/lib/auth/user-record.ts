import type { Database, UserRole } from "@supplex/types";

/**
 * Shape consumers expect for the cached user record. The runtime shape is
 * mixed: `useAuth.signIn` writes Supabase-JS rows (snake_case) into the
 * Zustand store and the Remix session, while server loaders historically
 * accessed the same record as camelCase Drizzle rows. As a result some
 * call sites read `userRecord.tenantId` / `userRecord.fullName` and
 * others read `userRecord.tenant_id` / `userRecord.full_name`, with
 * `_app.workflows.processes.$processInstanceId.tsx` defensively reading
 * both. Modelling both shapes here keeps SUP-13's `no-explicit-any`
 * promotion green without forcing a same-PR rewrite of every consumer;
 * reconciling onto a single canonical shape is a SUP-7 follow-up.
 */
export type UserRecord = {
  id: string;
  email?: string;
  /**
   * Narrowed to `UserRole` even though the DB column is `string`. Consumers
   * read this as a `UserRole` enum value; runtime data flowing through
   * `asUserRecord` is the trust boundary.
   */
  role: UserRole;
  /** CamelCase fields (Drizzle / consumer-expected shape). */
  tenantId?: string;
  fullName?: string;
  avatarUrl?: string | null;
  isActive?: boolean;
  lastLoginAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  /** Snake_case fields (Supabase JS `Database["users"]["Row"]` shape). */
  tenant_id?: string;
  full_name?: string;
  avatar_url?: string | null;
  is_active?: boolean;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Optional joined tenant relation (only present when explicitly joined). */
  tenant?: { id: string; name: string; slug: string } | null;
};

/**
 * Narrow a Supabase `users` row (or anything mid-flight in the
 * client-side auth flow) to the shape consumers expect. Trust-boundary
 * cast: TypeScript sees the camelCase consumer view; runtime data may
 * surface the snake_case shape on some fields.
 */
export function asUserRecord(
  row:
    | Database["public"]["Tables"]["users"]["Row"]
    | Record<string, unknown>
    | null
    | undefined
): UserRecord | undefined {
  if (!row) return undefined;
  return row as unknown as UserRecord;
}

/** Loose role check — runtime DB column is `string`, consumers want `UserRole`. */
export function userRecordHasRole(
  userRecord: UserRecord | undefined,
  allowed: ReadonlyArray<UserRole>
): boolean {
  if (!userRecord) return false;
  return (allowed as readonly string[]).includes(userRecord.role);
}
