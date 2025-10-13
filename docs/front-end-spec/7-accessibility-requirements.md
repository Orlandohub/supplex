# 7. Accessibility Requirements

## 7.1 Compliance Target

**Standard:** **WCAG 2.1 Level AA** compliance across all user-facing features

**Rationale:** WCAG 2.1 AA is the industry standard for B2B SaaS and often a contractual requirement. Level AAA is too restrictive for data-heavy business applications. ISO 9001 and other quality certifications increasingly include digital accessibility requirements.

**Audit Schedule:** Pre-launch automated testing with axe DevTools and Lighthouse (target score 90+), MVP launch manual testing with screen readers (NVDA, JAWS, VoiceOver), Post-launch third-party accessibility audit (Month 6), Ongoing quarterly accessibility reviews.

## 7.2 Key Requirements

### Visual

**Color contrast ratios:** Normal text (16px+) minimum 4.5:1, Large text (24px+) minimum 3:1, UI components minimum 3:1 for borders/icons. Status indicators never rely on color alone - always pair with icons or text labels.

**Focus indicators:** All interactive elements have clear focus outline (2px blue ring with 2px offset). Logical tab order following visual layout. "Skip to main content" link visible on Tab. Modals trap focus until dismissed. No keyboard traps.

**Text sizing:** Minimum 12px for captions, 16px default for body. All font sizes in rem (not px). Interface remains functional at 200% zoom level. Text spacing adjustable without breaking layout.

### Interaction

**Keyboard navigation:** All functionality accessible via keyboard alone. Standard shortcuts: Tab/Shift+Tab (navigate), Enter/Space (activate), Esc (close), Arrow keys (menus/lists). Custom shortcuts documented (Cmd+K search, Alt+A approve). Clear visible focus at all times.

**Screen reader support:** Semantic HTML5 elements (nav, main, article, aside). ARIA labels on all interactive elements. Correct ARIA roles for custom components. Dynamic content updates announced via aria-live. Form labels associated with inputs. Error announcements immediate. Status messages announced.

**Touch targets:** Minimum 44x44px touch targets for all interactive elements. Minimum 8px spacing between adjacent targets. Larger targets on mobile (56px for primary actions). No gesture-only interactions.

### Content

**Alternative text:** All images have descriptive alt text (decorative images use alt=""). Icon-only buttons include aria-label. Charts include text summaries and data tables for screen reader users.

**Heading structure:** Logical hierarchy (H1 → H2 → H3, never skip). Single H1 per page. Descriptive headings. Proper ARIA landmarks (banner, navigation, main, contentinfo).

**Form labels:** Visible text labels (not just placeholders). Required fields marked with \* + aria-required="true". Specific, actionable error messages linked via aria-describedby. Related fields grouped with fieldset/legend. Appropriate autocomplete attributes.

## 7.3 Testing Strategy

**Automated Testing:** axe DevTools on every page, Lighthouse accessibility score 90+ required, Pa11y CI in pipeline, eslint-plugin-jsx-a11y for React issues.

**Manual Testing:** Full keyboard navigation testing, Screen reader testing (NVDA on Windows, VoiceOver on Mac/iOS), Color contrast manual review, 200% zoom testing, Focus management verification.

**User Testing (Phase 2):** Recruit 2-3 users with disabilities for usability testing. Provide accessibility feedback email in footer. Log accessibility issues as high-priority bugs.

**Testing Checklist:** All interactive elements keyboard accessible, Focus indicators visible with logical order, Screen reader announces correctly, Color contrast meets AA (4.5:1), Forms have visible labels and errors, No keyboard traps, Touch targets 44x44px minimum, Headings properly structured, ARIA labels on icon buttons, Live regions announce updates, Works at 200% zoom, axe DevTools zero violations.
