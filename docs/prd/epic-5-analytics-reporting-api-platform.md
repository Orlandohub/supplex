# Epic 5: Analytics, Reporting & API Platform

**Epic Goal:** Provide executives and managers with actionable insights through role-specific dashboards, enable data export capabilities for external analysis, and deliver a complete REST API with documentation for integrations. This epic transforms raw data into business intelligence and enables enterprise customers to integrate Supplex with their existing systems.

## Story 5.1: Executive Dashboard

As an **executive**,
I want a high-level dashboard showing key supplier metrics,
so that I can quickly assess supplier management health and identify issues.

**Acceptance Criteria:**

1. Dashboard page accessible from main navigation with "Dashboard" menu item
2. Role-based dashboard routing: Executives see Executive Dashboard, others see role-specific views
3. Header displays: "Executive Dashboard", Date range selector (Last 30 days, Last quarter, Last year, Custom), Auto-refresh toggle
4. KPI cards section displays: Total active suppliers, Suppliers by status (Approved/Conditional/Blocked counts with %), Active qualifications (in progress), Open complaints (with critical count)
5. Each KPI card shows: Current value (large), Trend indicator (↑/↓/→), Change from previous period (+5, -2, etc.), Color-coded based on health (green=good, yellow=warning, red=alert)
6. Supplier status distribution chart: Donut chart showing breakdown by status (Approved, Conditional, Blocked, Prospect, Qualified)
7. Performance tier distribution: Bar chart showing High/Medium/Low performers with counts
8. Recent activity feed: Last 10 significant events (new suppliers, qualifications completed, complaints registered, evaluations submitted)
9. Activity feed items clickable to navigate to relevant detail pages
10. Top performers widget: List of top 5 suppliers by evaluation score with scores and trend
11. At-risk suppliers widget: List of suppliers with recent performance drops or critical complaints
12. Upcoming actions widget: Next 5 due items (evaluations due, qualification reviews pending, CAPA actions due)
13. All charts filterable by date range from header selector
14. "Export Dashboard" button generates PDF snapshot with all widgets and current data
15. Dashboard data refreshes automatically every 5 minutes if auto-refresh enabled
16. Mobile-responsive with widgets stacking vertically and charts adapting to smaller screens

## Story 5.2: Procurement Dashboard

As a **procurement manager**,
I want a dashboard focused on procurement metrics and tasks,
so that I can manage supplier relationships and qualification pipelines effectively.

**Acceptance Criteria:**

1. Procurement managers automatically land on Procurement Dashboard (role-based routing)
2. Header displays: "Procurement Dashboard", Tenant name, Date range selector, Export button
3. KPI cards: Total suppliers managed, New suppliers added (this period), Qualifications pending review, Average qualification time (days)
4. My tasks section prominently displayed: Qualification reviews assigned to me (count), Evaluations assigned to me (count), Overdue items (highlighted)
5. Task list shows next 10 items requiring action with: Type (Qualification/Evaluation), Supplier name, Due date, Days pending, "Take Action" button
6. Supplier acquisition funnel chart: Stages = Prospect → Qualification → Approved, with conversion rates between stages
7. Qualification pipeline chart: Bar chart showing qualifications by stage (Draft, Stage 1, Stage 2, Stage 3, Approved, Rejected)
8. Supplier distribution by category: Pie chart showing supplier counts per category (Raw Materials, Logistics, etc.)
9. Recent supplier additions: List of last 10 suppliers added with status and date
10. Document expiration alerts: Certificates/documents expiring within 30 days with supplier name, document type, expiration date
11. Performance summary: Average supplier score across all active suppliers, Distribution of scores (histogram)
12. Quick actions panel: "Add Supplier", "Start Qualification", "Create Evaluation" buttons
13. All charts support drill-down: Click segment to see detailed list
14. Mobile-responsive with priority on "My Tasks" section at top

## Story 5.3: Quality Dashboard

As a **quality manager**,
I want a dashboard focused on quality metrics and supplier issues,
so that I can monitor quality performance and respond to problems quickly.

**Acceptance Criteria:**

1. Quality managers automatically land on Quality Dashboard (role-based routing)
2. Header displays: "Quality Dashboard", Date range selector, "Generate Quality Report" button
3. KPI cards: Total complaints (open + closed), Open complaints, Critical complaints, Average resolution time (days), CAPA completion rate (%)
4. Quality alerts section: Critical complaints overdue, Suppliers with multiple recent complaints, Evaluations showing declining trends
5. Each alert clickable with direct link to relevant page
6. Complaint trend chart: Line chart showing complaint volume over time (by month), Color-coded by severity
7. Complaints by category: Horizontal bar chart showing top 5 complaint categories with counts
8. Complaints by supplier: Table showing top 10 suppliers by complaint count with severity breakdown
9. CAPA effectiveness metrics: Total CAPA actions, Completed on time (%), Overdue actions (count), Average time to complete
10. Supplier quality tier distribution: Donut chart showing performance tiers (High/Medium/Low) with percentages
11. Quality cost analysis: Total financial impact of complaints (current period), Cost by supplier (top 5), Cost trend over time
12. Recent quality events: Last 10 activities (complaints registered, CAPA completed, evaluations submitted) with timestamps
13. Evaluation completion tracker: % of suppliers evaluated in current quarter, Overdue evaluations count, Next evaluations due (list)
14. All metrics compare current period vs. previous period with trend indicators
15. "Export Quality Report" generates comprehensive PDF with all quality metrics and trends
16. Mobile-responsive with alerts section prioritized at top

## Story 5.4: Data Export Capabilities

As a **user**,
I want to export data to CSV and PDF formats,
so that I can analyze data externally and share reports with stakeholders.

**Acceptance Criteria:**

1. All list views include "Export" dropdown button with options: CSV, PDF, Excel (xlsx)
2. CSV export includes all columns from current view plus any hidden metadata fields
3. CSV respects current filters and sorting (exports what user sees)
4. PDF export generates formatted document with: Report title, Date/time generated, User name, Filters applied, Data table with pagination
5. Excel export includes formatted spreadsheet with: Header row (bold), Frozen header, Auto-filter enabled, Column widths auto-sized
6. Large datasets (>1000 rows) trigger background job with email notification when ready: "Your export is ready for download"
7. Export progress indicator displays for large datasets: "Exporting... 45% complete"
8. Downloaded files named with convention: `{entity}_{date}_{time}.{format}` (e.g., `suppliers_2025-10-13_14-30.csv`)
9. Dashboard exports (PDF) include: All visible widgets, Charts as images, KPI values, Export timestamp, Tenant branding
10. Supplier scorecard export (PDF) includes: Supplier header, All performance charts, Evaluation history table, Complaints summary, Professional formatting
11. Complaint report export (PDF) includes: Executive summary, Complaint details, CAPA action status, Impact analysis, Charts and graphs
12. All exports respect tenant data isolation (only exports data user has access to)
13. Export rate limiting: Max 10 exports per user per hour (prevents abuse)
14. Export history tracked in admin logs: User, Entity type, Format, Timestamp, Row count
15. Mobile devices trigger download or "Share" dialog based on platform capabilities

## Story 5.5: REST API Foundation & Documentation

As a **developer (external)**,
I want a well-documented REST API,
so that I can integrate Supplex with other systems.

**Acceptance Criteria:**

1. RESTful API endpoints created for all core entities: Suppliers, Qualifications, Evaluations, Complaints, CAPA Actions
2. API base URL: `https://api.supplex.com/v1/` (or tenant subdomain pattern)
3. API versioning in URL path: `/v1/` prefix for all endpoints
4. Standard HTTP methods: GET (list/detail), POST (create), PUT/PATCH (update), DELETE (soft delete)
5. Consistent response format: `{ "success": true/false, "data": {...}, "meta": {...}, "errors": [...] }`
6. Pagination for list endpoints: Query params `page`, `limit` (default 20, max 100), Response includes `total`, `page`, `totalPages`
7. Filtering via query params: `?status=approved&category=raw_materials` with standard operators
8. Sorting via query param: `?sort=created_at:desc` (field:direction format)
9. Field selection: `?fields=id,name,status` returns only specified fields (reduces payload)
10. OpenAPI 3.0 specification auto-generated from ElysiaJS routes (using Swagger plugin)
11. Swagger UI hosted at `/api/docs` with interactive API explorer
12. API documentation includes: Endpoint descriptions, Request/response examples, Authentication requirements, Error codes, Rate limits
13. All API responses include standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
14. Error responses follow RFC 7807 problem details format with clear error messages
15. API playground allows testing endpoints directly from documentation with authentication

## Story 5.6: API Authentication & Authorization

As a **developer (external)**,
I want secure API authentication,
so that I can access Supplex data programmatically without compromising security.

**Acceptance Criteria:**

1. API supports two authentication methods: JWT tokens (for user context), API keys (for service accounts)
2. JWT authentication uses same tokens from Supabase Auth (httpOnly cookies or Authorization header)
3. API key authentication via `X-API-Key` header or `api_key` query parameter
4. API Keys page in Settings shows list of API keys for tenant
5. "Generate API Key" button creates new key with: Key name (required), Description, Permissions (read-only, read-write, admin), Expiration date (optional)
6. Generated key displayed once with warning: "Copy this key now. You won't be able to see it again."
7. API key list shows: Key name, Permissions, Last used date, Expiration date, Created date, "Revoke" button
8. Revoked keys immediately invalid for all API requests
9. API key permissions enforced at endpoint level: Read-only keys cannot POST/PUT/DELETE
10. All API requests validate tenant context from JWT or API key (enforces multi-tenancy)
11. Rate limiting per API key: 1000 requests/hour (configurable per tenant), 429 status when exceeded
12. Rate limit headers in response: `X-RateLimit-Limit: 1000`, `X-RateLimit-Remaining: 847`, `X-RateLimit-Reset: 1697234567`
13. API requests logged: Timestamp, API key/user, Endpoint, Method, Response status, Response time
14. Admin can view API usage dashboard: Requests per day chart, Top endpoints, Top API keys, Error rate
15. Failed auth returns 401 with clear error: `{ "error": "Invalid API key" }` or `{ "error": "JWT token expired" }`
16. Audit log records API key creation, usage, and revocation

## Story 5.7: API Endpoints - Suppliers & Qualifications

As a **developer (external)**,
I want API endpoints for suppliers and qualifications,
so that I can integrate supplier data with external systems.

**Acceptance Criteria:**

1. **GET /v1/suppliers** - List all suppliers with pagination, filtering, sorting
2. **GET /v1/suppliers/{id}** - Get supplier detail including contacts, documents, status
3. **POST /v1/suppliers** - Create new supplier (requires write permissions)
4. **PUT /v1/suppliers/{id}** - Update supplier (requires write permissions)
5. **DELETE /v1/suppliers/{id}** - Soft delete supplier (requires admin permissions)
6. **GET /v1/suppliers/{id}/qualifications** - List qualifications for specific supplier
7. **GET /v1/suppliers/{id}/evaluations** - List evaluations for specific supplier
8. **GET /v1/suppliers/{id}/complaints** - List complaints for specific supplier
9. **GET /v1/qualifications** - List all qualifications with filters: status, supplier, date range
10. **GET /v1/qualifications/{id}** - Get qualification detail including stages, documents, approvals
11. **POST /v1/qualifications** - Initiate new qualification workflow
12. **PUT /v1/qualifications/{id}/stages/{stageNumber}** - Approve or reject qualification stage
13. **POST /v1/qualifications/{id}/documents** - Upload document to qualification checklist
14. All endpoints validate tenant context and return only tenant-specific data
15. Supplier response includes: id, name, status, contacts, categories, created_at, updated_at, metadata
16. Qualification response includes: id, supplier_id, status, current_stage, risk_score, stages array, timeline
17. All write operations return created/updated resource in response body
18. Validation errors return 422 with detailed field-level error messages

## Story 5.8: API Endpoints - Evaluations & Complaints

As a **developer (external)**,
I want API endpoints for evaluations and complaints,
so that I can integrate quality and performance data with external systems.

**Acceptance Criteria:**

1. **GET /v1/evaluations** - List all evaluations with filters: supplier, period, status, score range
2. **GET /v1/evaluations/{id}** - Get evaluation detail including dimension scores, comments, evidence
3. **POST /v1/evaluations** - Create new evaluation
4. **PUT /v1/evaluations/{id}** - Update evaluation scores and submit
5. **GET /v1/complaints** - List all complaints with filters: supplier, status, severity, category, date range
6. **GET /v1/complaints/{id}** - Get complaint detail including CAPA actions, impacts, timeline
7. **POST /v1/complaints** - Register new complaint
8. **PUT /v1/complaints/{id}** - Update complaint status, assign, add comments
9. **GET /v1/complaints/{id}/capa-actions** - List CAPA actions for complaint
10. **POST /v1/complaints/{id}/capa-actions** - Add corrective or preventive action
11. **PUT /v1/complaints/{id}/capa-actions/{actionId}** - Update CAPA action status, complete, verify
12. Evaluation response includes: id, supplier_id, period, overall_score, dimensions array (with scores, weights, comments), status, evaluator
13. Complaint response includes: id, supplier_id, complaint_number, title, description, severity, category, status, reported_by, due_date, capa_summary
14. CAPA action response includes: id, complaint_id, action_type, description, responsible_party, status, target_date, completion_date
15. All write operations trigger appropriate notifications (emails) just like UI actions
16. Webhook support (Phase 2) documented as future enhancement in API docs
17. All endpoints include example requests/responses in OpenAPI spec
18. Rate limiting applies per endpoint (some endpoints may have lower limits)

## Story 5.9: API Client Library & Type Safety

As a **developer (external)**,
I want a type-safe API client library,
so that I can integrate with Supplex easily and catch errors at compile time.

**Acceptance Criteria:**

1. Eden Treaty client library auto-generated from ElysiaJS API (provides end-to-end type safety)
2. NPM package published: `@supplex/api-client` with TypeScript types included
3. Package documentation includes: Installation instructions, Authentication setup, Usage examples, Type definitions
4. Client library supports both API key and JWT authentication
5. Example usage in docs: `const client = new SupplexClient({ apiKey: 'xxx' }); const suppliers = await client.suppliers.list();`
6. Client library handles: Automatic retries (3 attempts with exponential backoff), Rate limit handling (waits and retries), Error parsing and typing
7. Type-safe request/response objects: `CreateSupplierRequest`, `SupplierResponse`, `ListSuppliersResponse`
8. Pagination helper: `client.suppliers.list().paginate()` returns async iterator for all pages
9. Filter builder for complex queries: `client.suppliers.list({ filter: { status: 'approved', category: ['raw_materials'] } })`
10. React hooks package (optional): `@supplex/react-hooks` with `useSuppliers()`, `useSupplier(id)`, etc.
11. Code examples repository on GitHub with common integration patterns
12. Postman collection available for download from API docs page
13. Error handling includes typed error classes: `SupplexAPIError`, `SupplexAuthError`, `SupplexRateLimitError`
14. Client library version aligned with API version (v1.x.x for API v1)
15. Changelog maintained for client library with breaking changes clearly marked

## Story 5.10: Analytics & Reporting API Endpoints

As a **developer (external)**,
I want API endpoints for analytics and aggregated data,
so that I can build custom dashboards and reports in external BI tools.

**Acceptance Criteria:**

1. **GET /v1/analytics/suppliers/summary** - Aggregate supplier metrics: Total count, By status, By category, By performance tier
2. **GET /v1/analytics/qualifications/summary** - Qualification metrics: Total count, By status, Avg completion time, Conversion rates
3. **GET /v1/analytics/evaluations/summary** - Evaluation metrics: Total count, Avg scores, Score distribution, Completion rate
4. **GET /v1/analytics/complaints/summary** - Complaint metrics: Total count, By severity, By category, Resolution rate, Avg resolution time
5. **GET /v1/analytics/suppliers/{id}/scorecard** - Complete supplier scorecard data: Scores, Trends, Evaluations, Complaints
6. **GET /v1/analytics/performance-trends** - Time series data: Supplier scores over time, Complaint volumes, Qualification throughput
7. All analytics endpoints support date range filters: `?start_date=2025-01-01&end_date=2025-12-31`
8. Group by support: `?group_by=month` or `?group_by=category` for aggregated results
9. Response includes both raw data and pre-calculated insights/recommendations
10. Analytics responses optimized for charting: Include labels array, values array, colors for visualization
11. Comparison mode: `?compare=previous_period` returns current vs. previous period data
12. Export format support: `?format=json` (default) or `?format=csv` for direct BI tool import
13. Analytics endpoints have higher rate limits: 5000 requests/hour (more read-heavy usage expected)
14. Caching headers included: `Cache-Control: public, max-age=300` (5 min cache for analytics)
15. All calculations match dashboard metrics exactly (consistency between UI and API)
16. Example BI tool integrations documented: Tableau, Power BI, Looker, Metabase
17. Real-time metrics vs. cached metrics clearly indicated in documentation
