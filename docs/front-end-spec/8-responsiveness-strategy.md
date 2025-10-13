# 8. Responsiveness Strategy

## 8.1 Breakpoints

| Breakpoint  | Min Width | Max Width | Target Devices                     | Tailwind Prefix | Primary Use Case                                           |
| ----------- | --------- | --------- | ---------------------------------- | --------------- | ---------------------------------------------------------- |
| **Mobile**  | 0px       | 767px     | iPhone, Android phones             | `(default)`     | Viewing data, approvals, quick searches on-the-go          |
| **Tablet**  | 768px     | 1023px    | iPad, Android tablets              | `md:`           | Field evaluations, document reviews during audits          |
| **Desktop** | 1024px    | 1439px    | Standard laptops, desktop monitors | `lg:`           | Primary work environment - data entry, analysis, workflows |
| **Wide**    | 1440px    | ∞         | Large monitors, ultra-wide         | `xl:`           | Dashboards with multiple panels, power user productivity   |

**Breakpoint Philosophy:** Mobile-first CSS (start with mobile, progressively enhance). Content-first breakpoints (break when content dictates). Fluid between breakpoints (use %, rem). Touch-first on <1024px (larger targets, swipe gestures).

## 8.2 Adaptation Patterns

### Layout Changes

**Mobile (0-767px):** Single column layout, full-width cards, hidden sidebar (hamburger menu), bottom navigation (Phase 2), simplified dashboard (2-column KPIs, stacked charts), collapsed tables (transform to card lists).

**Tablet (768-1023px):** 2-column grids, collapsible sidebar, responsive tables (horizontal scroll if needed), split views (list 40%, detail 60%).

**Desktop (1024-1439px):** 3-column grids, persistent sidebar (collapsible by preference), full data tables (all columns visible), modal dialogs (centered, not full-screen).

**Wide (1440px+):** 4-column grids, side panels (activity feeds, related items), multi-panel views, larger max-width containers (1536px).

### Navigation Changes

**Mobile Navigation:** Hamburger menu triggers slide-out drawer, full-screen overlay, 56px tall touch-optimized items, breadcrumbs collapse to "< Back" button, global search collapses to icon.

**Tablet Navigation:** Collapsible sidebar (icon toggle), persistent on landscape, abbreviated breadcrumbs (current + one level up).

**Desktop/Wide Navigation:** Always visible sidebar (icons + labels), hover previews on collapsed state, full breadcrumbs (complete path).

### Content Priority

**Mobile Content Hierarchy:** Critical actions first (Save, Submit at top), key data above fold, progressive disclosure (accordions for secondary details), reduced density (more whitespace), hide tertiary content (activity logs, metadata).

**Desktop Content Hierarchy:** All content visible simultaneously, sidebar + main + right context panel, full data tables, activity feeds and metadata visible.

### Interaction Changes

**Mobile Interactions:** Swipe gestures (reveal actions), pull-to-refresh on lists, long-press for context menu, bottom sheets (not modals), native inputs (date pickers, file uploads).

**Tablet Interactions:** Hover states (trackpad support), touch + mouse support, drag-and-drop works, split keyboard awareness.

**Desktop Interactions:** Hover tooltips (rich context), right-click menus, full keyboard shortcuts, multi-file drag-and-drop.
