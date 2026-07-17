# PhysioK29 — Design Language Documentation

## Layout Principles

- **Single-page application** running inside a `.main-area` container
- **Left sidebar** (`#sidebar`) for navigation — fixed on desktop, slide-out on mobile
- **Right sidebar** (`.right-sidebar`) for study tools — hidden on mobile
- **Content area** uses `display: flex; flex-direction: column; gap: 24px`
- **Control rows** (`.control-row`) above content for search, filters, action buttons
- **Card-based content** — each section is an `<article>` with consistent card styling
- **Full-screen overlays** for auth, modals, and onboarding

## Color Palette

### Primary Colors
```
--ink: #171b1f          (text, dark backgrounds)
--bg: #f8f6ef           (page background — warm off-white)
--panel: #fffdf8        (card/panel background)
--line: #e3ddd0         (borders, dividers)
--muted: #67706c        (secondary text, labels)
```

### Accent Colors
```
--mint: #2a9d7f         (primary action — buttons, links, active states)
--mint-dark: #16735c    (hover/dark variant)
--mint-soft: rgba(42,157,127,0.13)  (subtle backgrounds, badges)
--clay: #d96f4d         (secondary accent — warnings, highlights)
--citron: #d8c74d       (tertiary accent)
--plum: #5c3f7d         (quaternary accent — streaks, special badges)
--sky: #5fa8d3          (info accent)
```

### Semantic Colors
```
--danger: #c3423f       (error states, delete buttons)
--danger-soft: rgba(195,66,63,0.1)  (error backgrounds)
--success: #2a9d7f      (success states)
--warning: #d96f4d      (warning states)
```

### Surface Colors
```
--surface-alt: #f0ece2  (alternate card background)
--surface-accent: rgba(42,157,127,0.07)  (highlighted rows)
--surface-hover: rgba(0,0,0,0.03)  (hover states)
```

## Typography

### Font Family
```css
--body-font: "Instrument Sans", Aptos, "Segoe UI Variable Text", "Helvetica Neue", ui-sans-serif, system-ui, sans-serif;
--display-font: "Fraunces", "Instrument Sans", "Aptos Display", "Segoe UI Variable Display", serif;
```

### Font Sizes
| Token | Value | Usage |
|-------|-------|-------|
| `--text-xs` | 0.75rem (12px) | Metadata, timestamps, small badges |
| `--text-sm` | 0.875rem (14px) | Body text, descriptions |
| `--text-base` | 1rem (16px) | Default body |
| `--text-lg` | 1.125rem (18px) | Section headings |
| `--text-xl` | 1.25rem (20px) | Card titles |
| `--text-2xl` | 1.5rem (24px) | Page titles, modal headings |
| `--text-3xl` | 2rem (32px) | Hero headings |
| `--text-4xl` | 2.5rem (40px) | Welcome greeting |

### Font Weights
| Weight | Usage |
|--------|-------|
| 400 | Body text, descriptions |
| 500 | Medium emphasis |
| 600 | Strong emphasis, card headings |
| 700 | Button labels, important stats |

### Line Height
- Body: `1.5`
- Headings: `1.2`
- Small text: `1.4`

## Spacing Scale
```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
```

## Border Radius
```
--radius-sm: 6px
--radius-md: 10px
--radius-lg: 16px
--radius-xl: 24px
--radius-full: 9999px
```

## Shadows
```
--shadow: 0 18px 50px rgba(31, 34, 30, 0.11)        (modals, elevated cards)
--soft-shadow: 0 10px 28px rgba(31, 34, 30, 0.08)    (cards, dropdowns)
--shadow-sm: 0 2px 8px rgba(31, 34, 30, 0.06)        (subtle elevation)
```

## Component Styles

### Cards
```css
background: var(--panel);
border: 1px solid var(--line);
border-radius: var(--radius-lg);
padding: 20px;
box-shadow: var(--soft-shadow);
```

### Buttons

**Primary Action** (`.primary-action`):
```css
background: var(--mint);
color: white;
border-radius: 40px;
padding: 10px 24px;
font-weight: 600;
font-size: 15px;
border: none;
cursor: pointer;
transition: background 0.2s;
```
Hover: `background: var(--mint-dark)`

**Secondary Action** (`.secondary-action`):
```css
background: transparent;
color: var(--ink);
border: 1.5px solid var(--line);
border-radius: 40px;
padding: 8px 18px;
font-weight: 500;
font-size: 14px;
cursor: pointer;
transition: all 0.2s;
```
Hover: `border-color: var(--mint); color: var(--mint);`

**Ghost Action** (`.ghost-action`):
```css
background: transparent;
color: var(--mint);
border: none;
padding: 6px 12px;
font-weight: 500;
font-size: 14px;
cursor: pointer;
```
Hover: `text-decoration: underline`

**Danger Action** (`.danger-link`):
```css
color: var(--danger);
font-size: 13px;
font-weight: 500;
```
Hover: `text-decoration: underline`

**Icon Button** (`.icon-button`):
```css
width: 36px;
height: 36px;
border-radius: 50%;
display: flex;
align-items: center;
justify-content: center;
border: none;
background: transparent;
cursor: pointer;
```
Hover: `background: var(--surface-hover)`

### Forms
```css
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
}

input, select, textarea {
  padding: 10px 14px;
  border: 1.5px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 15px;
  background: var(--panel);
  color: var(--ink);
  transition: border-color 0.2s;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--mint);
  box-shadow: 0 0 0 3px var(--mint-soft);
}
```

### Modals
```css
.edit-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.edit-card {
  background: var(--panel);
  border-radius: var(--radius-xl);
  max-width: 540px;
  width: 100%;
  padding: 28px;
  box-shadow: var(--shadow);
}
```

### Tables
```css
table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}

td {
  padding: 10px 12px;
  font-size: 14px;
  border-bottom: 1px solid var(--line);
}
```

### Toast Notifications
```css
.portal-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: white;
  padding: 12px 24px;
  border-radius: 40px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: var(--shadow);
  z-index: 2000;
  opacity: 0;
  transition: opacity 0.3s;
}

.portal-toast.show {
  opacity: 1;
}
```

### Loading States
```css
.portal-boot-loader {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
```

### Empty States
Centered text with muted color, often with an icon:
```css
color: var(--muted);
text-align: center;
padding: 40px;
```

## Interaction States

| State | Behavior |
|-------|----------|
| Hover | Slight darken/lighten, border color shift, underline for links |
| Focus | Ring with `var(--mint-soft)`, border becomes `var(--mint)` |
| Active | Quick scale transform on buttons (press effect) |
| Disabled | `opacity: 0.5; cursor: not-allowed` |
| Loading | Spinner replaces text, button disabled |

## Responsive Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Desktop | >1024px | Full layout with both sidebars |
| Tablet | 768–1024px | Single sidebar, responsive grid |
| Mobile | <768px | Stacked layout, slide-out nav, full-width cards |

## Animation Timing
- Default transition: `0.2s ease`
- Modal enter: `0.3s ease`
- Toast: `0.3s opacity, 4.2s display`
- Loader: Continuous rotation

## Icon Usage
- Uses **Material Symbols** (Google) — `material-symbols-rounded` class
- Icon size: Typically `20px` or `24px`
- Always include `aria-hidden="true"` on decorative icons
- Icons accompany action text, never standalone (except icon buttons)

## Accessibility Considerations
- Semantic HTML (`<nav>`, `<main>`, `<article>`, `<section>`, `<header>`, `<footer>`)
- `aria-live="polite"` on dynamic content regions
- `aria-label` on icon-only buttons
- `role="alert"` on error messages
- Focus trapping inside modals
- `prefers-reduced-motion` respected in animations
- Color contrast: All text meets WCAG AA minimum
- Form inputs have associated `<label>` elements
- Error states announced via `aria-describedby`
