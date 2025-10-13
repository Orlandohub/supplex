# 5. Component Library / Design System

## 5.1 Design System Approach

**Design System Approach:** Supplex will adopt the **Midday UI design system** ([GitHub](https://github.com/midday-ai/midday/tree/main/packages/ui)) as our foundational component library. Midday UI is built on **shadcn/ui** (headless, accessible components) with **Tailwind CSS** for styling. This approach provides:

- **Proven B2B SaaS patterns** - Midday is a production financial management app with similar data-heavy workflows
- **Accessibility built-in** - shadcn/ui components follow ARIA best practices and WCAG 2.1 AA standards
- **Customization flexibility** - Components are copied into our codebase (not npm packages), allowing full customization
- **Developer velocity** - Pre-built components reduce development time by 60-70% compared to custom builds
- **Tailwind integration** - Seamless integration with Tailwind CSS for rapid styling iterations

**Implementation Strategy:**

1. **Week 1:** Clone Midday UI package structure into `/packages/ui`
2. **Week 2:** Customize theme tokens (colors, typography, spacing) to match Supplex branding
3. **Week 3-4:** Extend base components with Supplex-specific variants (e.g., Supplier Card, Evaluation Rating)
4. **Ongoing:** Document component usage in Storybook for team reference

**References:**

- Midday UI Source: https://github.com/midday-ai/midday/tree/main/packages/ui
- shadcn/ui Documentation: https://ui.shadcn.com/
- Tailwind CSS: https://tailwindcss.com/

## 5.2 Core Components

### 5.2.1 Button

**Purpose:** Primary interactive element for user actions throughout the application.

**Variants:** Primary (main CTAs), Secondary (alternative actions), Destructive (dangerous actions), Ghost (subtle actions), Link (text-only navigation)

**States:** Default, Hover, Active, Disabled, Loading (with spinner)

**Usage Guidelines:** Use Primary for single primary action per screen. Secondary for supporting actions. Destructive actions always require confirmation dialog. Include loading state for async operations (>500ms). Minimum touch target: 44px height on mobile. Icon + text preferred over icon-only.

---

### 5.2.2 Data Table

**Purpose:** Display large datasets with sorting, filtering, and pagination for suppliers, evaluations, complaints.

**Variants:** Standard (default with zebra striping), Compact (reduced row height), Interactive (clickable rows), Selectable (checkbox column for bulk actions)

**States:** Row states (Default, Hover, Selected, Disabled), Column states (Sortable, Resizable), Loading state (skeleton rows), Empty state (illustration + CTA)

**Usage Guidelines:** Always include search/filter for tables >20 rows. Default sort by most recently updated. Show row count and pagination controls. Mobile: Transform to card list. Support keyboard navigation. Sticky header when scrolling.

---

### 5.2.3 Form Inputs

**Purpose:** Collect user data in forms (supplier details, evaluations, complaints).

**Variants:** Text Input, Textarea, Select Dropdown, Multi-select, Date Picker, File Upload (drag-and-drop), Radio Group, Checkbox, Rating Input (1-5 stars)

**States:** Default, Focus, Error, Disabled, Success

**Usage Guidelines:** Always include label (visible or aria-label). Show validation errors inline below field (red text + icon). Required fields marked with \*. File uploads show progress bar and preview. Date pickers show format hint. Rating inputs support keyboard (1-5 number keys).

---

### 5.2.4 Card

**Purpose:** Container component for grouping related content (KPIs, supplier details, document sections).

**Variants:** Default (white background, subtle border), Elevated (drop shadow), Interactive (clickable), Outlined (border-only)

**States:** Default, Hover (if interactive), Disabled

**Usage Guidelines:** Use for visually separating content sections. Include header with title + optional action button. Avoid nesting >2 levels deep. Mobile: Full-width with 16px padding. Desktop: Min 280px width, max 600px for readability.

---

### 5.2.5 Modal / Dialog

**Purpose:** Focused interactions requiring user attention (confirmations, forms, detail views).

**Variants:** Standard (500px for forms), Large (800px for detail views), Alert (400px for confirmations), Sheet (slide-in from right)

**States:** Open, Closed, Loading

**Usage Guidelines:** Always include close button (X icon). Destructive actions require explicit confirmation. ESC closes non-critical modals. Focus trap: Tab stays within modal. Mobile: Full-screen on <768px. Include primary + secondary actions in footer.

---

### 5.2.6 Badge / Status Indicator

**Purpose:** Display status, categories, counts, and labels throughout the UI.

**Variants:** Status (color-coded supplier status), Severity (complaint levels), Count (numerical indicators), Tag (categorical labels)

**States:** Default, Removable (with X icon)

**Usage Guidelines:** Use consistent color mapping (red=error/critical, yellow=warning, green=success, blue=info). Keep text concise (1-2 words). Include icon for important statuses. Count badges show max 99 (99+ for >99). Don't overuse - max 3 badges per card/row.

---

### 5.2.7 Toast / Notification

**Purpose:** Temporary feedback for user actions (success, error, info messages).

**Variants:** Success (green with checkmark), Error (red with X), Warning (yellow with alert), Info (blue with info icon)

**States:** Entering (slide in), Visible, Exiting (fade out)

**Usage Guidelines:** Auto-dismiss after 5 seconds (10s for important messages). Include action button if applicable ("Undo", "Retry"). Stack multiple toasts vertically (max 3 visible). Position: Top-right on desktop, top-center on mobile. Include close button for manual dismissal.

---

### 5.2.8 Charts & Data Visualization

**Purpose:** Visual representation of data for dashboards and analytics.

**Variants:** Donut Chart (performance distribution), Line Chart (trends), Bar Chart (comparative metrics), Radar Chart (multi-dimensional scores), Trend Sparkline (inline micro-charts)

**States:** Loading (skeleton), Interactive (hover tooltips), Empty (no data message)

**Usage Guidelines:** Use Recharts library (React-based, accessible). Always include axis labels and legend. Tooltips show exact values on hover. Support keyboard navigation. Color-blind safe palette. Responsive: Simplify chart on mobile. Export chart data to CSV option.

---

### 5.2.9 Stepper / Progress Indicator

**Purpose:** Guide users through multi-step workflows (qualification, evaluation).

**Variants:** Horizontal (desktop, 4 steps visible), Vertical (timeline for approvals), Progress Bar (linear percentage)

**States:** Step states - Upcoming (grayed), Active (highlighted), Completed (checkmark), Error (red)

**Usage Guidelines:** Show step numbers or icons. Active step visually distinct. Completed steps clickable to return. Show overall progress percentage. Mobile: Compress to dropdown showing current step + progress.

---

### 5.2.10 Navigation (Sidebar)

**Purpose:** Primary navigation for accessing main application sections.

**Variants:** Expanded (full width with icon + label), Collapsed (icon-only), Mobile (hamburger menu with overlay)

**States:** Item states - Default, Active (current section), Hover

**Usage Guidelines:** Active nav item highlighted (blue background or left border). Support keyboard navigation. Collapsible via toggle button (save preference). Show notification badges on nav items. Bottom nav items: Settings, User profile. Mobile: Slide-in overlay, swipe to close.
