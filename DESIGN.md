# DESIGN.md - Corretor Studio Supercombo v3

> Canonical design system for Lead Flow.
> This file is normative for visual decisions and token automation.

---

## 1. Visual DNA

Corretor Studio uses a Hybrid Warm-Precision direction:
- Warm conversion energy from Zapier (orange-led, human tone).
- Fintech precision from Stripe (hierarchy, polished spacing, chromatic depth).
- Dark surface discipline from Linear (luminance stacking, restrained contrast).
- Cinematic proof sections from Resend (high-contrast showcase moments).
- CTA confidence from Revolut (clear action hierarchy, strong button ergonomics).

Brand anchors:
- Primary brand color remains orange.
- Typography stack remains `Poppins + Inter`.
- Product trust and conversion clarity are mandatory in all templates.

---

## 2. Influence Matrix

| Axis | Base Influence | Supporting Influence | What We Keep | What We Avoid |
|------|----------------|----------------------|--------------|---------------|
| Color | Zapier | Stripe + Revolut | Warm orange core + precision accents | Uncontrolled multi-accent noise |
| Typography | Stripe | Linear + Revolut | Tight display tracking + readable UI text | Overuse of heavy headline weights |
| Surface | Linear | Resend + Stripe | Luminance ladder + subtle chromatic depth | Flat sections with no hierarchy |
| Motion | Linear | Stripe | Intentional stagger + short durations | Constant looping gimmicks |
| Layout | Zapier | Revolut + Linear | Bento asymmetry + strong CTA framing | Uniform repetitive card grids |
| Components | Zapier | Stripe + Resend | Border-first + premium shadows by context | Mixed radius language per component |

---

## 3. Design Contract

Mandatory:
- `DESIGN.md` is the single source of truth for token definitions.
- `app/globals.css` token regions are generated from this file.
- No manual edits inside managed token regions in `globals.css`.
- New UI work must use semantic tokens first, not hardcoded hex.

Token namespaces:
- `--surface-*` for depth layers.
- `--precision-*` for fintech-grade emphasis.
- `--semantic-*` for status and intent color pairs.
- `--motion-*` for timing/easing.

Compatibility:
- Existing core tokens remain supported (`--primary`, `--background`, etc.).
- Existing landing utility classes in `globals.css` must continue to resolve.

---

## 4. Typography System

Families:
- Headings: `Poppins`
- Body/UI: `Inter`
- Monospace snippets: `ui-monospace, SFMono-Regular, Menlo, Consolas`

Scale:
- Display XL: `72px`, `font-weight: 800`, `line-height: 0.98`, `letter-spacing: -0.03em`
- Display LG: `60px`, `font-weight: 800`, `line-height: 1.0`, `letter-spacing: -0.028em`
- Section: `48px`, `font-weight: 700`, `line-height: 1.05`, `letter-spacing: -0.024em`
- Sub-section: `36px`, `font-weight: 700`, `line-height: 1.1`, `letter-spacing: -0.02em`
- Card title: `24px`, `font-weight: 600`, `line-height: 1.3`
- Body: `16px`, `font-weight: 400`, `line-height: 1.6`
- UI action: `14px-16px`, `font-weight: 500-600`, `line-height: 1.4-1.5`

Rules:
- Gradient text is limited to highlighted words only.
- Headlines use tight tracking; body uses normal tracking.
- Avoid custom font additions unless approved by product branding.

---

## 5. Component Language

Buttons:
- `primary`: orange fill, high emphasis shadow, rounded-2xl.
- `secondary`: neutral/ghost with border emphasis.
- `ghost`: minimal action, no heavy elevation.
- `pill-cta`: conversion-focused pill allowed only in hero/pricing/checkout hotspots.
- `utility-chip`: compact contextual pills for filters/status.

Cards:
- `feature`: border + soft surface mix + subtle blur.
- `feature-featured`: adds chromatic border and stronger elevation.
- `stats`: simpler, center-focused number hierarchy.
- `technical-panel`: precision border/shadow for data and integrations.

Inputs and form controls:
- Default border-first appearance.
- Focus uses `--ring` plus semantic override when needed.
- Disabled state must lower contrast but remain readable.

Anti-patterns:
- Do not mix more than two accent families in one component.
- Do not use giant radius for every element.
- Do not place bright accents on large background fills.

---

## 6. Surface, Depth, and Motion

Surface ladder:
- `--surface-0`: page base.
- `--surface-1`: section tint.
- `--surface-2`: card default.
- `--surface-3`: elevated card/popover.
- `--surface-4`: floating/hero overlays.

Depth policy:
- Use border-only depth for dense data areas.
- Use Stripe-style chromatic shadow only for premium CTAs and highlighted cards.
- In dark sections, prefer luminance stepping over large drop shadows.

Motion policy:
- Fast interactions: `--motion-duration-fast`
- Standard transitions: `--motion-duration-base`
- Entry transitions: `--motion-duration-slow`
- Use `--motion-ease-standard` for state transitions.
- Use `--motion-ease-entrance` for reveal/enter.
- Scroll-triggered motion should run once per viewport entry.

---

## 7. Layout and Responsive Rules

Grid:
- Main sections: `max-w-7xl`, 12-column desktop split when needed.
- Feature bento: asymmetry (`col-span-2 + col-span-1`) preferred.
- Conversion blocks: clear left-right intent split at `lg`.

Spacing:
- Main sections: `py-20 md:py-28`.
- Internal card padding: `p-6`, `p-8`, `p-10`.
- Minimum gap between cards: `gap-4`.

Responsive:
- `sm` stack-to-inline CTA transition.
- `md` metrics and bento activation.
- `lg` full hero split and multi-panel workflows.
- Avoid layout jumps caused by oversized decoration layers.

---

## 8. Accessibility and Quality Gates

Mandatory:
- Minimum touch target: `44x44`.
- Visible focus state on all actionable controls.
- High contrast in both light and dark themes.
- Respect reduced motion preferences.

Engineering checks:
- No hardcoded hex in JSX/TSX for themable UI.
- No `window.alert`, `window.confirm`, `window.prompt`.
- New visual components should reuse shadcn primitives first.

---

## 9. Token Source (machine-readable)

The following blocks are parsed by `scripts/design/sync-tokens.ts`.

<!-- TOKENS:LIGHT:START -->
```json
{
  "--radius": "0.65rem",
  "--background": "oklch(1 0 0)",
  "--foreground": "oklch(0.141 0.005 285.823)",
  "--card": "oklch(1 0 0)",
  "--card-foreground": "oklch(0.141 0.005 285.823)",
  "--popover": "oklch(1 0 0)",
  "--popover-foreground": "oklch(0.141 0.005 285.823)",
  "--primary": "#ff6900",
  "--primary-foreground": "oklch(0.98 0.016 73.684)",
  "--secondary": "oklch(0.967 0.001 286.375)",
  "--secondary-foreground": "oklch(0.21 0.006 285.885)",
  "--muted": "oklch(0.967 0.001 286.375)",
  "--muted-foreground": "oklch(0.552 0.016 285.938)",
  "--accent": "oklch(0.967 0.001 286.375)",
  "--accent-foreground": "oklch(0.21 0.006 285.885)",
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--destructive-foreground": "#ffffff",
  "--border": "oklch(0.92 0.004 286.32)",
  "--input": "oklch(0.92 0.004 286.32)",
  "--ring": "oklch(0.705 0.213 47.604)",
  "--chart-1": "oklch(0.646 0.222 41.116)",
  "--chart-2": "oklch(0.6 0.118 184.704)",
  "--chart-3": "oklch(0.398 0.07 227.392)",
  "--chart-4": "oklch(0.828 0.189 84.429)",
  "--chart-5": "oklch(0.769 0.188 70.08)",
  "--brand-rose": "#e57082",
  "--brand-pink": "#cd6cdd",
  "--brand-purple": "#cd6cdd",
  "--surface-0": "oklch(1 0 0)",
  "--surface-1": "color-mix(in oklab, var(--card) 92%, var(--background))",
  "--surface-2": "color-mix(in oklab, var(--card) 85%, transparent)",
  "--surface-3": "color-mix(in oklab, var(--card) 78%, transparent)",
  "--surface-4": "color-mix(in oklab, var(--card) 70%, transparent)",
  "--precision-indigo": "#494fdf",
  "--precision-indigo-foreground": "#ffffff",
  "--precision-border-soft": "color-mix(in oklab, var(--border) 84%, #d6d9fc)",
  "--precision-border-strong": "color-mix(in oklab, var(--border) 55%, #b9b9f9)",
  "--precision-shadow-1": "0 8px 18px -12px rgba(50, 50, 93, 0.22)",
  "--precision-shadow-2": "0 20px 40px -22px rgba(50, 50, 93, 0.28), 0 12px 24px -16px rgba(0, 0, 0, 0.12)",
  "--precision-shadow-3": "0 30px 45px -30px rgba(50, 50, 93, 0.25), 0 18px 36px -18px rgba(0, 0, 0, 0.1)",
  "--frost-border": "rgba(214, 235, 253, 0.19)",
  "--semantic-success": "#00a87e",
  "--semantic-success-foreground": "#ffffff",
  "--semantic-success-surface": "color-mix(in oklab, var(--semantic-success) 16%, var(--card))",
  "--semantic-success-border": "color-mix(in oklab, var(--semantic-success) 38%, var(--border))",
  "--semantic-warning": "#ec7e00",
  "--semantic-warning-foreground": "#ffffff",
  "--semantic-warning-surface": "color-mix(in oklab, var(--semantic-warning) 14%, var(--card))",
  "--semantic-warning-border": "color-mix(in oklab, var(--semantic-warning) 34%, var(--border))",
  "--semantic-danger": "#e23b4a",
  "--semantic-danger-foreground": "#ffffff",
  "--semantic-danger-surface": "color-mix(in oklab, var(--semantic-danger) 14%, var(--card))",
  "--semantic-danger-border": "color-mix(in oklab, var(--semantic-danger) 36%, var(--border))",
  "--semantic-info": "#3b9eff",
  "--semantic-info-foreground": "#ffffff",
  "--semantic-info-surface": "color-mix(in oklab, var(--semantic-info) 15%, var(--card))",
  "--semantic-info-border": "color-mix(in oklab, var(--semantic-info) 36%, var(--border))",
  "--info": "var(--semantic-info)",
  "--success": "var(--semantic-success)",
  "--danger": "var(--semantic-danger)",
  "--warn": "var(--semantic-warning)",
  "--card-2": "oklch(0.274 0.006 286.033)",
  "--border-strong": "color-mix(in oklab, var(--border) 60%, #7170ff)",
  "--semantic-new": "#533afd",
  "--semantic-new-foreground": "#ffffff",
  "--semantic-new-surface": "color-mix(in oklab, var(--semantic-new) 14%, var(--card))",
  "--semantic-new-border": "color-mix(in oklab, var(--semantic-new) 34%, var(--border))",
  "--motion-duration-fast": "150ms",
  "--motion-duration-base": "220ms",
  "--motion-duration-slow": "320ms",
  "--motion-ease-standard": "cubic-bezier(0.2, 0, 0, 1)",
  "--motion-ease-entrance": "cubic-bezier(0.16, 1, 0.3, 1)",
  "--sidebar": "oklch(0.985 0 0)",
  "--sidebar-foreground": "oklch(0.141 0.005 285.823)",
  "--sidebar-primary": "oklch(0.705 0.213 47.604)",
  "--sidebar-primary-foreground": "oklch(0.98 0.016 73.684)",
  "--sidebar-accent": "oklch(0.967 0.001 286.375)",
  "--sidebar-accent-foreground": "oklch(0.21 0.006 285.885)",
  "--sidebar-border": "oklch(0.92 0.004 286.32)",
  "--sidebar-ring": "oklch(0.705 0.213 47.604)"
}
```
<!-- TOKENS:LIGHT:END -->

<!-- TOKENS:DARK:START -->
```json
{
  "--background": "oklch(0.141 0.005 285.823)",
  "--foreground": "oklch(0.985 0 0)",
  "--card": "oklch(0.21 0.006 285.885)",
  "--card-foreground": "oklch(0.985 0 0)",
  "--popover": "oklch(0.21 0.006 285.885)",
  "--popover-foreground": "oklch(0.985 0 0)",
  "--primary": "#f54900",
  "--primary-foreground": "oklch(0.98 0.016 73.684)",
  "--secondary": "oklch(0.274 0.006 286.033)",
  "--secondary-foreground": "oklch(0.985 0 0)",
  "--muted": "oklch(0.274 0.006 286.033)",
  "--muted-foreground": "oklch(0.705 0.015 286.067)",
  "--accent": "oklch(0.274 0.006 286.033)",
  "--accent-foreground": "oklch(0.985 0 0)",
  "--destructive": "oklch(0.704 0.191 22.216)",
  "--destructive-foreground": "#2d070b",
  "--border": "oklch(1 0 0 / 10%)",
  "--input": "oklch(1 0 0 / 15%)",
  "--ring": "oklch(0.705 0.213 47.604)",
  "--chart-1": "oklch(0.705 0.213 47.604)",
  "--chart-2": "oklch(0.696 0.17 162.48)",
  "--chart-3": "oklch(0.769 0.188 70.08)",
  "--chart-4": "oklch(0.627 0.265 303.9)",
  "--chart-5": "oklch(0.645 0.246 16.439)",
  "--brand-rose": "#e06070",
  "--brand-pink": "#b85ec8",
  "--brand-purple": "#b85ec8",
  "--surface-0": "oklch(0.141 0.005 285.823)",
  "--surface-1": "color-mix(in oklab, var(--card) 92%, var(--background))",
  "--surface-2": "color-mix(in oklab, var(--card) 86%, transparent)",
  "--surface-3": "color-mix(in oklab, var(--card) 80%, transparent)",
  "--surface-4": "color-mix(in oklab, var(--card) 72%, transparent)",
  "--precision-indigo": "#7170ff",
  "--precision-indigo-foreground": "#ffffff",
  "--precision-border-soft": "color-mix(in oklab, var(--border) 84%, #4c4da8)",
  "--precision-border-strong": "color-mix(in oklab, var(--border) 60%, #7170ff)",
  "--precision-shadow-1": "0 8px 18px -12px rgba(0, 0, 0, 0.45)",
  "--precision-shadow-2": "0 20px 40px -22px rgba(0, 0, 0, 0.52), 0 12px 24px -16px rgba(30, 30, 68, 0.45)",
  "--precision-shadow-3": "0 30px 45px -30px rgba(0, 0, 0, 0.6), 0 18px 36px -18px rgba(36, 36, 78, 0.44)",
  "--frost-border": "rgba(214, 235, 253, 0.19)",
  "--semantic-success": "#22c08a",
  "--semantic-success-foreground": "#052116",
  "--semantic-success-surface": "color-mix(in oklab, var(--semantic-success) 22%, var(--card))",
  "--semantic-success-border": "color-mix(in oklab, var(--semantic-success) 44%, var(--border))",
  "--semantic-warning": "#f2a236",
  "--semantic-warning-foreground": "#251603",
  "--semantic-warning-surface": "color-mix(in oklab, var(--semantic-warning) 22%, var(--card))",
  "--semantic-warning-border": "color-mix(in oklab, var(--semantic-warning) 44%, var(--border))",
  "--semantic-danger": "#f06572",
  "--semantic-danger-foreground": "#2d070b",
  "--semantic-danger-surface": "color-mix(in oklab, var(--semantic-danger) 22%, var(--card))",
  "--semantic-danger-border": "color-mix(in oklab, var(--semantic-danger) 44%, var(--border))",
  "--semantic-info": "#62b6ff",
  "--semantic-info-foreground": "#071b32",
  "--semantic-info-surface": "color-mix(in oklab, var(--semantic-info) 22%, var(--card))",
  "--semantic-info-border": "color-mix(in oklab, var(--semantic-info) 44%, var(--border))",
  "--info": "var(--semantic-info)",
  "--success": "var(--semantic-success)",
  "--danger": "var(--semantic-danger)",
  "--warn": "var(--semantic-warning)",
  "--card-2": "oklch(0.21 0.006 285.885)",
  "--border-strong": "color-mix(in oklab, var(--border) 55%, #b9b9f9)",
  "--semantic-new": "#7f7bff",
  "--semantic-new-foreground": "#0f0e34",
  "--semantic-new-surface": "color-mix(in oklab, var(--semantic-new) 22%, var(--card))",
  "--semantic-new-border": "color-mix(in oklab, var(--semantic-new) 44%, var(--border))",
  "--motion-duration-fast": "150ms",
  "--motion-duration-base": "220ms",
  "--motion-duration-slow": "320ms",
  "--motion-ease-standard": "cubic-bezier(0.2, 0, 0, 1)",
  "--motion-ease-entrance": "cubic-bezier(0.16, 1, 0.3, 1)",
  "--sidebar": "oklch(0.21 0.006 285.885)",
  "--sidebar-foreground": "oklch(0.985 0 0)",
  "--sidebar-primary": "oklch(0.646 0.222 41.116)",
  "--sidebar-primary-foreground": "oklch(0.98 0.016 73.684)",
  "--sidebar-accent": "oklch(0.274 0.006 286.033)",
  "--sidebar-accent-foreground": "oklch(0.985 0 0)",
  "--sidebar-border": "oklch(1 0 0 / 10%)",
  "--sidebar-ring": "oklch(0.646 0.222 41.116)"
}
```
<!-- TOKENS:DARK:END -->

<!-- TOKENS:THEME_INLINE_MAP:START -->
```json
{
  "--color-background": "var(--background)",
  "--color-foreground": "var(--foreground)",
  "--color-border": "var(--border)",
  "--color-input": "var(--input)",
  "--color-ring": "var(--ring)",
  "--color-primary": "var(--primary)",
  "--color-primary-foreground": "var(--primary-foreground)",
  "--color-secondary": "var(--secondary)",
  "--color-secondary-foreground": "var(--secondary-foreground)",
  "--color-muted": "var(--muted)",
  "--color-muted-foreground": "var(--muted-foreground)",
  "--color-accent": "var(--accent)",
  "--color-accent-foreground": "var(--accent-foreground)",
  "--color-destructive": "var(--destructive)",
  "--color-destructive-foreground": "var(--destructive-foreground)",
  "--color-popover": "var(--popover)",
  "--color-popover-foreground": "var(--popover-foreground)",
  "--color-card": "var(--card)",
  "--color-card-foreground": "var(--card-foreground)",
  "--color-surface-0": "var(--surface-0)",
  "--color-surface-1": "var(--surface-1)",
  "--color-surface-2": "var(--surface-2)",
  "--color-surface-3": "var(--surface-3)",
  "--color-surface-4": "var(--surface-4)",
  "--color-precision-indigo": "var(--precision-indigo)",
  "--color-precision-indigo-foreground": "var(--precision-indigo-foreground)",
  "--color-precision-border-soft": "var(--precision-border-soft)",
  "--color-precision-border-strong": "var(--precision-border-strong)",
  "--color-semantic-success": "var(--semantic-success)",
  "--color-semantic-success-foreground": "var(--semantic-success-foreground)",
  "--color-semantic-success-surface": "var(--semantic-success-surface)",
  "--color-semantic-success-border": "var(--semantic-success-border)",
  "--color-semantic-warning": "var(--semantic-warning)",
  "--color-semantic-warning-foreground": "var(--semantic-warning-foreground)",
  "--color-semantic-warning-surface": "var(--semantic-warning-surface)",
  "--color-semantic-warning-border": "var(--semantic-warning-border)",
  "--color-semantic-danger": "var(--semantic-danger)",
  "--color-semantic-danger-foreground": "var(--semantic-danger-foreground)",
  "--color-semantic-danger-surface": "var(--semantic-danger-surface)",
  "--color-semantic-danger-border": "var(--semantic-danger-border)",
  "--color-semantic-info": "var(--semantic-info)",
  "--color-semantic-info-foreground": "var(--semantic-info-foreground)",
  "--color-semantic-info-surface": "var(--semantic-info-surface)",
  "--color-semantic-info-border": "var(--semantic-info-border)",
  "--color-semantic-new": "var(--semantic-new)",
  "--color-semantic-new-foreground": "var(--semantic-new-foreground)",
  "--color-semantic-new-surface": "var(--semantic-new-surface)",
  "--color-semantic-new-border": "var(--semantic-new-border)",
  "--color-frost-border": "var(--frost-border)",
  "--radius-sm": "calc(var(--radius) - 4px)",
  "--radius-md": "calc(var(--radius) - 2px)",
  "--radius-lg": "var(--radius)",
  "--radius-xl": "calc(var(--radius) + 4px)",
  "--color-sidebar-ring": "var(--sidebar-ring)",
  "--color-sidebar-border": "var(--sidebar-border)",
  "--color-sidebar-accent-foreground": "var(--sidebar-accent-foreground)",
  "--color-sidebar-accent": "var(--sidebar-accent)",
  "--color-sidebar-primary-foreground": "var(--sidebar-primary-foreground)",
  "--color-sidebar-primary": "var(--sidebar-primary)",
  "--color-sidebar-foreground": "var(--sidebar-foreground)",
  "--color-sidebar": "var(--sidebar)",
  "--motion-duration-fast": "var(--motion-duration-fast)",
  "--motion-duration-base": "var(--motion-duration-base)",
  "--motion-duration-slow": "var(--motion-duration-slow)",
  "--motion-ease-standard": "var(--motion-ease-standard)",
  "--motion-ease-entrance": "var(--motion-ease-entrance)"
}
```
<!-- TOKENS:THEME_INLINE_MAP:END -->

<!-- TOKENS:SEMANTIC_EXTENSIONS:START -->
```json
{
  "buttonVariants": {
    "primary": {
      "background": "var(--primary)",
      "foreground": "var(--primary-foreground)",
      "border": "transparent"
    },
    "secondary": {
      "background": "var(--surface-2)",
      "foreground": "var(--foreground)",
      "border": "var(--border)"
    },
    "pillCta": {
      "background": "var(--primary)",
      "foreground": "var(--primary-foreground)",
      "border": "color-mix(in oklab, var(--primary) 35%, var(--border))"
    },
    "utilityChip": {
      "background": "var(--surface-1)",
      "foreground": "var(--muted-foreground)",
      "border": "var(--border)"
    }
  },
  "badgeVariants": {
    "_note": "Two valid patterns — never mix them. Tinted: surface bg + semantic color as text (auto-adapts, preferred). Solid: semantic color bg + foreground (high contrast, for critical status). Never use *-foreground as text on *-surface (dark *-foreground on dark *-surface in dark mode = invisible).",
    "new": {
      "background": "var(--semantic-new-surface)",
      "foreground": "var(--semantic-new)",
      "border": "var(--semantic-new-border)"
    },
    "success": {
      "background": "var(--semantic-success-surface)",
      "foreground": "var(--semantic-success)",
      "border": "var(--semantic-success-border)"
    },
    "warning": {
      "background": "var(--semantic-warning-surface)",
      "foreground": "var(--semantic-warning)",
      "border": "var(--semantic-warning-border)"
    },
    "danger": {
      "background": "var(--semantic-danger-surface)",
      "foreground": "var(--semantic-danger)",
      "border": "var(--semantic-danger-border)"
    },
    "info": {
      "background": "var(--semantic-info-surface)",
      "foreground": "var(--semantic-info)",
      "border": "var(--semantic-info-border)"
    }
  }
}
```
<!-- TOKENS:SEMANTIC_EXTENSIONS:END -->

<!-- TOKENS:MOTION:START -->
```json
{
  "durations": {
    "fast": "var(--motion-duration-fast)",
    "base": "var(--motion-duration-base)",
    "slow": "var(--motion-duration-slow)"
  },
  "easings": {
    "standard": "var(--motion-ease-standard)",
    "entrance": "var(--motion-ease-entrance)"
  },
  "defaults": {
    "hover": {
      "duration": "fast",
      "easing": "standard"
    },
    "stateTransition": {
      "duration": "base",
      "easing": "standard"
    },
    "sectionReveal": {
      "duration": "slow",
      "easing": "entrance",
      "staggerMs": 80
    }
  },
  "reducedMotionPolicy": {
    "disableTransformAnimations": true,
    "allowOpacity": true
  }
}
```
<!-- TOKENS:MOTION:END -->

---

## 10. Sync Workflow

Commands:
- `bun run design:sync` updates managed token blocks in `app/globals.css`.
- `bun run design:check` fails when `globals.css` is out of sync.

Managed CSS regions:
- `/* TOKENS:THEME_INLINE:START/END */`
- `/* TOKENS:ROOT:START/END */`
- `/* TOKENS:DARK:START/END */`

Do not edit generated regions manually.

---

## 11. Reference Consolidation

The following source guides were fully consolidated into this canonical design contract and can be removed from the repository after validation:
- `stripe/DESIGN.md`
- `linear.app/DESIGN.md`
- `resend/DESIGN.md`
- `revolut/DESIGN.md`
- `zapier/DESIGN.md`
