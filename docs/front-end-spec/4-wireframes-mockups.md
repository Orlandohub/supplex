# 4. Wireframes & Mockups

## 4.1 Design Files

**Primary Design Files:** Figma workspace for Supplex UI/UX designs (to be created)

- **URL:** `https://figma.com/supplex-mvp-designs` (placeholder - create workspace in Week 1)
- **Design System:** Based on Midday UI package ([GitHub reference](https://github.com/midday-ai/midday/tree/main/packages/ui))
- **Component Library:** shadcn/ui with Midday customizations
- **Collaboration:** Shared with dev team for handoff, Zeplin/Figma Dev Mode for specs

## 4.2 Key Screen Layouts

### 4.2.1 Dashboard (Home)

**Purpose:** Central command center providing at-a-glance overview of supplier health, pending actions, and key metrics. First screen users see after login.

**Key Elements:**

- **Top KPI Cards** (4-across on desktop, 2-across mobile):
  - Total Active Suppliers (with trend indicator ↑↓)
  - Pending Qualifications (count with urgency badge)
  - Overdue Evaluations (count in warning color)
  - Open Complaints (count with severity breakdown)
- **Quick Actions Bar:** Floating action buttons (Midday-style) for:
  - Add New Supplier
  - Start Evaluation
  - Report Complaint
  - View Analytics
- **Supplier Performance Distribution** (donut chart):
  - Color-coded segments: Excellent (green), Good (blue), Fair (yellow), Poor (red)
  - Center displays total supplier count
  - Clickable segments filter to supplier list
- **Recent Activity Feed** (right sidebar on desktop, below charts on mobile):
  - Timeline view of recent approvals, evaluations, complaints
  - Avatar + action + timestamp format
  - "View All" link to full activity log
- **Upcoming Tasks Widget:**
  - List of evaluations due this week
  - Pending approvals requiring user's action
  - Certificate expirations (next 30 days)

**Interaction Notes:** All KPI cards clickable → navigate to filtered views. Charts support hover tooltips with detailed breakdowns. Quick actions use shadcn/ui Button component with icon + label. Dashboard refreshes every 60 seconds (live indicator in corner).

**Design File Reference:** `Figma > Screens > 01-Dashboard`

---

### 4.2.2 Supplier List

**Purpose:** Searchable, filterable directory of all suppliers with bulk actions and quick access to supplier details.

**Key Elements:**

- **Search & Filter Bar** (sticky header):
  - Global search input (with command-K shortcut indicator)
  - Filter dropdowns: Status, Category, Performance, Location
  - Active filter chips (dismissible)
  - "Clear All Filters" link
- **Data Table** (shadcn/ui Table component):
  - Columns: Checkbox | Supplier Name | Category | Status | Performance Score | Last Evaluation | Actions
  - Sortable column headers (click to sort ASC/DESC)
  - Row hover effect with quick action icons (Edit, View, Evaluate, Report)
  - Status badges with color coding (Approved=green, Conditional=yellow, Blocked=red)
  - Performance score with star rating visualization (1-5 stars)
- **Bulk Actions Toolbar** (appears when rows selected):
  - Export selected to CSV/Excel
  - Bulk status change (with confirmation dialog)
  - Schedule evaluations (opens multi-select date picker)
- **Pagination Controls** (bottom):
  - Rows per page selector (10, 25, 50, 100)
  - Page numbers with prev/next arrows
  - Total count display: "Showing 1-25 of 247 suppliers"

**Interaction Notes:** Table supports infinite scroll (optional, toggle in settings). Click row → navigate to supplier detail page. Ctrl/Cmd+Click → open in new tab. Mobile: Table transforms to card list view with swipe actions.

**Design File Reference:** `Figma > Screens > 02-Supplier-List`

---

### 4.2.3 Qualification Workflow

**Purpose:** Multi-step form for onboarding new suppliers with document collection and approval tracking.

**Key Elements:**

- **Progress Stepper** (top, Midday-style horizontal stepper):
  - Steps: Basic Info → Documents → Review → Approval
  - Current step highlighted, completed steps with checkmark, future steps grayed
  - Click to navigate between steps (if no validation errors)
- **Step 1: Basic Info Form:**
  - Two-column layout (desktop) / single column (mobile)
  - Fields: Supplier Name*, Tax ID*, Category*, Contact Name*, Email*, Phone*, Address
  - Real-time validation with inline error messages
  - "Save as Draft" (secondary) + "Next" (primary) buttons
- **Step 2: Document Upload:**
  - Document checklist (configurable per tenant)
  - Drag-and-drop upload zone (Midday file upload component)
  - File list with upload progress bars
  - Preview thumbnails for PDFs/images
  - Expiration date picker for certificates
- **Step 3: Review Summary:**
  - Read-only display of all entered data
  - Document list with "View" links
  - Risk score calculation display
  - "Edit" buttons to return to specific steps
  - "Submit for Approval" primary action
- **Step 4: Approval Tracking:**
  - Vertical timeline showing 3 approval stages
  - Each stage shows: Approver name, status, timestamp, comments
  - Real-time status updates via WebSocket (Phase 2)

**Interaction Notes:** Form autosaves to localStorage every 30 seconds. Unsaved changes warning on page exit. Document upload supports bulk selection. Approval notifications via email + in-app bell icon. Mobile: Stepper collapses to dropdown selector.

**Design File Reference:** `Figma > Screens > 03-Qualification-Workflow`

---

### 4.2.4 Supplier Detail Page

**Purpose:** Comprehensive view of individual supplier with tabs for different data categories and contextual actions.

**Key Elements:**

- **Header Section:**
  - Supplier name (H1) + status badge
  - Performance score (large, with trend indicator)
  - Quick action buttons: Evaluate | Report Complaint | Edit | Archive
  - Last evaluated date (subtle, gray text)
- **Tabbed Navigation** (shadcn/ui Tabs):
  - Overview | Documents | Evaluations | Complaints | Activity Log
- **Overview Tab:** Company details, performance scorecard (radar chart), recent evaluations timeline, key contacts
- **Documents Tab:** Categorized document grid with expiration alerts
- **Evaluations Tab:** Historical evaluations table with performance trend chart
- **Complaints Tab:** Complaints list with severity indicators and filters
- **Activity Log Tab:** Chronological audit trail filterable by action type

**Interaction Notes:** Header is sticky on scroll (compresses to compact mode). Tabs use URL hash for deep linking. Documents support preview in lightbox modal. Mobile: Tabs transform to accordion sections.

**Design File Reference:** `Figma > Screens > 04-Supplier-Detail`

---

### 4.2.5 Evaluation Form

**Purpose:** Guided form for scoring supplier performance across 4 dimensions with historical context.

**Key Elements:**

- **Supplier Context Panel** (left sidebar):
  - Supplier name + logo
  - Current overall score (large display)
  - Last 3 evaluation scores (mini timeline)
  - Evaluation period display
- **Evaluation Form** (main content):
  - 4 dimension cards (Quality, Delivery, Service, Cost)
  - Each: 1-5 star rating + comment field + helper text
  - Previous score shown for reference
  - Required comment indicator for scores ≤2
  - Optional overall comments (rich text editor)
- **Summary Panel** (right sidebar):
  - Calculated overall score
  - Score change from last evaluation
  - Performance tier with icon
  - Action buttons

**Interaction Notes:** Star ratings animate on hover. Clicking star sets rating, supports keyboard (1-5 keys). Comment fields expand on focus. Overall score updates in real-time. Draft auto-saved. Submission triggers confirmation dialog.

**Design File Reference:** `Figma > Screens > 05-Evaluation-Form`

---

### 4.2.6 Complaint Detail / CAPA Tracking

**Purpose:** Detailed view of a supplier complaint with CAPA workflow management and collaborative resolution.

**Key Elements:**

- **Complaint Header:** ID, severity badge, status progress bar, assignment details
- **Complaint Details Card:** Supplier, category, description, impact, attachments
- **Root Cause Analysis Section:** Editable RCA with templates (Phase 2)
- **CAPA Actions Panel:** Tabbed (Corrective | Preventive) with action tracking
- **Effectiveness Verification:** Checkbox + notes + verifier details
- **Activity Timeline** (right sidebar): Chronological activity log
- **Action Buttons:** Save, Close Complaint, Escalate

**Interaction Notes:** Status auto-updates based on CAPA progress. Overdue CAPAs highlighted in red. Email notifications on changes. Comments support @mentions. Mobile: Sections collapse to accordions. "Related Complaints" for trend analysis.

**Design File Reference:** `Figma > Screens > 06-Complaint-CAPA`
