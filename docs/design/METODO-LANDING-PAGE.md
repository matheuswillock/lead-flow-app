# Protocolo Landing — método de criação de landing page

**Status:** normativo. Referenciado por `agents.md` › Landing Page Method.
**Escopo:** qualquer página pública de marketing/aquisição (`app/page.tsx` e subárvores com `.landing-page`).
**Não se aplica a:** telas do app autenticado, backoffice, e-mail.

Este documento existe porque o processo anterior tinha três buracos medidos:
a única regra sobre briefing incompleto mandava **assumir**; nenhum comando
olhava a tela renderizada; e não havia inventário de fatos citáveis, então
número inventado passava por todos os checks.

---

## Etapa 0 — Declarar a superfície (30 segundos)

Antes de invocar qualquer skill visual, escreva uma linha:

> Superfície: **marketing** (`.landing-page`, light-only) — composição expressiva liberada.

ou

> Superfície: **app** (`app/[supabaseId]/**`) — densidade e sobriedade.

A superfície decide a **composição permitida**. Nunca decide a **identidade**:
Poppins/Inter e os tokens de `DESIGN.md` valem igual nas duas.

---

## Etapa 1 — GATE (bloqueante)

**Não escreva JSX antes de fechar esta etapa.** O agente faz as 8 perguntas
de uma vez, numa única mensagem, usando `AskUserQuestion` quando disponível.

Cada pergunta existe porque evita uma suposição que já custou caro.
Nenhuma tem default: **sem resposta, o trabalho para.**

| # | Pergunta | Suposição que evita |
|---|---|---|
| 1 | A página usa o tema `.landing-page` (light-only) ou herda o tema do app? | O agente decidiu sozinho e aplicou tokens de app numa landing |
| 2 | Quem é o leitor e o que ele já sabe sobre o produto? | Público inventado → copy genérica de SaaS |
| 3 | Qual é a **única** ação que a página precisa provocar? | Três CTAs concorrentes, nenhum vence |
| 4 | Quais números podem ir ao ar, e qual a fonte de cada um? | Ver Etapa 1b — há número sem fonte em produção hoje |
| 5 | Existe depoimento **real e autorizado por escrito**? Se não, a seção não existe. | `TestimonialsSection.tsx` tem 3 depoimentos de pessoas inexistentes, commitado |
| 6 | Que claim é proibido? (promessa de resultado, "grátis", prazo, comparação com concorrente) | Setor regulado; hoje não há teto de claim em lugar nenhum |
| 7 | Quais seções, em que ordem? Se não souber, digo o que proponho e você corta. | Esqueleto default de SaaS (hero → 3 cards → depoimento → pricing → FAQ) |
| 8 | É **preserve** (mexe no visual, mantém estrutura) ou **overhaul**? | Reescrita completa quando o pedido era ajuste |

### Etapa 1b — Inventário de fatos (tabela versionada)

Junto com o gate, produza `docs/design/landing-fatos-<slug>.md` com esta tabela.
Ela é o **único** repertório de números e afirmações que a página pode citar.

| Claim | Valor | Fonte (arquivo:linha ou pessoa) | Pode ir ao ar |
|---|---|---|---|
| Corretores ativos | dinâmico | `lib/landing/public-stats.ts` (query real) | S |
| Leads gerenciados | dinâmico | `lib/landing/public-stats.ts` (query real) | S |
| Mais fechamentos | 31% | **sem fonte** — hardcoded em `lib/landing/stats-data.ts` | **N** |
| Satisfação | 4.9/5 | **sem fonte** — hardcoded em `lib/landing/stats-data.ts` | **N** |

**Regra dura:** seção sem fato na tabela não existe. Se a tabela não sustenta a
seção, ou o dono fornece o fato, ou a seção sai do plano.

**Fontes obrigatórias para preencher:** `PRODUCT.md` (marca, tom, anti-references),
`PRICING_TABLE.md` (respeite a legenda ✅ vigente / 💡 sugerido / 📋 proposto —
só ✅ vai ao ar), `PRICING_MODEL.md`, `SEO-PAGE-*.md`.

---

## Etapa 2 — Plano antes de código

1. Gere o `design_brief_json` com a skill `corretor-studio-design`.
2. **Escreva a copy de todas as seções em texto puro** e mostre ao dono.

O dono aprova **as palavras**, não a conversa. Esta é a etapa que teria matado
o defeito mais caro já observado: um agente inventou o produto inteiro porque
ninguém leu as frases antes de existir código.

Bloqueia se: alguma frase não tem lastro na tabela de fatos.

---

## Etapa 3 — Construir em duas fases

**V0 — estrutura e conteúdo reais.** Markup, hierarquia, copy aprovada, tokens
semânticos. Motion apenas `opacity`. Zero blur, zero orb, zero gradiente
decorativo. O objetivo é ver se a página **funciona** sem maquiagem.

**V1 — direção visual.** Só depois do V0 de pé: composição expressiva, motion,
assinatura visual.

Trate o V0 como descartável. Se ele não convence sem efeito, o efeito não salva.

---

## Etapa 4 — Crítica e verificação medida

**Uma** rodada de crítica, com **um** auditor (`design-system-guard`, mais
`impeccable` › `reference/critique.md` se a superfície for marketing).
Não três — três auditores geram ruído e ninguém fecha.

Defeito só fecha com **evidência nova**, não com uma frase declarando que foi
corrigido.

### Verificação obrigatória no DOM renderizado

```bash
bun run design:check        # tokens sincronizados
bun run typecheck && bun run lint
bun run governance:check && bun run governance:check-e2e-pages
bun run lint:pt-br
bun run test:e2e -- e2e/specs/public/<slug>.spec.ts
```

E na spec e2e, asserts medidos — não julgamento:

- contraste: nenhum par abaixo de 4.5 (texto) / 3.0 (UI)
- alvo de toque ≥ 44×44
- sem overflow horizontal: `document.documentElement.scrollWidth <= window.innerWidth + 1` em 360 e 375
- `prefers-reduced-motion` respeitado

### Verificação visual

A regra de olhar a tela renderizada — e a cadeia de fallback Playwright →
preview → `claude-in-chrome` → pedir screenshot — **não é específica de landing**.
Ela vale para toda tela do projeto e está em `agents.md` › Visual Implementation
› Visual Verification.

O que é específico da landing são os asserts medidos acima.

---

## Etapa 5 — Aceite

- [ ] Tabela de fatos existe e toda seção tem lastro nela
- [ ] Copy aprovada pelo dono **antes** do primeiro commit em `app/` ou `components/landing/`
- [ ] Zero hex cru e zero cor Tailwind bruta no diff
- [ ] Todos os comandos da Etapa 4 verdes
- [ ] Spec e2e no mesmo PR, com os asserts medidos
- [ ] Se a rota estava em `e2ePageCoverageAllowlist`, **saiu**
- [ ] Verificação visual feita — ou a ausência dela declarada explicitamente

### Prova de ordem por git

A aprovação da copy precisa anteceder o código:

```bash
git log --format='%ad %s' --date=iso -- docs/design/landing-fatos-<slug>.md | tail -1
git log --format='%ad %s' --date=iso -- app components/landing | tail -1
```

O primeiro timestamp **MUST** ser anterior ao segundo.

### Grep de aderência sobre o diff

```bash
git diff --name-only origin/develop...HEAD -- app components lib \
  | xargs grep -nE '#[0-9a-fA-F]{3,8}\b|\b(text|bg|border|ring|from|to|via)-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|blue|indigo|violet|purple|pink)-[0-9]{2,3}\b' \
  || echo "OK: sem hex cru nem paleta Tailwind bruta"
```
