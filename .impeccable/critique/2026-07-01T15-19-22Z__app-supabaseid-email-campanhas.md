---
target: app/[supabaseId]/email/campanhas
total_score: 25
p0_count: 0
p1_count: 3
timestamp: 2026-07-01T15-19-22Z
slug: app-supabaseid-email-campanhas
---
Method: dual-agent (A: 40fba7cf · B: 9e31b788)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons e badges OK; falta feedback se wizard falhar ao carregar listas |
| 2 | Match System / Real World | 3 | Tooltip CDP ajuda; slug técnico no accordion |
| 3 | User Control and Freedom | 2 | Cancelar agendamento sem UI; exclusão sem confirmação |
| 4 | Consistency and Standards | 2 | Tabs raw vs shadcn; amber hardcoded na barra de créditos |
| 5 | Error Prevention | 3 | AlertDialog de disparo forte; exclusão sem guarda |
| 6 | Recognition Rather Than Recall | 2 | 9 colunas + ações no menu ⋮ |
| 7 | Flexibility and Efficiency | 2 | Sem atalhos ou ações inline |
| 8 | Aesthetic and Minimalist Design | 2 | Tabela densa compete com filtros e créditos |
| 9 | Error Recovery | 3 | Toasts melhorados em send |
| 10 | Help and Documentation | 2 | Tooltip CDP pontual; empty state fraco |
| **Total** | | **25/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM:** Baixo risco de AI slop; wizard e analytics maduros; listagem ainda genérica CRUD.

**Detector:** 0 findings CLI em `app/[supabaseId]/email/campanhas`.

## Priority Issues

- **[P1] Tabela 9 colunas sem responsividade** — `$impeccable layout`
- **[P1] Exclusão de rascunho sem confirmação** — `$impeccable harden`
- **[P1] Cancelamento de agendadas inacessível** — `$impeccable clarify`
- **[P2] Ações críticas no menu ⋮** — `$impeccable distill`
- **[P2] Empty state sem CTA** — `$impeccable onboard`
