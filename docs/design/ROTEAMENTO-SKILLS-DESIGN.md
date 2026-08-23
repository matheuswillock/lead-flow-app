# Roteamento de skills de design

**Status:** normativo. Referenciado por `agents.md` › Landing Page Method.

Há ~99 skills de design instaladas na máquina do time. **A maioria não deve
rodar neste repositório** — não por serem ruins, mas porque contradizem
`DESIGN.md` ou estão quebradas neste ambiente.

Carregar 10 skills é pior que carregar 2: elas se contradizem em fonte, cor e
motion, e o modelo oscila entre direções incompatíveis.

---

## Tabela de roteamento

| Contexto | Cadeia obrigatória | Opcionais |
|---|---|---|
| **Landing nova** | `corretor-studio-design` → `corretor-studio-ui` → `design-system-guard` | `design-taste-frontend` (só composição) |
| **Redesign de landing** | `corretor-studio-design` → `corretor-studio-ui` → `design-system-guard` | `design-taste-frontend` (preserve vs overhaul) |
| **Tela nova no app** | `corretor-studio-design` → `corretor-studio-frontend` → `corretor-studio-ui` → `design-system-guard` | `visual-feature-planner` (4+ componentes) |
| **Componente / polimento** | `design-system-guard` | `make-interfaces-feel-better`, `emil-design-eng` (só motion) |
| **Tokens / design system** | `corretor-studio-design` → editar `DESIGN.md` §9 → `bun run design:sync` → `design-system-guard` | — |
| **Marca / logo / brand kit** | `brandkit` | `imagegen-frontend-web` |
| **Gráfico / dataviz** | `dataviz` → `corretor-studio-design` → `corretor-studio-ui` → `design-system-guard` | — |
| **E-mail** | `react-email` | `email-best-practices` |
| **Mockup antes de codar** | `corretor-studio-design` → `imagegen-frontend-web` | `image-to-code` (substitui, não encadeia) |
| **Auditar UI** | `design-system-guard` | `refactoring-ui` (só app), `make-interfaces-feel-better` |

As skills do projeto **não estão no Skill tool**. Leia o arquivo:
`.claude/skills/corretor-studio-design.md`, `.claude/skills/corretor-studio-ui.md`,
`.claude/skills/design-system-guard/SKILL.md`.

---

## Regras de precedência

1. **`DESIGN.md` vence qualquer skill genérica** em cor, tipografia, raio, sombra
   e motion. Nenhuma skill externa emite `font-family`, `next/font` ou hex.
   Absoluto, vale para landing e para app.

2. **A superfície decide a composição, nunca a identidade.** Marketing libera
   bento assimétrico, `py-20 md:py-28`, blur/orbs, scroll-reveal. App/CRM proíbe
   os quatro.

3. **O gradiente laranja→rose→magenta é token de marca, não slop.** Ele vence a
   blocklist anti-slop das skills genéricas. Só aceite o finding contra ele se
   estiver em botão, em fundo, ou em mais de uma palavra por headline — aí
   `DESIGN.md` §Landing também proíbe e o finding é legítimo.

4. **Token novo entra por um caminho só:** `DESIGN.md` §9 → `bun run design:sync`
   → `bun run design:check`. É proibido escrever à mão nas regiões geridas de
   `app/globals.css` (`TOKENS:THEME_INLINE` 11-80, `TOKENS:ROOT` 82-179,
   `TOKENS:DARK` 181-277) e é proibido rodar `design-tokens`,
   `stitch-design-taste` ou `gstack design-consultation` dentro do repo — as três
   escrevem arquivo de tokens por conta própria e sobrescrevem o sync.

5. **Motion:** a escola Emil Kowalski é lei no app/CRM (teto 300ms, ease-out,
   proibido ease-in). Na landing essas skills são **consultivas** — os findings de
   "duração acima de 300ms" e "scroll-reveal dramático" são descartados, porque
   ali o movimento é argumento de venda.

6. **`refactoring-ui` é piso, não teto.** No app tem autoridade plena. Na landing
   opina só sobre o mensurável (contraste, escala de spacing, largura de linha) —
   a nota 0-10 dela é descartada nessa superfície.

7. **Ao carregar geradora genérica, declare a supressão:** *"seção de tipografia
   e paleta descartada — Poppins/Inter e tokens por DESIGN.md"*. Use essas skills
   só como fonte de composição, hierarquia e listas anti-slop.

8. **Nunca duas geradoras de landing na mesma sessão.** `impeccable` manda 30-60%
   da página em cor ("drenched"); `design-taste-frontend` e as outras mandam base
   neutra com um accent. É aritmeticamente incompatível.

9. **Teto de contexto: no máximo 2 skills de direção/crítica por vez**, além das
   obrigatórias do projeto.

10. **Uma shadcn só:** `.agents/skills/shadcn` (lê `components.json` real e usa o
    MCP conectado). `shadcn-ui` está **proibida** — o conteúdo é da era Tailwind
    v3 (`tailwind.config.js`, `@tailwind base`, HSL em `@layer base`) e o repo é
    Tailwind 4.2.2 com `@theme inline`. De `vercel:shadcn`, aceite só CLI e
    troubleshooting; descarte a seção "Design Direction".

11. **E-mail inverte a regra dos tokens.** Cliente de e-mail não resolve
    `var(--primary)`, então em `emails/**` o hex literal é obrigatório e
    `design-system-guard` não se aplica. Centralize em `emails/tailwind.config.ts`.

12. **Marca de terceiro nunca substitui a do projeto.**
    `anthropic-skills:brand-guidelines` é a identidade da Anthropic;
    `changelog-video` carrega marca HeyGen. Só valem quando a marca do artefato
    é a delas.

---

## Bloqueadas por ambiente — não invoque, não prometa

| Skill / família | Motivo |
|---|---|
| `stitch-design`, `stitch-design-taste`, `stitch-loop`, `design-md`, `react-components`, `remotion`, `enhance-prompt` | Não há MCP Stitch em `.mcp.json` (só shadcn, asaas, supabase, vercel, Sentry) |
| `gstack design-review`, `design-shotgun`, `design-consultation`, `plan-design-review`, `design-html`, `diagram` | `~/.cursor/skills/gstack` não tem `bin/` nem `design/dist/design` |
| `web-design-guidelines` | O `SKILL.md` é só um fetch de `command.md` remoto — falha sem rede |
| `ios-design-review` | Exige app iOS nativo em iPhone físico |

## Atenção antes de usar

`superdesign` é um **serviço hospedado**: ela sobe imagens e brand assets para
`superdesign.dev` e cria projetos server-side. Ela não sobe o repositório (o
próprio SKILL.md proíbe bulk-upload), mas ativos de marca do Corretor Studio
saem da máquina. Decisão do dono, não default do agente.
