# 6. Branding & Style Guide

## 6.1 Visual Identity

**Brand Guidelines:** Supplex brand identity conveys **professionalism, reliability, and clarity** - essential qualities for supplier management in regulated industries.

**Design Philosophy:**

- **Professional yet approachable** - Not overly corporate, but trustworthy for quality managers
- **Data-forward** - Clean layouts that prioritize information density without clutter
- **Modern B2B SaaS** - Contemporary design language similar to Linear, Notion, Midday
- **Manufacturing-appropriate** - Subtle industrial touches (precise alignments, structured grids)

**Visual References:**

- Primary inspiration: [Midday UI](https://github.com/midday-ai/midday/tree/main/packages/ui) (financial SaaS aesthetic)
- Secondary: Linear (project management), Attio (CRM), Plane (issue tracking)

## 6.2 Color Palette

| Color Type        | Hex Code  | Tailwind Token | Usage                                                        |
| ----------------- | --------- | -------------- | ------------------------------------------------------------ |
| **Primary**       | `#2563EB` | `blue-600`     | Primary CTAs, active nav items, links, focus states          |
| **Primary Hover** | `#1D4ED8` | `blue-700`     | Hover state for primary buttons and interactive elements     |
| **Secondary**     | `#64748B` | `slate-500`    | Secondary buttons, muted text, icons                         |
| **Accent**        | `#8B5CF6` | `violet-500`   | Highlights, special features, premium indicators             |
| **Success**       | `#10B981` | `emerald-500`  | Positive feedback, approved status, success messages         |
| **Warning**       | `#F59E0B` | `amber-500`    | Cautions, conditional status, expiring certificates          |
| **Error**         | `#EF4444` | `red-500`      | Errors, critical issues, blocked status, destructive actions |
| **Info**          | `#3B82F6` | `blue-500`     | Informational messages, minor complaints, general notices    |
| **Neutral 50**    | `#F8FAFC` | `slate-50`     | Page background, card backgrounds (light mode)               |
| **Neutral 100**   | `#F1F5F9` | `slate-100`    | Hover backgrounds, alternate row backgrounds                 |
| **Neutral 200**   | `#E2E8F0` | `slate-200`    | Borders, dividers, inactive states                           |
| **Neutral 600**   | `#475569` | `slate-600`    | Body text, secondary content                                 |
| **Neutral 900**   | `#0F172A` | `slate-900`    | Headings, primary text, high-emphasis content                |

**Color System Notes:**

- **WCAG 2.1 AA Compliance:** All text colors meet 4.5:1 contrast ratio minimum against backgrounds
- **Status Color Mapping:** Approved/Active = Success (green), Conditional/Warning = Warning (amber), Blocked/Critical = Error (red), In Progress/Pending = Info (blue), Prospect/Draft = Secondary (slate)
- **Chart Colors:** Use color-blind safe palette (blue, orange, green, purple, teal) - avoid red/green only distinctions
- **Dark Mode (Phase 2):** Invert neutrals, reduce primary saturation by 10%, increase contrast ratios

## 6.3 Typography

### 6.3.1 Font Families

- **Primary:** `Inter` - Clean, highly legible sans-serif optimized for UI (Google Fonts)
- **Secondary:** `Inter` - Same as primary for consistency (Midday uses single font family)
- **Monospace:** `JetBrains Mono` - Code snippets, API keys, technical data (e.g., supplier IDs)

### 6.3.2 Type Scale

| Element        | Size            | Weight         | Line Height    | Tailwind Class           | Usage                                         |
| -------------- | --------------- | -------------- | -------------- | ------------------------ | --------------------------------------------- |
| **H1**         | 36px / 2.25rem  | SemiBold (600) | 40px / 2.5rem  | `text-4xl font-semibold` | Page titles, main headings                    |
| **H2**         | 30px / 1.875rem | SemiBold (600) | 36px / 2.25rem | `text-3xl font-semibold` | Section headings, modal titles                |
| **H3**         | 24px / 1.5rem   | SemiBold (600) | 32px / 2rem    | `text-2xl font-semibold` | Subsection headings, card titles              |
| **H4**         | 20px / 1.25rem  | SemiBold (600) | 28px / 1.75rem | `text-xl font-semibold`  | Component headings, sidebar nav               |
| **Body Large** | 18px / 1.125rem | Regular (400)  | 28px / 1.75rem | `text-lg`                | Intro paragraphs, important descriptions      |
| **Body**       | 16px / 1rem     | Regular (400)  | 24px / 1.5rem  | `text-base`              | Default body text, form labels, table content |
| **Body Small** | 14px / 0.875rem | Regular (400)  | 20px / 1.25rem | `text-sm`                | Helper text, secondary info, timestamps       |
| **Caption**    | 12px / 0.75rem  | Regular (400)  | 16px / 1rem    | `text-xs`                | Fine print, badges, metadata                  |

## 6.4 Iconography

**Icon Library:** [Lucide React](https://lucide.dev/) - Consistent, customizable icon set (same as Midday UI)

**Icon Specifications:**

- **Default Size:** 20px (1.25rem) for inline icons, 24px (1.5rem) for standalone
- **Stroke Width:** 2px for consistency
- **Color:** Inherit from parent text color for flexibility

**Common Icons:**

- **Navigation:** Home, Building2, CheckCircle2, BarChart3, AlertTriangle, Settings
- **Actions:** Plus, Edit3, Trash2, Download, Upload, Search, Filter, MoreHorizontal
- **Status:** Check, X, AlertCircle, Info, Clock, Star

**Usage Guidelines:** Use outlined icons (not filled). Pair icon with text label whenever possible. Icon-only buttons require `aria-label` and tooltip on hover. Status icons use semantic colors.

## 6.5 Spacing & Layout

**Grid System:** 12-column responsive grid with flexible gutters

**Container Widths:**

- **Mobile:** 100% width (with 16px padding)
- **Tablet:** 100% width (with 24px padding)
- **Desktop:** Max 1280px centered (with 32px padding)
- **Wide:** Max 1536px centered (for dashboards with charts)

**Spacing Scale:** Tailwind's default 4px base unit system

| Name    | Size | Tailwind   | Usage                                            |
| ------- | ---- | ---------- | ------------------------------------------------ |
| **xs**  | 4px  | `space-1`  | Tight spacing (badge padding, icon gaps)         |
| **sm**  | 8px  | `space-2`  | Small gaps (form field spacing, button icon gap) |
| **md**  | 16px | `space-4`  | Default spacing (card padding, section gaps)     |
| **lg**  | 24px | `space-6`  | Large gaps (between major sections)              |
| **xl**  | 32px | `space-8`  | Extra large (page margins, modal padding)        |
| **2xl** | 48px | `space-12` | Section separators, page header spacing          |

**Border Radius:** sm (4px) for badges, md (6px) for buttons/inputs, lg (8px) for cards, xl (12px) for feature cards, full (9999px) for avatars

**Shadows:** sm (subtle borders), md (elevated cards), lg (modals), xl (overlays)
