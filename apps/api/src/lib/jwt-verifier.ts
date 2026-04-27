/**
 * JWT Verification — JWKS (primary) + HMAC fallback (transition)
 *
 * Phase 1 of HS256→ES256 migration (SEC-006).
 *
 * Verification is routed by the token's declared algorithm:
 *   ES256 → JWKS endpoint (asymmetric, Supabase-managed keys)
 *   HS256 → local HMAC with config.jwt.secret (transition only)
 *
 * The HMAC path is a temporary fallback for tokens signed before the
 * operator rotates to ES256 in Phase 2. It will be removed in Phase 3
 * once ES256 is confirmed stable.
 */

import * as jose from "jose";
import { config } from "../config";
import logger from "./logger";

/**
 * JWT Payload from Supabase Auth
 * Contains user identity and metadata
 */
export interface SupabaseJWTPayload {
  sub: string; // User ID
  email?: string;
  role: string; // Supabase role (authenticated, anon)
  aud: string; // Audience (authenticated)
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
  user_metadata?: {
    full_name?: string;
    email_verified?: boolean;
  };
  app_metadata?: {
    role?: string;
    tenant_id?: string;
    provider?: string;
    providers?: string[];
  };
}

/**
 * JWT Verification Error
 */
export class JWTVerificationError extends Error {
  constructor(
    message: string,
    public code: "INVALID_TOKEN" | "TOKEN_EXPIRED" | "MISSING_CLAIMS"
  ) {
    super(message);
    this.name = "JWTVerificationError";
  }
}

// ---------------------------------------------------------------------------
// JWKS singleton (lazy-initialized to avoid fetching before config is loaded)
// ---------------------------------------------------------------------------

let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof jose.createRemoteJWKSet> {
  if (!jwks) {
    const base = config.supabase.url.endsWith("/")
      ? config.supabase.url
      : `${config.supabase.url}/`;
    jwks = jose.createRemoteJWKSet(
      new URL(`${base}auth/v1/.well-known/jwks.json`)
    );
  }
  return jwks;
}

/** Exposed for tests only — resets the cached JWKS singleton. */
export function _resetJWKS(): void {
  jwks = null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a Supabase JWT using algorithm-based routing.
 *
 * @param token  Raw JWT string from the Authorization header
 * @returns      Decoded and verified payload
 * @throws       JWTVerificationError
 */
export async function verifyJWT(token: string): Promise<SupabaseJWTPayload> {
  // Step 1: Decode unverified header to determine algorithm
  let header: jose.ProtectedHeaderParameters;
  try {
    header = jose.decodeProtectedHeader(token);
  } catch {
    throw new JWTVerificationError(
      "Malformed JWT — unable to decode token header",
      "INVALID_TOKEN"
    );
  }

  const { alg } = header;
  const issuer = config.supabase.url.endsWith("/")
    ? `${config.supabase.url}auth/v1`
    : `${config.supabase.url}/auth/v1`;
  const verifyOptions = { issuer, audience: "authenticated" };

  // Step 2: Route to the correct verification path based on alg
  let payload: jose.JWTPayload;

  try {
    if (alg === "HS256") {
      // TRANSITION: HMAC fallback — remove after ES256 migration confirmed stable (Phase 3)
      if (!config.jwt?.secret) {
        throw new JWTVerificationError(
          "HS256 token received but no HMAC secret configured — legacy token cannot be verified",
          "INVALID_TOKEN"
        );
      }
      const secret = new TextEncoder().encode(config.jwt.secret);
      ({ payload } = await jose.jwtVerify(token, secret, {
        ...verifyOptions,
        algorithms: ["HS256"],
      }));
      logger.warn(
        "JWT verified via HMAC fallback — legacy HS256 token detected"
      );
    } else if (alg === "ES256") {
      ({ payload } = await jose.jwtVerify(token, getJWKS(), verifyOptions));
    } else {
      throw new JWTVerificationError(
        `Unsupported JWT algorithm: ${alg || "(missing)"}`,
        "INVALID_TOKEN"
      );
    }
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new JWTVerificationError("JWT token has expired", "TOKEN_EXPIRED");
    }
    if (error instanceof jose.errors.JWTInvalid) {
      throw new JWTVerificationError(
        "JWT token is invalid or malformed",
        "INVALID_TOKEN"
      );
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      throw new JWTVerificationError(
        `JWT claim validation failed: ${error.message}`,
        "INVALID_TOKEN"
      );
    }
    if (error instanceof JWTVerificationError) {
      throw error;
    }
    throw new JWTVerificationError(
      `JWT verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "INVALID_TOKEN"
    );
  }

  // Step 3: Validate required claims and narrow to SupabaseJWTPayload.
  // jose's JWTPayload is `JSONObject`-typed; we explicitly project to the
  // strongly-typed Supabase shape rather than blind-casting via `unknown`.
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new JWTVerificationError(
      "Missing user ID (sub claim)",
      "MISSING_CLAIMS"
    );
  }

  return projectSupabasePayload(payload);
}

/**
 * Project a verified `jose.JWTPayload` into the strongly-typed
 * `SupabaseJWTPayload` shape, validating fields with type predicates.
 *
 * Anything not present is left `undefined` so the caller can decide whether
 * a missing claim is acceptable.
 */
function projectSupabasePayload(payload: jose.JWTPayload): SupabaseJWTPayload {
  const userMetadata =
    payload.user_metadata && typeof payload.user_metadata === "object"
      ? (payload.user_metadata as Record<string, unknown>)
      : undefined;
  const appMetadata =
    payload.app_metadata && typeof payload.app_metadata === "object"
      ? (payload.app_metadata as Record<string, unknown>)
      : undefined;

  return {
    sub: payload.sub as string,
    email: typeof payload.email === "string" ? payload.email : undefined,
    role: typeof payload.role === "string" ? payload.role : "",
    aud: typeof payload.aud === "string" ? payload.aud : "",
    exp: typeof payload.exp === "number" ? payload.exp : 0,
    iat: typeof payload.iat === "number" ? payload.iat : 0,
    user_metadata: userMetadata
      ? {
          full_name:
            typeof userMetadata.full_name === "string"
              ? userMetadata.full_name
              : undefined,
          email_verified:
            typeof userMetadata.email_verified === "boolean"
              ? userMetadata.email_verified
              : undefined,
        }
      : undefined,
    app_metadata: appMetadata
      ? {
          role:
            typeof appMetadata.role === "string" ? appMetadata.role : undefined,
          tenant_id:
            typeof appMetadata.tenant_id === "string"
              ? appMetadata.tenant_id
              : undefined,
          provider:
            typeof appMetadata.provider === "string"
              ? appMetadata.provider
              : undefined,
          providers: Array.isArray(appMetadata.providers)
            ? appMetadata.providers.filter(
                (p): p is string => typeof p === "string"
              )
            : undefined,
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Unsafe helpers (decode-only, no signature verification)
// ---------------------------------------------------------------------------

/**
 * Extract user ID from JWT without full verification.
 * WARNING: Does NOT verify the signature — use for logging/metrics only.
 */
export function extractUserIdUnsafe(token: string): string | null {
  try {
    const decoded = jose.decodeJwt(token);
    return decoded.sub || null;
  } catch {
    return null;
  }
}

/**
 * Check if a JWT is expired without verification.
 * WARNING: Does NOT verify the signature — use for quick pre-checks only.
 */
export function isJWTExpiredUnsafe(token: string): boolean {
  try {
    const decoded = jose.decodeJwt(token);
    if (!decoded.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
}
