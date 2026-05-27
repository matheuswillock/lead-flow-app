# Corretor Studio — Design System

> **Codename:** Supercombo v3 · **Visual direction:** Hybrid Warm-Precision
> Orange-led conversion energy (Zapier) × fintech precision (Stripe) × dark surface discipline (Linear)

---

## What is Corretor Studio?

**Corretor Studio** is a B2B SaaS CRM built for **brokers of Brazilian health insurance plans** (corretores de planos de saúde). It centralizes the entire commercial pipeline — capturing leads, organizing them on a Kanban board, coordinating teams of SDRs/Closers/Managers, scheduling meetings, and processing subscription payments. The product positions itself against the alternative most brokers use today: WhatsApp threads and spreadsheets.

Tagline from the live site:
> *"Corretores comuns mandam cotações. Os de **ALTA PERFORMANCE** usam Corretor Studio."*

### Surfaces
The codebase ships **one product** with two distinct surfaces, both styled from the same token system:

| Surface | Audience | Style |
|---|---|---|
| **Marketing site** (`/`) | Logged-out brokers, demo signups | Bold, warm, conversion-led. Bento grids, gradient headlines, soft glow orbs, Inter body + Poppins display. |
| **App / CRM** (`/<workspaceId>/…`) | Logged-in brokers + their teams | Dense, fintech-precision. Sidebar nav, Kanban board, dashboards, calendar, simulator. Defaults to Poppins for chrome, restrained color, surface ladder. |

Inside the app the main routes are `dashboard`, `crm`, `board` (the Kanban), `calendar`, `performance`, `pme-simulador`, `carteira` (wallet), `email` (templates / contatos / campanhas / histórico / analytics — most marked "Em breve"), `manager-users`, `teams`, `integrations`.

---

## Sources

This system was extracted from materials the user provided:

- **Codebase (read-only):** `lead-flow-app/` (Next.js 15 + React 19, Tailwind CSS 4, shadcn/ui on Radix, Prisma + Supabase, Lucide React icons). Repo origin in the codebase README: `https://github.com/matheuswillock/lead-flow-app`.
- **Canonical design contract:** `lead-flow-app/DESIGN.md` → copied to `reference/DESIGN.md`. The doc is normative: token JSON blocks are machine-parsed by `bun run design:sync` into `app/globals.css`.
- **Global tokens & utility classes:** `lead-flow-app/app/globals.css` → `reference/globals.css`.
- **Brand asset:** `uploads/corretor-studio-icon.svg` (broken — the SVG referenced an image that didn't embed). Substituted with the working version found in the codebase at `lead-flow-app/public/corretor-studio-icon.svg`.

The reader is not assumed to have access to any of these — everything needed is now in this project.

---

## Index — what's in this folder

```
README.md                ← you are here
SKILL.md                 ← Agent Skill manifest (cross-compatible with Claude Code)
colors_and_type.css      ← all tokens + the .cs-* type scale, ready to drop in

assets/                  ← brand visuals
  corretor-studio-icon.svg          (the gradient C/S monogram, light + dark safe)
  corretor-studio-share-v1.png      (1080×1080 social share, monogram on gradient)
  product-banner.svg                (hero "pipeline" product visual from the landing page)
  asaas-pagamentos-logo.svg         (payment integration partner, used in checkout flows)

reference/               ← the originals, preserved verbatim for reference
  DESIGN.md                         (Supercombo v3 contract from the codebase)
  globals.css                       (full @theme inline + utility layer from the app)

preview/                 ← Design System tab cards (12+ swatches & specimens)

ui_kits/
  app/                              ← CRM surface: sidebar + Kanban board + dashboard + landing
    README.md
    index.html                      (interactive click-thru — Kanban → Dashboard → Landing)
    *.jsx                           (modular components)
```

---

## Content Fundamentals

**Language.** Portuguese-Brazil exclusively (`pt-BR`). All product copy, error messages, sidebar labels and emails are in Portuguese. Even the codebase variable names lean Portuguese in the domain layer (`corretor`, `closer`, `cadencia`, `carteira`, `apólice`).

**Tone.** Direct, confident, sales-led. The brand sells *performance* — copy frames the broker as either commodity ("corretor comum") or elite ("alta performance"). Aspirational without being precious. Stripe-clarity meets sales-floor swagger. The product itself talks to the broker as a peer, not a guru.

**Pronouns.** Almost always **`você`** (you, singular). The product is "Corretor Studio" or "seu time"; the user's customer is "o lead" or "o cliente". First-person plural ("nós") only appears in legal/footer copy.

**Casing.**
- **Headings:** Sentence case in long copy, **ALL-CAPS** only for the single dramatic word in a gradient headline (e.g. `ALTA PERFORMANCE`). Never Title Case.
- **Buttons / CTAs:** Sentence case, action verb first ("Agendar demonstração", "Ver como funciona", "Entrar"). Never end with punctuation.
- **Sidebar / nav:** Sentence case, no articles ("Dashboard", "Calendario", "Campanhas").
- **Status badges:** Lowercase + sentence-case mix per status ("Em breve", "Beta", "Online", "Ausente").

**Accents.** The codebase is **inconsistent** about Portuguese accents — half the copy uses `Calendario`, `Funcoes`, `Funcionalidades`; half uses `Calendário`, `Funções`, `Funcionalidades`. When writing new copy: **prefer correctly-accented Portuguese** (`Calendário`, `Histórico`, `Implementação`). The unaccented spellings are legacy debt from ASCII-safe filenames and DB seeds — don't propagate them into UI.

**Emoji.** Effectively never. The codebase has zero decorative emoji in production strings. Status is communicated through Lucide icons + colored dots, not faces. **Don't add emoji.**

**Numbers.** Always tabular (`.num` utility / `font-variant-numeric: tabular-nums`). Currency is `R$` with comma decimal (`R$ 59,90`). Dates default to `dd/MM/yyyy HH:mm` in the broker's timezone.

**Vibe.** Imagine a Stripe pricing page that sells to a São Paulo sales-floor: precise, premium, but not corporate-cold. The orange does the warmth; the typography does the polish.

### Voice examples (real strings from the product)

| Surface | String |
|---|---|
| Hero | `Corretores comuns mandam cotações. Os de ALTA PERFORMANCE usam Corretor Studio.` |
| Hero sub | `Enquanto outros perdem leads no WhatsApp e em planilhas, seu time opera com pipeline, agenda e indicadores tudo em um só lugar.` |
| Feature title | `Tudo que você precisa para vender mais` |
| Feature card | `Pipeline Kanban + Tabela` / `Arraste e solte por etapa` / `Status e responsáveis sempre visíveis` |
| Coming-soon badge | `Em breve` |
| CTA primary | `Agendar demonstração` |
| CTA secondary | `Ver como funciona` |
| Sidebar group label | `Navegação` / `Email` / `Integrações` / `Time` |
| Toast success | `Solicitação enviada! Em breve entraremos em contato.` |
| Toast error | `Erro ao enviar. Tente novamente.` |
| Demo form trust line | `Resposta em até 24 horas · Sem compromisso · Demonstração gratuita` |

Use middle dots (`·`) — not pipes, not dashes — as inline separators in trust lines.

---

## Visual Foundations

### Color — what makes it Corretor Studio
The system is built on **one hot anchor color and a luminance ladder**, not a palette. The accent that defines the brand is **orange `#ff6900`** (light) / **`#f54900`** (dark — slightly deeper red-orange to stay legible on dark surfaces). Every CTA, every active sidebar item, every focus ring, every "is something happening" signal is this orange.

The brand-signature **gradient `orange → rose #e57082 → magenta #cd6cdd`** is reserved for *exactly two uses*: (1) the logo / monogram tile (always rendered on the gradient), (2) one or two hand-picked words inside a headline ("ALTA PERFORMANCE", "vender mais"). Never gradient buttons, never gradient backgrounds for entire sections. The discipline is the whole point.

Everything else is **OKLch neutrals + status pairs**:

- Surface ladder (`--surface-0` … `--surface-4`) for depth without shadows
- Status pairs `success / warning / danger / info / new` with `-surface` and `-border` variants for tinted badges
- A precision indigo (`#494fdf` light / `#7170ff` dark) that appears *only* on "premium card" elevations and the Bradesco operator chip

### Typography
**Stack:** `Poppins` for display / headings / app chrome; `Inter` for body / UI / landing prose; `ui-monospace` for code snippets. All weights self-hosted from `fonts/` — **zero Google Fonts dependency**. Poppins ships as 9 weights (100–900) plus italics; Inter ships as a variable font with `opsz` + `wght` axes (the static 18pt / 24pt / 28pt optical-size variants are also wired as `'Inter 18pt'` / `'24pt'` / `'28pt'` for niche cases). **Weights actually used in product:** 400, 500, 600, 700, 800 — never 100/200/300, never italic.

An alternate display family `Sora` (variable font, 100–800) is also wired and exposed via `--font-display-alt`. It is *not* the brand default — use only when explicitly directed.

The marketing landing flips the default — `.landing-page` switches body to Inter (more legible at long-form) while headings stay Poppins. Inside the app, everything is Poppins by default.

Display headlines use **tight tracking** (`-0.024em` → `-0.03em`); body uses normal tracking. Letter-spacing is the single biggest tell that copy is "in brand" vs. not.

### Backgrounds & atmosphere
The landing pages do **not** use photographs or illustrations as full-bleed backgrounds. Atmosphere comes from:
- **Dot grid** (`radial-gradient(border-color 1px, transparent 1px)` at `28px` tile, `opacity: 0.4`) under the hero only
- **Soft glow orbs** — large `radial-gradient` blobs of `color-mix(--primary 18%, transparent)` placed off-canvas, never overlapping cards. Different sections get different orb compositions (`landing-hero-orbs`, `landing-features-orbs`, `landing-email-orbs`, etc.) so each section has its own colored mood without breaking the system.
- **Fade-to-background** at section boundaries (`linear-gradient(to bottom, transparent, var(--background))`)
- **Backdrop blur** (`backdrop-filter: blur(8–12px)`) on hero floating cards and the sticky header — never on plain sections.

Inside the app: surfaces are flat. No orbs, no blur. The sidebar is `oklch(0.985 0 0)` (light) / `oklch(0.21 0.006 285.885)` (dark) — one step removed from the page background.

### Cards
Three idioms, picked by purpose:
- **`feature` (most common):** `border + bg: color-mix(--card 85%, transparent) + box-shadow: 0 20px 40px -20px color-mix(--primary 22%, transparent) + backdrop-blur(8px)`. Used for landing feature cards and any "highlighted content" block. Rounded `2xl` (1rem).
- **`feature-featured` (rare):** adds `--precision-border-strong` and `--precision-shadow-2`. Used for the pricing/demo form card. Maximum two per page.
- **Dense app card:** `bg-card + border + rounded-xl + shadow-sm`. No blur, no glow. Used for dashboard metric cards, kanban columns, lead cards. Hover: `shadow-md transition-shadow`.

### Buttons
- **Primary** — `bg-primary text-primary-foreground rounded-2xl px-6 py-3.5 font-semibold` + a tinted projected shadow `box-shadow: 0 12px 28px -8px color-mix(--primary 60%, transparent)`. Hover: `hover:scale-[1.02]`. The combination of the rounded-2xl shape and the warm shadow is the brand's most recognizable button.
- **Secondary** — neutral, `border + bg: color-mix(--card 70%, transparent)`. Same shape and size as primary.
- **Ghost** — used in nav, no border, just `hover:bg-accent`.
- **Pill-CTA** — for the "Em breve / Campanhas de Email" announcement pill in the hero. `rounded-full`, `border: 1px solid color-mix(--primary 30%, --border)`, `bg: color-mix(--primary 8%, --card)`.
- **Icon button** — `size-9` square, neutral, used in app chrome only.

### Borders & radii
- **Base radius:** `0.65rem` (10.4px). Computed scale: `sm = base − 4px`, `md = base − 2px`, `lg = base`, `xl = base + 4px`, `2xl = 1rem`.
- **Defaults:** buttons & cards use `rounded-2xl` (1rem); inputs and small chips use `rounded-md`/`rounded-lg`; icon containers use `rounded-xl`.
- Borders are nearly always `1px solid var(--border)`. Status borders never blare — they're `color-mix(status-color 34–44%, --border)`, so the chip stays calm next to neutral chrome.

### Shadows
Two systems, never mix on the same element:
- **Precision shadows** (`--precision-shadow-1` / `-2` / `-3`) — neutral, fintech-cold. Default for app surfaces.
- **Warm CTA shadows** — `box-shadow: 0 12px 28px -8px color-mix(--primary 60%, transparent)`. Reserved for primary buttons, the primary hero CTA, and the highlighted feature card. They're how the brand says "click here."

### Motion
Three durations, two easings:
- `--motion-duration-fast: 150ms` for hover/active state transitions
- `--motion-duration-base: 220ms` for content state changes
- `--motion-duration-slow: 320ms` for reveal/entrance
- `--motion-ease-standard: cubic-bezier(0.2, 0, 0, 1)` for state changes
- `--motion-ease-entrance: cubic-bezier(0.16, 1, 0.3, 1)` for reveals (deceleration curve)

Landing-page sections use `framer-motion` (`whileInView`) with `opacity 0 → 1, y 20 → 0` over 500–600ms, `once: true`, with an 80ms stagger inside grids. No looping animations except the small `1.5s` heart-pulse on a couple of badges and the announcement pill's dot. Reduced motion: transforms disabled, opacity preserved.

### Hover & press states
- **Cards:** `hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30` (the border tint is the bigger tell than the shadow)
- **Primary buttons:** `hover:scale-[1.02]` + `hover:shadow-xl`. No color shift on hover (the orange already pops).
- **Secondary / ghost:** `hover:bg-muted/50` or `hover:bg-accent`
- **Sidebar items:** active state uses `bg-sidebar-accent` and the orange ring as a left rail — no left-border-only accent stripes elsewhere in the system, that pattern is reserved for the sidebar.
- **Press (`active:`):** Kanban cards switch cursor to `active:cursor-grabbing`; otherwise no scale-down on press.

### Layout
- `max-w-7xl` outer wrap; horizontal padding `px-6 sm:px-8 lg:px-10`
- Vertical section rhythm `py-20 md:py-28`
- 12-col grid available, but **bento asymmetry preferred** for features (`col-span-2 + col-span-1`)
- Card inner padding `p-6` / `p-8` / `p-10` depending on density
- Minimum gap `gap-4`, common `gap-4 lg:gap-5`
- Sticky top header (`sticky top-0 z-20 border-b bg-background/80 backdrop-blur-lg`) on landing only

### Transparency & blur
Used surgically:
- `backdrop-filter: blur(8px)` on landing feature cards (`landing-surface-card-*`)
- `backdrop-filter: blur(12px)` on hero floating badges
- `backdrop-filter: blur(lg)` on the sticky landing header
- `bg: color-mix(--card 70–92%, transparent)` is the standard "frosted" recipe — never `rgba(255,255,255,0.x)`, always `color-mix` against `--card` so dark mode just works.

Inside the app, blur is off. Surfaces are opaque so the Kanban stays scannable.

### Corner radii in practice
| Element | Class | Px (at base 0.65rem) |
|---|---|---|
| Inputs, badges, small chips | `rounded-md` | 6.4 |
| App cards, hero pill | `rounded-lg` / `rounded-xl` | 10.4 / 12 |
| Landing feature cards, primary buttons | `rounded-2xl` | 16 |
| Hero product visual frame | `rounded-3xl` | 24 |
| Avatars, status dots, "online" indicators | `rounded-full` | ∞ |

### Imagery vibe
Brand-owned imagery is **monogram-on-gradient only** (the share PNG). Product imagery is a single SVG mock of the pipeline (`product-banner.svg`) — flat, vector, no photography, no people. The brand has no photo library in the codebase. **Don't generate AI photography for this brand.** When you need a hero/screenshot, render a real UI mock (kanban column, dashboard card) and frame it in a `rounded-3xl shadow-2xl` container with the orange-tinted shadow recipe.

---

## Iconography

**System.** **Lucide React** exclusively, imported per-icon (`import { Kanban, Mail, CalendarDays } from "lucide-react"`). No icon font, no sprite sheet, no decorative SVGs hand-rolled in markup. The codebase uses around 40+ Lucide icons and the rule is "if Lucide has it, use Lucide; if it doesn't, file a ticket — don't draw."

**Style.** Lucide's default: **1.5px stroke, rounded line-caps and joins, no fills.** This pairs well with the system's medium-weight typography (Inter 500–600) — the stroke weight matches the type weight. Never swap to filled icons; never mix Heroicons or Phosphor.

**Sizing.**
- `size-4` (16px) inline with body text, in buttons, in sidebar rows
- `size-5` (20px) standalone in compact card headers and small feature icon tiles
- `size-7` (28px) in large feature icon tiles
- All icons live inside a colored container in feature contexts: `inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary` (small) or `h-14 w-14 … rounded-xl` (large).

**Color.** Icons take the color of their text container by default. Inside feature/CTA contexts they're `text-primary` on a `bg-primary/12 to bg-primary/15` tinted tile. Never multi-color icons. Status-context icons inherit the status color from their badge.

**Emoji / Unicode glyphs.** Not used as icons. The single allowed Unicode glyph in the system is the middle dot `·` (U+00B7) as an inline separator in trust lines, and the right arrow inside text labels is the Lucide `ArrowRight` component — never a raw `→`.

**Logo / monogram.** `assets/corretor-studio-icon.svg` is the only logo asset. It's a stylized "C/S" interlocking monogram in white on the brand gradient. It works on any background because of the 162px corner radius and the gradient fill — never apply CSS filters to it, never recolor it. At small sizes (≤24px) the monogram becomes illegible; pair it with the wordmark `Corretor Studio` set in Poppins 600 instead of shrinking.

**Substitutions flagged.**
- The uploaded `uploads/corretor-studio-icon.svg` was **broken** (it referenced an `<image>` element with no embedded data). I substituted with the working version from the codebase's `public/` folder. If you have a higher-fidelity master (e.g. a Figma export with the embedded PNG, or a vector-only version of the monogram), please drop it into `assets/` and I'll re-vector this card. No Lucide / Google Font substitutions were needed — both `Poppins` and `Inter` are loaded from Google Fonts in the live app already.

---

## Caveats

- The uploaded icon was broken and replaced — see Iconography above.
- No slide deck was provided, so `slides/` is intentionally absent.
- The CRM has many screens (calendar, simulator, wallet, performance, email composer, integrations, etc.) — the UI kit reproduces **the four highest-signal surfaces** (landing, Kanban board, dashboard, sidebar/app shell). Ask if you need others.
- A handful of `text-orange-500`, `text-emerald-400`, `text-amber-400` hex/Tailwind-palette references survive in the codebase (sidebar status dots, dashboard metric tints) — they're not in the token system. Treat them as legacy; map them to `--primary`, `--semantic-success`, `--semantic-warning` in new work.
