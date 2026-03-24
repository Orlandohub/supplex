/**
 * JWT Local Verification
 * 
 * Verifies Supabase JWTs locally without calling Supabase API.
 * This is the industry-standard pattern used by Auth0, Clerk, and other auth providers.
 * 
 * Benefits:
 * - ~0.1ms verification time (vs 50-200ms API call)
 * - No network latency
 * - No rate limits
 * - Scales infinitely
 * 
 * Security:
 * - Verifies JWT signature with Supabase JWT secret
 * - Checks token expiration
 * - Validates issuer and audience
 * - Same security guarantees as API verification
 */

import * as jose from "jose";
import { config } from "../config";

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
    role?: string; // Application role (admin, supplier_user, etc.)
    tenant_id?: string;
    full_name?: string;
    email_verified?: boolean;
  };
  app_metadata?: {
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

/**
 * Verify JWT token locally
 * 
 * @param token - JWT token from Authorization header
 * @returns Decoded and verified JWT payload
 * @throws JWTVerificationError if token is invalid, expired, or missing required claims
 * 
 * @example
 * ```typescript
 * try {
 *   const payload = await verifyJWT(token);
 *   console.log("User ID:", payload.sub);
 *   console.log("Role:", payload.user_metadata?.role);
 * } catch (error) {
 *   if (error instanceof JWTVerificationError) {
 *     console.error("JWT verification failed:", error.code);
 *   }
 * }
 * ```
 */
export async function verifyJWT(token: string): Promise<SupabaseJWTPayload> {
  try {
    // Convert JWT secret to Uint8Array (required by jose)
    const secret = new TextEncoder().encode(config.jwt.secret);

    // Verify JWT signature and decode payload
    // This validates:
    // - Signature is valid (signed with our secret)
    // - Token hasn't been tampered with
    // - Token hasn't expired (exp claim)
    const { payload } = await jose.jwtVerify(token, secret, {
      // Validate issuer (Supabase Auth URL)
      issuer: config.supabase.url.endsWith("/")
        ? `${config.supabase.url}auth/v1`
        : `${config.supabase.url}/auth/v1`,
      // Validate audience (authenticated users)
      audience: "authenticated",
    });

    // Validate required claims
    if (!payload.sub) {
      throw new JWTVerificationError(
        "Missing user ID (sub claim)",
        "MISSING_CLAIMS"
      );
    }

    // Return typed payload
    return payload as SupabaseJWTPayload;
  } catch (error) {
    // Handle jose library errors
    if (error instanceof jose.errors.JWTExpired) {
      throw new JWTVerificationError(
        "JWT token has expired",
        "TOKEN_EXPIRED"
      );
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

    // Re-throw JWTVerificationError
    if (error instanceof JWTVerificationError) {
      throw error;
    }

    // Unknown error
    throw new JWTVerificationError(
      `JWT verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "INVALID_TOKEN"
    );
  }
}

/**
 * Extract user ID from JWT without full verification
 * 
 * WARNING: This does NOT verify the signature!
 * Only use for non-security-critical operations (logging, metrics).
 * Always use verifyJWT() for authentication.
 * 
 * @param token - JWT token
 * @returns User ID or null if token is malformed
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
 * Check if JWT is expired (without verification)
 * 
 * WARNING: This does NOT verify the signature!
 * Only use for quick checks before expensive operations.
 * Always use verifyJWT() for authentication.
 * 
 * @param token - JWT token
 * @returns true if token is expired
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

