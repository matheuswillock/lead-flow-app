---
name: corretor-studio-design
description: Use this skill to generate well-branded interfaces and assets for Corretor Studio, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files. The system describes Corretor Studio, a B2B SaaS CRM for Brazilian health-insurance brokers, codenamed **Supercombo v3** — Hybrid Warm-Precision (orange + fintech precision + dark surface discipline).

## What lives in this skill

- `README.md` — full design contract: company context, content/voice guide, visual foundations, iconography, caveats, index.
- `colors_and_type.css` — every OKLch token, the type scale, the brand gradient and avatar gradients. Drop it into any HTML and you get the system for free.
- `assets/` — the logo (gradient C/S monogram), 1080×1080 share PNG, product banner SVG, partner logo. Copy these out; never re-draw them.
- `preview/` — small HTML cards (badges, buttons, semantic colors, atmosphere recipe, type scale, etc). Useful for cross-referencing.
- `ui_kits/app/` — pixel-honest React + Babel recreation of the marketing landing, Kanban board and dashboard. Each screen is one JSX file; primitives (Button, Badge, Card, Avatar, Input, Icon) live in `shared.jsx`. Reuse aggressively — don't reinvent.
- `reference/` — verbatim source-of-truth files from the live codebase (`DESIGN.md`, `globals.css`). Consult when in doubt about a specific token.

## When the user invokes this skill

If creating visual artifacts (slides, mocks, throwaway prototypes, single-screen designs, etc.) — copy assets out, link `colors_and_type.css`, and produce a static HTML file the user can open. Prefer reusing components from `ui_kits/app/` over hand-rolling.

If working on production code — copy assets and follow the rules in `README.md` to become an expert in designing with this brand. Tokens are normative; hex literals in JSX/TSX are forbidden. Lucide React only for icons. Poppins for display, Inter for body. The orange-tinted CTA shadow is the brand's single most recognizable button signature — earn the right to drop it elsewhere.

If the user invokes this skill **without other guidance**, ask them what they want to build or design, ask a few targeted questions (scope, audience: marketing vs in-app vs internal; light/dark; how many variations; specific surfaces involved), and act as an expert designer who outputs HTML artifacts _or_ production code depending on the need.

## Hard rules to enforce

- **Tokens, never hex.** `var(--primary)`, not `#ff6900`.
- **One gradient, two uses.** Orange→rose→magenta lives on the logo and one accent word per headline. Never gradient backgrounds or buttons.
- **One CTA shape.** `rounded-2xl` + warm tinted shadow `0 12px 28px -8px color-mix(--primary 60%, transparent)`. Don't invent a second primary button.
- **No emoji.** Lucide icons, period. The one allowed Unicode glyph is `·` as a separator.
- **Portuguese-BR, `você`, sentence case.** Caps reserved for the one accent word in a gradient headline.
- **Inside the app: no blur, no orbs.** Those belong to the marketing surface only.
