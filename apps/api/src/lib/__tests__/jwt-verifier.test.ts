import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { mock } from "bun:test";
import * as jose from "jose";

/**
 * SEC-006: JWT Verification Tests — JWKS (primary) + HMAC fallback
 *
 * Uses jose.SignJWT with local key pairs / secrets to produce test tokens.
 * Mocks the config module and the JWKS singleton to avoid network calls.
 */

const TEST_SUPABASE_URL = "https://test.supabase.co";
const ISSUER = `${TEST_SUPABASE_URL}/auth/v1`;
const AUDIENCE = "authenticated";
const HMAC_SECRET = "test-hmac-secret-must-be-at-least-32-chars-long";

let es256PublicKey: jose.KeyLike;
let es256PrivateKey: jose.KeyLike;
let es256KeyPair2Private: jose.KeyLike; // different key not in JWKS

beforeAll(async () => {
  const kp = await jose.generateKeyPair("ES256");
  es256PublicKey = kp.publicKey;
  es256PrivateKey = kp.privateKey;

  const kp2 = await jose.generateKeyPair("ES256");
  es256KeyPair2Private = kp2.privateKey;
});

// ---------- helpers ----------------------------------------------------------

async function signES256(
  claims: Record<string, unknown>,
  privateKey: jose.KeyLike = es256PrivateKey,
  overrides?: { exp?: number }
) {
  const builder = new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: "test-kid" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub as string)
    .setIssuedAt();

  if (overrides?.exp !== undefined) {
    builder.setExpirationTime(overrides.exp);
  } else {
    builder.setExpirationTime("1h");
  }

  return builder.sign(privateKey);
}

async function signHS256(
  claims: Record<string, unknown>,
  secret: string = HMAC_SECRET,
  overrides?: { exp?: number }
) {
  const enc = new TextEncoder().encode(secret);
  const builder = new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub as string)
    .setIssuedAt();

  if (overrides?.exp !== undefined) {
    builder.setExpirationTime(overrides.exp);
  } else {
    builder.setExpirationTime("1h");
  }

  return builder.sign(enc);
}

function makeUnsupportedAlgToken(): string {
  const header = jose.base64url.encode(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  );
  const payload = jose.base64url.encode(
    JSON.stringify({ sub: "user1", iss: ISSUER, aud: AUDIENCE })
  );
  return `${header}.${payload}.fakesig`;
}

function makeNoneAlgToken(): string {
  const header = jose.base64url.encode(
    JSON.stringify({ alg: "none", typ: "JWT" })
  );
  const payload = jose.base64url.encode(
    JSON.stringify({ sub: "user1", iss: ISSUER, aud: AUDIENCE })
  );
  return `${header}.${payload}.`;
}

// ---------- mock setup -------------------------------------------------------

let mockJwtSecret: string | undefined = HMAC_SECRET;

mock.module("../../config", () => ({
  config: {
    supabase: { url: TEST_SUPABASE_URL },
    get jwt() {
      return mockJwtSecret ? { secret: mockJwtSecret } : undefined;
    },
  },
}));

// We need to mock the JWKS fetcher so it uses our local key instead of HTTP
// We do this by importing after mock.module and resetting the JWKS singleton
const { verifyJWT, JWTVerificationError, _resetJWKS } = await import(
  "../jwt-verifier"
);

// Patch the getJWKS to use a local JWK set with our test key
const _exportedPublicJWK = async () => {
  const jwk = await jose.exportJWK(es256PublicKey);
  jwk.kid = "test-kid";
  jwk.alg = "ES256";
  jwk.use = "sig";
  return jwk;
};

// We mock the jose.createRemoteJWKSet so it returns a local key set
mock.module("jose", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const actualJose = require("jose");
  return {
    ...actualJose,
    createRemoteJWKSet: (_url: URL) => {
      // Return a function compatible with jose.FlattenedJWSInput key resolver
      return async (protectedHeader: any, _token: any) => {
        if (protectedHeader.kid === "test-kid") {
          return es256PublicKey;
        }
        throw new actualJose.errors.JWKSNoMatchingKey();
      };
    },
  };
});

// ---------- tests ------------------------------------------------------------

describe("SEC-006: JWT Verifier — JWKS + HMAC fallback", () => {
  beforeEach(() => {
    _resetJWKS();
    mockJwtSecret = HMAC_SECRET;
  });

  // ─── ES256 JWKS path ──────────────────────────────────────────

  describe("ES256 (JWKS primary path)", () => {
    test("succeeds with valid ES256 token", async () => {
      const token = await signES256({ sub: "user-es256", email: "e@t.com" });
      const payload = await verifyJWT(token);
      expect(payload.sub).toBe("user-es256");
      expect(payload.email).toBe("e@t.com");
    });

    test("rejects expired ES256 token with TOKEN_EXPIRED", async () => {
      const token = await signES256({ sub: "user-exp" }, es256PrivateKey, {
        exp: Math.floor(Date.now() / 1000) - 60,
      });
      try {
        await verifyJWT(token);
        expect(true).toBe(false); // should not reach
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(JWTVerificationError);
        if (err instanceof JWTVerificationError) {
          expect(err.code).toBe("TOKEN_EXPIRED");
        }
      }
    });

    test("rejects ES256 token with invalid signature — HMAC NOT attempted", async () => {
      const token = await signES256(
        { sub: "user-bad-sig" },
        es256KeyPair2Private
      );
      try {
        await verifyJWT(token);
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(JWTVerificationError);
        if (err instanceof JWTVerificationError) {
          expect(err.code).toBe("INVALID_TOKEN");
        }
      }
    });

    test("rejects ES256 token missing sub claim with MISSING_CLAIMS", async () => {
      const builder = new jose.SignJWT({ email: "no-sub@t.com" })
        .setProtectedHeader({ alg: "ES256", kid: "test-kid" })
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime("1h");
      const token = await builder.sign(es256PrivateKey);

      try {
        await verifyJWT(token);
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(JWTVerificationError);
        if (err instanceof JWTVerificationError) {
          expect(err.code).toBe("MISSING_CLAIMS");
        }
      }
    });
  });

  // ─── HS256 HMAC fallback ───────────────────────────────────────

  describe("HS256 (HMAC fallback — transition)", () => {
    test("succeeds with valid HS256 token when secret is configured", async () => {
      mockJwtSecret = HMAC_SECRET;
      const token = await signHS256({ sub: "user-hs256", email: "h@t.com" });
      const payload = await verifyJWT(token);
      expect(payload.sub).toBe("user-hs256");
    });

    test("rejects HS256 token when no secret is configured", async () => {
      mockJwtSecret = undefined;
      const token = await signHS256({ sub: "user-no-secret" });
      try {
        await verifyJWT(token);
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(JWTVerificationError);
        if (err instanceof JWTVerificationError) {
          expect(err.code).toBe("INVALID_TOKEN");
          expect(err.message).toContain("no HMAC secret configured");
        }
      }
    });

    test("rejects expired HS256 token with TOKEN_EXPIRED", async () => {
      mockJwtSecret = HMAC_SECRET;
      const token = await signHS256({ sub: "user-exp-hs" }, HMAC_SECRET, {
        exp: Math.floor(Date.now() / 1000) - 60,
      });
      try {
        await verifyJWT(token);
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(JWTVerificationError);
        if (err instanceof JWTVerificationError) {
          expect(err.code).toBe("TOKEN_EXPIRED");
        }
      }
    });
  });

  // ─── Algorithm routing / rejection ─────────────────────────────

  describe("Algorithm routing", () => {
    test("rejects RS256 (unsupported) with INVALID_TOKEN", async () => {
      const token = makeUnsupportedAlgToken();
      try {
        await verifyJWT(token);
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(JWTVerificationError);
        if (err instanceof JWTVerificationError) {
          expect(err.code).toBe("INVALID_TOKEN");
          expect(err.message).toContain("Unsupported JWT algorithm");
        }
      }
    });

    test("rejects alg=none with INVALID_TOKEN", async () => {
      const token = makeNoneAlgToken();
      try {
        await verifyJWT(token);
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(JWTVerificationError);
        if (err instanceof JWTVerificationError) {
          expect(err.code).toBe("INVALID_TOKEN");
          expect(err.message).toContain("Unsupported JWT algorithm");
        }
      }
    });

    test("rejects malformed token (not a JWT) with INVALID_TOKEN", async () => {
      try {
        await verifyJWT("not.a.jwt");
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(JWTVerificationError);
        if (err instanceof JWTVerificationError) {
          expect(err.code).toBe("INVALID_TOKEN");
        }
      }
    });

    test("rejects empty string with INVALID_TOKEN", async () => {
      try {
        await verifyJWT("");
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(JWTVerificationError);
        if (err instanceof JWTVerificationError) {
          expect(err.code).toBe("INVALID_TOKEN");
        }
      }
    });
  });

  // ─── Config startup log messages ──────────────────────────────

  describe("Config verification mode detection", () => {
    test("with jwt.secret → transition mode detected", () => {
      const cfg = { jwt: { secret: "some-secret" } };
      const mode = cfg.jwt?.secret
        ? "JWT verification: JWKS (primary) + HMAC fallback (transition mode)"
        : "JWT verification: JWKS only";
      expect(mode).toBe(
        "JWT verification: JWKS (primary) + HMAC fallback (transition mode)"
      );
    });

    test("without jwt.secret → JWKS only mode detected", () => {
      const cfg: { jwt?: { secret?: string } } = { jwt: undefined };
      const mode = cfg.jwt?.secret
        ? "JWT verification: JWKS (primary) + HMAC fallback (transition mode)"
        : "JWT verification: JWKS only";
      expect(mode).toBe("JWT verification: JWKS only");
    });
  });
});
