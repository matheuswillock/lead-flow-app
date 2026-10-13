# Cobertura automatizada

Esta tabela define o que pode sair das instruções narrativas e quais garantias continuam humanas.

| Comando | Valida | Não valida |
|---|---|---|
| `bun run typecheck` | Geração Prisma e tipos TypeScript | Fluxo em runtime, regra de negócio, UI |
| `bun run lint` | Regras TypeScript recomendadas, Next/Core Web Vitals, hooks e uso de console | `any` explícito, E2E ignorado, qualidade arquitetural completa; métricas de complexidade são warnings |
| `bun run governance:check` | Adapters, metadata, crescimento de allowlists, boundaries Prisma/Repository/Service/HTTP, `Output`, estrutura frontend, arquivos TS, dialogs nativos, API masking, global Bun, nomes físicos Prisma, cobertura de página e presença estrutural de responsividade | Comportamento, qualidade visual, contraste, execução real do E2E |
| Checks dedicados de governance | Reexecutam isoladamente API masking, cobertura E2E e presença de `runResponsiveChecks` | Resultado dos testes ou responsividade real |
| `bun run design:check` | Sincronização dos tokens de `DESIGN.md` com `app/globals.css` | JSX, contraste, composição, layout e dark mode renderizado |
| `bun run lint:pt-br:strict` | Heurística de acentuação em textos cobertos | Tom de voz, clareza ou correção semântica da copy |
| Testes unitários/integração | Cenários efetivamente executados | Casos ausentes e integrações externas não ativadas |
| Playwright | Fluxos e asserts presentes nas specs executadas | Qualidade visual fora dos asserts |

## Regras humanas que permanecem

- Nomes significativos, SRP, ausência de abstração prematura e revisão de side effects.
- Autorização antes de banco remoto, force-push ou ações destrutivas.
- Verificação visual medida para qualquer alteração visual.
- Revisão de nomes físicos e intenção do SQL mesmo quando checks passam.
- Controle negativo para testes que protegem comportamento crítico.
