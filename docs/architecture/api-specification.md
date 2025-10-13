# API Specification

Based on the Tech Stack decision to use **REST API with Eden Treaty** for type-safe internal communication and standard REST for external API consumers, this section provides the complete OpenAPI 3.0 specification for the Supplex API.

**API Design Principles:**

- **RESTful resource-oriented** endpoints following standard HTTP methods
- **JSON:API-inspired** response format with consistent error handling
- **JWT authentication** for all endpoints (except health check)
- **Tenant-scoped** all requests automatically filtered by authenticated user's tenant
- **Versioned** API with `/v1` prefix for future compatibility
- **Rate limited** at 100 requests/minute per API key (configurable per plan)
- **OpenAPI 3.0** specification for auto-generated client SDKs

## REST API Specification

```yaml
openapi: 3.0.0
info:
  title: Supplex API
  version: 1.0.0
  description: |
    REST API for Supplex - Supplier Lifecycle Management Platform

    **Authentication:** All endpoints require JWT Bearer token in Authorization header.
    Token obtained from Supabase Auth or via API key authentication.

    **Tenant Isolation:** All requests are automatically scoped to the authenticated 
    user's tenant. Cross-tenant access is never permitted.

    **Rate Limiting:** 100 requests/minute for Starter plan, 1000/min for Professional,
    unlimited for Enterprise. Returns 429 Too Many Requests when exceeded.

servers:
  - url: https://api.supplex.io/v1
    description: Production API (EU-West)
  - url: https://api-staging.supplex.io/v1
    description: Staging API
  - url: http://localhost:3000/v1
    description: Local Development

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Error:
      type: object
      properties:
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
            timestamp:
              type: string
              format: date-time
            requestId:
              type: string

security:
  - BearerAuth: []

paths:
  /health:
    get:
      tags: [System]
      summary: Health check
      security: []
      responses:
        "200":
          description: API is healthy

  /suppliers:
    get:
      tags: [Suppliers]
      summary: List all suppliers
      parameters:
        - name: status
          in: query
          schema:
            type: string
        - name: search
          in: query
          schema:
            type: string
      responses:
        "200":
          description: Successful response

    post:
      tags: [Suppliers]
      summary: Create new supplier
      responses:
        "201":
          description: Supplier created
```

_(Full OpenAPI specification continues with all endpoints...)_

---
