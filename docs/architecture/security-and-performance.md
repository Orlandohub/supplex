# Security and Performance

## Security Requirements

### Frontend Security

**Content Security Policy:**

- Default-src 'self'
- Script-src with strict nonce-based CSP
- No inline scripts or styles
- Frame-ancestors 'none'

**XSS Prevention:**

- React auto-escaping
- DOMPurify for rich text (Phase 2)
- No dangerouslySetInnerHTML (ESLint enforced)

### Backend Security

**Input Validation:**

- Zod schemas at API boundary
- Drizzle parameterized queries
- No raw SQL with string interpolation

**Rate Limiting:**

- 100 req/min for anonymous
- 1,000 req/min for API keys
- 10 req/min for auth endpoints

## Performance Optimization

**Frontend Performance:**

- Bundle size target: <250KB initial
- Code splitting per route
- Lazy load heavy components
- Image optimization (WebP with fallback)

**Backend Performance:**

- API response time target: <500ms (p95)
- Database connection pooling
- Redis caching (5-60s TTL)
- Efficient indexes on all foreign keys

**Development-Only Features:**

When implementing development-only features (e.g., quick login, debug endpoints):

- MUST check `config.nodeEnv === 'development'` at route level
- MUST return 404 or 403 in non-development environments
- MUST document in architecture/authentication.md
- MUST include clear code comments explaining environment gating
- SHOULD log warnings if accessed in non-dev environments

Example:
```typescript
// DEV-ONLY ENDPOINT - Returns 404 in production
if (config.nodeEnv !== 'development') {
  return res.status(404).json({ error: 'Not found' });
}
```

Development features must never compromise production security. When in doubt, prefer explicit environment checks over implicit assumptions.

---
