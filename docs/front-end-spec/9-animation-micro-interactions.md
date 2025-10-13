# 9. Animation & Micro-interactions

## 9.1 Motion Principles

**Animation Philosophy:** Purposeful not decorative (every animation serves functional purpose), Fast and snappy (100-300ms for business users), Respect user preferences (honor `prefers-reduced-motion`), Performance-first (CSS transforms and opacity only for 60fps), Consistent timing (reuse easing functions).

**When to Animate:** User-triggered actions (clicks, submissions, toggles), State changes (loading, status updates, feedback), Spatial relationships (modals, panels, list movements), Drawing attention (notifications, alerts, data updates). Never auto-play animations without interaction (except loading spinners), no endless loops.

## 9.2 Key Animations

- **Button Press Feedback:** Scale down on press (0.98), spring back on release (Duration: 100ms press, 150ms release, Easing: ease-out)
- **Modal / Dialog Entry:** Fade in backdrop + scale up modal (Duration: 200ms, Easing: cubic-bezier(0.16, 1, 0.3, 1))
- **Toast Notification:** Slide in from top-right + fade in (Duration: 300ms entry, 200ms exit, Easing: ease-out/ease-in)
- **Loading Spinner:** Continuous rotation (Duration: 1000ms, Easing: linear)
- **Skeleton Loading:** Shimmer effect (Duration: 1500ms loop, Easing: ease-in-out)
- **Table Row Hover:** Background color transition (Duration: 150ms, Easing: ease-in-out)
- **Accordion Expand/Collapse:** Height transition + rotate caret (Duration: 250ms, Easing: cubic-bezier(0.4, 0, 0.2, 1))
- **Status Badge Change:** Pulse effect + color transition (Duration: 400ms pulse, 200ms color, Easing: ease-in-out)
- **Form Field Validation:** Shake on error + border color red (Duration: 300ms shake, 150ms color, Easing: ease-in-out)
- **Progress Bar Fill:** Width transition + shimmer overlay (Duration: 500ms per update, Easing: ease-out)
- **Page Transition:** Fade out current + fade in new (Duration: 150ms out, 200ms in, Easing: ease-in-out)
- **Drag and Drop:** Lift effect on drag start + drop zone highlight (Duration: 200ms lift, 150ms drop, Easing: ease-out)
- **Star Rating:** Fill animation + scale pulse (Duration: 300ms fill, 400ms pulse, Easing: ease-out/ease-in-out)
- **Data Refresh:** Rotate refresh icon + subtle fade (Duration: 600ms, Easing: ease-in-out)
- **Filter Chip:** Scale in on add, scale out + fade on remove (Duration: 200ms add, 150ms remove, Easing: ease-out/ease-in)

## 9.3 Animation Implementation

**CSS Transitions (Preferred):** Use for simple state changes (hover, focus, color changes). Only animate `transform` and `opacity` (GPU-accelerated).

**Framer Motion (Complex Animations):** Use for orchestrated multi-element animations, stagger children in lists, gesture-based animations (drag, swipe), page transitions.

**Performance Guidelines:** Only animate transform and opacity. Avoid animating width, height, top, left (causes reflow). Use `will-change` sparingly. Lazy load Framer Motion (code-split). Respect `prefers-reduced-motion` media query.
