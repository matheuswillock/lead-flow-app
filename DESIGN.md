# DESIGN.md — Corretor Studio

> Design system document following the [Google Stitch DESIGN.md format](https://stitch.withgoogle.com/docs/design-md/overview/).
> Inspired by [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) — a curated collection of DESIGN.md files from top brands.
> Reference brands: **Zapier** (warm orange, CRM feel) + **Stripe** (precision, trust, premium weight-300 elegance).

---

## 1. Visual Theme & Atmosphere

**Mood:** Warm, professional, and energetic. A platform that feels powerful without being intimidating — made for Brazilian health insurance brokers who need to close deals fast.

**Design philosophy:**
- Orange energy with white-canvas clarity
- Medium content density — not cluttered, not sparse
- Every interaction should feel snappy and rewarding
- Trust-first: users handle leads and client data, so the UI must feel reliable

**Atmosphere keywords:** confident, organized, human, Brazilian, conversion-focused

**Inspired by:**
- **Zapier**: warm orange brand, friendly illustration-driven sections, approachable SaaS feel
- **Stripe**: weight-300 elegance for body text, purple-gradient precision (adapted to orange), section-by-section storytelling
- **Linear**: ultra-minimal cards, precise spacing, tight letter-spacing on headings

---

## 2. Color Palette & Roles

| Token | Light Mode | Dark Mode | Role |
|-------|-----------|-----------|------|
| `--primary` | `#ff6900` | `#f54900` | Brand orange — CTAs, active states, highlights, links |
| `--primary-foreground` | `#fff7f0` | `#fff7f0` | Text on primary backgrounds |
| `--background` | `#ffffff` | `#0d0d0e` | Page background |
| `--foreground` | `#111111` | `#f5f5f5` | Primary text |
| `--card` | `#ffffff` | `#18181b` | Card surfaces |
| `--card-foreground` | `#111111` | `#f5f5f5` | Text on cards |
| `--muted` | `#f4f4f5` | `#27272a` | Muted backgrounds, disabled states |
| `--muted-foreground` | `#71717a` | `#a1a1aa` | Secondary text, placeholders |
| `--border` | `#e4e4e7` | `#27272a` | Borders, dividers |
| `--ring` | `#ff6900` | `#f54900` | Focus rings |
| `--destructive` | `#ef4444` | `#f87171` | Errors, danger states |

### Extended Palette (non-semantic)

| Name | Hex | Use |
|------|-----|-----|
| Orange 50 | `#fff7ed` | Very light orange tint backgrounds |
| Orange 100 | `#ffedd5` | Light orange tint |
| Orange 500 | `#f97316` | Alternate orange (charts) |
| Teal 500 | `#14b8a6` | Chart accent 2 (--chart-2) |
| Amber 400 | `#fbbf24` | Chart accent 4 (--chart-4) |
| Zinc 900 | `#18181b` | Dark card base |

### Gradient Recipe

```css
/* Brand gradient — heading accent text */
background: linear-gradient(135deg, #ff6900 0%, #14b8a6 100%);
-webkit-background-clip: text;
background-clip: text;
color: transparent;

/* Primary CTA glow */
box-shadow: 0 12px 28px -8px rgba(255, 105, 0, 0.55);

/* Dot grid background */
background-image: radial-gradient(circle, rgba(228, 228, 231, 0.8) 1px, transparent 1px);
background-size: 28px 28px;
```

---

## 3. Typography Rules

### Font Families

| Context | Family | Weights | Source |
|---------|--------|---------|--------|
| Headings | **Poppins** | 600, 700, 800 | Google Fonts |
| Body (landing) | **Inter** | 400, 500, 600 | Google Fonts |
| Body (app) | **Poppins** | 400, 500, 600 | Google Fonts |

### Type Scale

| Token | Size | Line Height | Weight | Use |
|-------|------|------------|--------|-----|
| `text-xs` | 12px | 1.5 | 400 | Labels, badges, captions |
| `text-sm` | 14px | 1.5 | 400–500 | Nav links, secondary body |
| `text-base` | 16px | 1.6 | 400 | Body paragraphs |
| `text-lg` | 18px | 1.6 | 400–500 | Subheadings, card descriptions |
| `text-xl` | 20px | 1.5 | 500–600 | Section subtitles |
| `text-2xl` | 24px | 1.3 | 600 | Feature card titles |
| `text-3xl` | 30px | 1.2 | 700 | Section headings (mobile) |
| `text-4xl` | 36px | 1.1 | 700 | Section headings (tablet) |
| `text-5xl` | 48px | 1.05 | 700–800 | Section headings (desktop), stat numbers |
| `text-6xl` | 60px | 1.0 | 800 | Stat numbers, large displays |
| `text-7xl` | 72px | 0.95 | 800 | Hero H1 (desktop) |

### Heading Style Rules
- **Letter-spacing**: `tracking-tight` (`-0.025em`) for all headings h1–h4
- **Font weight**: 700 minimum for section headings, 800 for hero H1
- **Gradient text**: apply only to 1–3 words maximum, never entire sentences
- **Line height**: tight (`leading-[1.1]`) for large display text

### Body Style Rules
- **Line height**: `leading-relaxed` (1.625) for paragraphs
- **Max-width**: `max-w-2xl` for body text blocks, `max-w-xl` for captions
- **Color**: `text-muted-foreground` for secondary text, `text-foreground` for primary

---

## 4. Component Stylings

### Buttons

**Primary CTA:**
```
background: var(--primary)
color: var(--primary-foreground)
border-radius: 1rem (rounded-2xl)
padding: 0.875rem 1.5rem (py-3.5 px-6)
font-weight: 600 (font-semibold)
font-size: 1rem (text-base)
box-shadow: 0 12px 28px -8px rgba(255,105,0,0.55)
transition: transform 0.15s, box-shadow 0.15s
hover: scale(1.02), shadow-xl

States:
  default: bg-primary
  hover: scale-[1.02] + shadow-xl
  active: scale-[0.98]
  disabled: opacity-60 cursor-not-allowed
  loading: opacity-80 + spinner icon
```

**Secondary / Ghost:**
```
background: transparent
border: 1px solid var(--border)
color: var(--foreground)
border-radius: 1rem (rounded-2xl)
padding: 0.875rem 1.5rem (py-3.5 px-6)
font-weight: 600
hover: bg-muted/50

States:
  default: border border-border
  hover: bg-muted/50
  active: bg-muted
```

**Link button (inline):**
```
color: var(--primary)
font-weight: 600
font-size: 0.875rem (text-sm)
underline: none
hover: underline
icon: ArrowRight h-4 w-4 ml-1 group-hover:translate-x-0.5
```

### Cards

**Feature Card (large — col-span-2):**
```
background: color-mix(in oklab, var(--card) 85%, transparent)
border: 1px solid var(--border)
border-radius: 1rem (rounded-2xl)
padding: 2rem (p-8)
box-shadow: shadow-lg
backdrop-filter: blur(8px)
transition: transform 0.3s, shadow 0.3s, border-color 0.3s
hover: -translate-y-1, shadow-xl, border-color: primary/30
```

**Feature Card (small — col-span-1):**
```
Same as large, padding: 1.5rem (p-6)
No benefits list — icon + title + description only
```

**Stats Card:**
```
background: color-mix(in oklab, var(--card) 70%, transparent)
border: 1px solid var(--border)
border-radius: 0.75rem (rounded-xl)
padding: 1.5rem (p-6)
text-center
number: text-5xl font-extrabold text-primary
label: text-sm text-muted-foreground
```

**Testimonial Card (featured):**
```
background: color-mix(in oklab, var(--primary) 5%, var(--card))
border: 1px solid color-mix(in oklab, var(--primary) 25%, var(--border))
border-radius: 1.5rem (rounded-3xl)
padding: 2.5rem (p-10)
```

**Testimonial Card (secondary):**
```
Same as Feature Card large, with Quote icon top-right opacity-10
```

### Form Inputs
```
background: transparent
border: 1px solid var(--border)
border-radius: 1rem (rounded-2xl)
padding: 0.75rem 1rem (py-3 px-4)
font-size: 1rem (text-base)
color: var(--foreground)
placeholder: text-muted-foreground
focus: outline-none + ring-2 ring-[var(--ring)]
```

### Header / Navigation
```
background: color-mix(in oklab, var(--background) 80%, transparent)
backdrop-filter: blur(12px) (backdrop-blur-lg)
border-bottom: 1px solid var(--border)
height: 4rem (h-16)
position: sticky top-0 z-20

Logo: flex items-center gap-2 font-bold tracking-tight
Nav links: text-sm font-medium text-muted-foreground hover:text-foreground transition-colors
CTA button: primary button style (smaller: px-4 py-2)
```

### Announcement Badge
```
display: inline-flex items-center gap-2
border-radius: 9999px (rounded-full)
border: 1px solid color-mix(primary 30%, border)
background: color-mix(primary 8%, card)
padding: 0.375rem 0.875rem (py-1.5 px-3.5)
font-size: 0.875rem (text-sm)
font-weight: 500

Dot: h-1.5 w-1.5 rounded-full bg-primary animate-pulse
Label: text-primary font-semibold
Text: text-muted-foreground
Arrow: ArrowRight h-3.5 w-3.5 text-muted-foreground
```

### Icon Containers
```
Large (feature cards): h-14 w-14 rounded-xl bg-primary/15 text-primary
Medium (benefit lists): h-10 w-10 rounded-xl bg-primary/12 text-primary
Small (inline): h-8 w-8 rounded-lg bg-primary/12 text-primary
hover: scale-110 transition-transform
```

### Section Badges ("Novo", "Em breve")
```
position: absolute top-4 right-4
background: var(--primary)
color: var(--primary-foreground)
border-radius: 9999px (rounded-full)
padding: 0.125rem 0.625rem (py-0.5 px-2.5)
font-size: 0.75rem (text-xs)
font-weight: 700 (font-bold)
```

---

## 5. Layout Principles

### Container
```
max-width: 80rem (max-w-7xl) for content sections
max-width: 72rem (max-w-6xl) for demo/CTA sections
horizontal-padding: px-6 sm:px-8 lg:px-10
```

### Section Spacing
```
Standard sections: py-20 md:py-28
Compact sections (LogoBar, dividers): py-8
Hero section: min-h-[calc(100dvh-4rem)]
```

### Grid System

**Hero (desktop):** `lg:grid lg:grid-cols-12 lg:gap-12` — text: col-span-7, visual: col-span-5

**Features Bento (tablet+):** `md:grid-cols-3` with:
```
Row 1: [col-span-2 large] [col-span-1 small]
Row 2: [col-span-1 small] [col-span-2 large]
Row 3: [col-span-1] [col-span-1] [col-span-1]
```

**How It Works (desktop):** `lg:grid-cols-5` — equal columns, horizontal timeline

**Testimonials stats:** `grid grid-cols-2 md:grid-cols-4`

**Split layout (Demo section):** `lg:grid lg:grid-cols-2 lg:gap-14`

**Footer:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4` — brand col-span-2

### Spacing Scale
```
Component internal padding:  p-6 (small cards), p-8 (large cards), p-10 (forms)
Section gap between items:   gap-4 lg:gap-5 (bento), gap-6 (testimonials)
Between sections:            mt-12, mt-16 (between major elements)
Between text blocks:         mt-4 (p to p), mt-6 (h to p), mt-8 (CTAs)
```

### Whitespace Philosophy
- Every section breathes — never less than `py-20` for main sections
- Cards never touch each other — minimum `gap-4`
- Text blocks have a max-width (`max-w-2xl`) to preserve readability
- Background decorations are always `opacity-20` or less

---

## 6. Depth & Elevation

### Shadow System
```
Level 0 (flat):       no shadow              → inline elements, nav links
Level 1 (subtle):     shadow-sm              → stat cards, badges
Level 2 (standard):   shadow-lg              → feature cards, form inputs
Level 3 (elevated):   shadow-2xl             → forms, modals, featured testimonials
Level 4 (floating):   shadow-2xl + primary glow → hero product image, CTA buttons
```

### Glow Effects
```
Primary CTA glow:
  box-shadow: 0 12px 28px -8px rgba(255, 105, 0, 0.55)

Product image glow:
  box-shadow: 0 32px 64px -16px rgba(255, 105, 0, 0.2), 0 32px 64px -16px rgba(0,0,0,0.3)

Card hover glow:
  border-color: color-mix(in oklab, var(--primary) 30%, transparent)
  box-shadow: shadow-xl
```

### Surface Hierarchy
```
Page background      → --background (lowest)
Section backgrounds  → slightly tinted with muted/gradients
Cards               → --card (mid)
Floating elements   → --card + backdrop-blur + border (highest)
Overlays            → bg-background/80 backdrop-blur-lg
```

### Background Decoration Pattern
```
Dot grid (hero):
  background-image: radial-gradient(circle, rgba(border) 1px, transparent 1px)
  background-size: 28px 28px
  opacity: 0.4

Gradient orbs (section accents):
  position: absolute, pointer-events-none, z-0
  opacity: 0.20–0.25
  radial-gradient at corners/edges
  color: primary or chart-1..5 colors
  always paired with bottom/top fade overlay
```

---

## 7. Do's and Don'ts

### ✅ DO

- Use `var(--primary)` (#ff6900) exclusively for primary CTAs, active states, and 1–3 gradient words in headings
- Use `rounded-2xl` for all interactive elements (buttons, inputs, cards)
- Apply `backdrop-blur-lg` to sticky headers and floating elements
- Use `framer-motion` for all scroll-triggered animations with `viewport: { once: true }` and stagger delays
- Use bento grid asymmetry (col-span-2 + col-span-1) for feature sections to avoid monotony
- Keep section headings at `text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight`
- Add `transition-all duration-300` to all interactive cards
- Include trust signals near every CTA (badges, "sem cartão", LGPD, etc.)
- Use `text-muted-foreground` for subtitles — never `text-gray-400` hardcoded
- Maintain the `.landing-page` CSS class for font scoping (Inter for landing, Poppins for app)

### ❌ DON'T

- Don't use orange as a large background fill — only for buttons, icons, accent text, and thin badges
- Don't use more than 2 color variables in a single component's color scheme
- Don't create flat, shadowless cards with no depth
- Don't hardcode hex colors in JSX — always use CSS variables
- Don't use `window.alert`, `window.confirm`, or `window.prompt`
- Don't add `bg-gray-*` classes — use `bg-muted` or `bg-background` tokens
- Don't make section headings full-gradient — limit gradient text to the highlighted phrase only
- Don't animate the same element on every render — use `viewport: { once: true }`
- Don't create empty optional feature folders (follow CLAUDE.md governance rules)
- Don't mix border-radius styles — stick to `rounded-2xl` for cards, `rounded-xl` for icons, `rounded-full` for pills/badges

---

## 8. Responsive Behavior

### Breakpoints
```
sm:  640px  — side-by-side CTAs, show full brand name in header
md:  768px  — 2-col grids, 4-col stats, feature bento activates
lg:  1024px — hero 12-col split, 5-col timeline, split form layout
xl:  1280px — max-width containers centered, larger hero font
2xl: 1536px — no layout change (max-widths handle it)
```

### Touch Targets
- Minimum: 44×44px for all interactive elements
- Buttons: min `py-3 px-5` (48px height)
- Nav links: `py-2 px-3` when in mobile menu

### Collapsing Strategy

| Component | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| Hero | Stacked, text center, no image | Stacked, text center | 12-col split, image right |
| Features | 1-col stack | bento 3-col grid | bento 3-col grid |
| How It Works | Vertical numbered list | Vertical | 5-col horizontal timeline |
| Split Form | Stacked (benefits above form) | Stacked | 2-col side-by-side |
| Footer | 1-col stack | 2-col | 4-col grid |
| Header | Logo + CTA button only | Full nav hidden, logo + CTA | Full nav + 2 CTAs |

### Mobile-Specific Rules
- Hero text: `text-center` on mobile, `text-left` on `lg:`
- CTA buttons: `w-full` on mobile, `w-auto` on `sm:`
- Product image: `hidden` on mobile, `lg:flex` for product visual
- Floating stat badges: hidden on mobile
- How It Works connector line: hidden on mobile, shown `lg:block`

---

## 9. Agent Prompt Guide

### Quick Color Reference
```
Primary orange:    var(--primary)      → #ff6900 (light) / #f54900 (dark)
Text primary:      var(--foreground)   → #111111 (light) / #f5f5f5 (dark)
Text secondary:    var(--muted-foreground)
Card surface:      var(--card)
Border:            var(--border)
Background:        var(--background)
Chart accent 2:    var(--chart-2)      → teal (#14b8a6 light)
Chart accent 4:    var(--chart-4)      → amber (#fbbf24 light)
```

### Reusable Patterns

**Section wrapper:**
```tsx
<section id="[anchor]" className="relative py-20 md:py-28">
  {/* Gradient decoration */}
  <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20"
    style={{ background: "radial-gradient(...)" }} />
  <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
    {/* Section heading */}
    {/* Content */}
  </div>
</section>
```

**Section heading block:**
```tsx
<div className="text-center mb-16">
  <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
    Regular text{" "}
    <span style={{ background: "linear-gradient(135deg, var(--primary), var(--chart-2))",
      WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
      gradient words
    </span>
  </h2>
  <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
    Subtitle text here.
  </p>
</div>
```

**Primary CTA button:**
```tsx
<Link href="#demo"
  className="group inline-flex items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold transition-all hover:scale-[1.02]"
  style={{ background: "var(--primary)", color: "var(--primary-foreground)",
    boxShadow: "0 12px 28px -8px color-mix(in oklab, var(--primary) 60%, transparent)" }}>
  Label text
  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
</Link>
```

**Feature card (large):**
```tsx
<MotionDiv initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }} transition={{ duration: 0.5 }}
  className="group relative md:col-span-2 rounded-2xl border p-8 shadow-lg backdrop-blur
             transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30"
  style={{ borderColor: "var(--border)",
    background: "color-mix(in oklab, var(--card) 85%, transparent)" }}>
  {/* icon container, title, description, benefits list */}
</MotionDiv>
```

**Icon container:**
```tsx
<div className="inline-flex h-14 w-14 items-center justify-center rounded-xl mb-5
                transition-transform group-hover:scale-110"
  style={{ background: "color-mix(in oklab, var(--primary) 15%, transparent)",
    color: "var(--primary)" }}>
  <Icon className="h-7 w-7" />
</div>
```

**Dot grid background (hero):**
```tsx
<div aria-hidden className="pointer-events-none absolute inset-0 opacity-40"
  style={{ backgroundImage: "radial-gradient(circle, color-mix(in oklab, var(--border) 80%, transparent) 1px, transparent 1px)",
    backgroundSize: "28px 28px" }} />
```

**Trust line:**
```tsx
<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
  {["Sem cartão de crédito", "Suporte em PT-BR", "Cancele quando quiser"].map(t => (
    <span key={t} className="flex items-center gap-1.5">
      <CheckCircle2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
      {t}
    </span>
  ))}
</div>
```

### AI Agent Instructions

When building any new page or component for Corretor Studio:

1. **Start with this DESIGN.md** — check colors, typography, and component patterns before writing any JSX
2. **Use CSS variables** (`var(--primary)`, `var(--border)`, etc.) — never hardcode hex values
3. **Apply Framer Motion** with `whileInView`, `viewport: { once: true }`, and stagger delays of `0.08–0.1s`
4. **Follow bento grid** for feature sections — asymmetric is better than uniform
5. **Add trust signals** on every conversion point (form, CTA section)
6. **Respect `.landing-page` class scoping** — landing pages use Inter body font
7. **Check governance** before creating new files — run `bun run governance:check`
8. **Never use window.alert** — use `sonner` toast or shadcn AlertDialog instead

---

*Generated following the [DESIGN.md format](https://stitch.withgoogle.com/docs/design-md/format/) from [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) — the curated collection of design systems for AI agents.*
