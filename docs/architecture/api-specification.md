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
      description: |
        Returns paginated list of suppliers in tenant.
        **Access Control:** supplier_user role is redirected to their own supplier detail page.
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

  /suppliers/by-user/{userId}:
    get:
      tags: [Suppliers]
      summary: Get supplier associated with a user ID
      description: |
        Returns the supplier associated with a specific user (for supplier_user role).
        Used to find the supplier that a supplier_user account is linked to.
        **Access Control:** Requires authentication. Enforces tenant isolation.
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: User ID to find associated supplier
      responses:
        "200":
          description: Supplier found
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      id:
                        type: string
                      name:
                        type: string
                      status:
                        type: string
                      supplierUserId:
                        type: string
        "404":
          description: No supplier associated with this user
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        "401":
          description: Authentication required
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  # Workflow Engine Endpoints (Story 2.2.8)
  
  /workflows/instantiate:
    post:
      tags: [Workflows]
      summary: Instantiate a workflow from published template
      description: |
        Creates a new process instance from a published workflow template version.
        All steps are created: first step active, others blocked.
        **Access Control:** Requires authentication. Tenant-scoped.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - workflowTemplateVersionId
              properties:
                workflowTemplateVersionId:
                  type: string
                  format: uuid
                  description: ID of published workflow template version
                entityType:
                  type: string
                  description: Optional entity type (e.g., 'supplier')
                entityId:
                  type: string
                  format: uuid
                  description: Optional entity ID reference
                metadata:
                  type: object
                  description: Optional workflow metadata
      responses:
        "201":
          description: Workflow instantiated successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      processInstanceId:
                        type: string
                        format: uuid
                      firstStepId:
                        type: string
                        format: uuid
        "400":
          description: Workflow not published or invalid request
        "403":
          description: Workflow belongs to different tenant
        "404":
          description: Workflow template version not found

  /workflows/processes/{processInstanceId}:
    get:
      tags: [Workflows]
      summary: Get complete workflow process state
      description: |
        Returns process instance with all steps, tasks, and comments.
        **Access Control:** Requires authentication. Tenant-scoped.
      parameters:
        - name: processInstanceId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Process state retrieved
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      process:
                        type: object
                        description: Process instance details
                      steps:
                        type: array
                        description: All step instances
                      tasks:
                        type: array
                        description: Active task instances
                      comments:
                        type: array
                        description: All comments
        "403":
          description: Process belongs to different tenant
        "404":
          description: Process not found

  /workflows/steps/{stepInstanceId}:
    get:
      tags: [Workflows]
      summary: Get step instance details
      description: |
        Returns step instance with configuration, tasks, and comments.
        **Access Control:** Requires authentication. Tenant-scoped.
      parameters:
        - name: stepInstanceId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Step details retrieved
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      step:
                        type: object
                      template:
                        type: object
                      tasks:
                        type: array
                      comments:
                        type: array
        "403":
          description: Step belongs to different tenant
        "404":
          description: Step not found

  /workflows/steps/{stepInstanceId}/complete:
    post:
      tags: [Workflows]
      summary: Complete a workflow step
      description: |
        Completes a step with submit, approve, or decline action.
        For decline, comment is required and workflow returns to previous step.
        **Access Control:** Requires authentication. User must be assigned to step.
      parameters:
        - name: stepInstanceId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - action
              properties:
                action:
                  type: string
                  enum: [submit, approve, decline]
                  description: Completion action type
                comment:
                  type: string
                  description: Required for decline, optional for submit/approve
      responses:
        "200":
          description: Step completed successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      stepStatus:
                        type: string
                      nextStepId:
                        type: string
                        format: uuid
        "400":
          description: Invalid action or missing required comment
        "403":
          description: User not authorized to complete step
        "404":
          description: Step not found

  /workflows/comments:
    post:
      tags: [Workflows, Comments]
      summary: Create comment on workflow step
      description: |
        Creates a comment or reply on a workflow step.
        Supports threading via parentCommentId.
        **Access Control:** Requires authentication. Tenant-scoped.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - processInstanceId
                - stepInstanceId
                - entityType
                - commentText
              properties:
                processInstanceId:
                  type: string
                  format: uuid
                stepInstanceId:
                  type: string
                  format: uuid
                entityType:
                  type: string
                  enum: [form, document]
                parentCommentId:
                  type: string
                  format: uuid
                  description: Optional parent comment for threading
                commentText:
                  type: string
                  minLength: 1
      responses:
        "201":
          description: Comment created
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    description: Created comment
        "403":
          description: Process/step belongs to different tenant
        "404":
          description: Process or step not found

  /workflows/comments/step/{stepInstanceId}:
    get:
      tags: [Workflows, Comments]
      summary: Get all comments for a step
      description: |
        Returns all comments for a step including user information.
        Comments ordered by created_at ascending.
        **Access Control:** Requires authentication. Tenant-scoped.
      parameters:
        - name: stepInstanceId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Comments retrieved
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                        commentText:
                          type: string
                        parentCommentId:
                          type: string
                        createdAt:
                          type: string
                          format: date-time
                        commentedByUser:
                          type: object
                          properties:
                            id:
                              type: string
                            fullName:
                              type: string
                            email:
                              type: string
        "403":
          description: Step belongs to different tenant
        "404":
          description: Step not found
```

_(Full OpenAPI specification continues with all endpoints...)_

---
