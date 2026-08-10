# CRON_OBSERVABILITY_SPEC.md — Corrigir o outage transversal dos 21 cron jobs

**Versão:** 1.1 (Estágio 5 + open question dos órfãos resolvida na investigação 2026-08-09)
**Data:** 2026-08-09
**Base factual:** `CRON_OBSERVABILITY_AUDIT.md` (leitura obrigatória antes de qualquer estágio).
**Status:** Concluído (código) — Estágio 4 aguarda deploy/autorização do dono.

## Status de execução

| ID | Agente | Branch | PR | Estado | Revisado em | Notas |
|----|--------|--------|-----|--------|-------------|-------|
| Estágio 1+2 | CronP0 | `feature/cron-observability-p0` | — | **completed** | 2026-08-10 | migration + withCronAudit TDD |
| Estágio 3 | Governance | `feature/cron-observability-p0` | — | **completed** | 2026-08-10 | check em governance:check |
| Estágio 5 | CronScheduler | `feature/cron-observability-p0` | — | **completed** | 2026-08-10 | vercel.json + GET backfill |
| Estágio 4 | ProdOps | — | — | pending | — | aguarda autorização dono `db:migrate:push` |

---

## Goal

Restaurar a execução de todos os cron jobs que hoje falham com HTTP 500 antes de rodar sua lógica de negócio (incluindo o backup diário do banco), sem remover a observabilidade que o wrapper `withCronAudit` foi criado para fornecer, e sem repetir o tipo de drift de migration que causou o incidente.

## Non-goals

- Redesenhar o sistema de observabilidade de crons (dashboard `/backoffice/cron-executions`, notificação Slack) — a interface e o modelo de dados ficam como estão; só a ordem de execução dentro do wrapper muda.
- Reprocessar retroativamente o que os crons perderam desde 2026-08-07 (ex.: backups pulados) além do que está explicitamente no Estágio 4.
- Alterar a lógica de negócio dos 4 crons órfãos (backfill/import/dunning/rollup) — o Estágio 5 só registra schedule + alinha método HTTP; bugs de payload ficam nos SPECs de domínio.

---

## Decisões arquiteturais (DA1–DA3)

### DA1 — Migration manual via `db:migrate:new`, nunca `db:migrate:from-prisma`

A tabela `backoffice_cron_executions` é infraestrutura de observabilidade pura, sem relação com nenhum fluxo de negócio nem tabela existente — não é o tipo de mudança que `db:migrate:from-prisma` (schema-diff automático) deveria gerar isoladamente sem revisão, e a política do repositório (`CLAUDE.md`) já trata DDL de observabilidade como fluxo manual. Gerar via `bun run db:migrate:new create-backoffice-cron-executions` e escrever o SQL à mão, espelhando exatamente os campos já definidos em `prisma/schema.prisma:184-190,1698-1715` (que não mudam neste spec — só a migration que falta).

### DA2 — Auditoria de cron nunca pode ser dependência dura da execução do cron

O `create()` inicial de `withCronAudit` deve estar dentro de um `try/catch` próprio que, em caso de falha, loga o erro e **segue para `handler()` mesmo assim** (com `execution` possivelmente `null`, tornando `markSuccess`/`markFailed` no-op quando não há registro). Rationale: a função da auditoria é observar a execução do cron, não gatear se ela acontece. Uma falha em registrar "o cron começou a rodar" nunca deveria impedir "o cron rodar".

### DA3 — Prevenção: novo check de governança para drift model↔migration

Adicionar um script/step (`bun run governance:check-migrations` ou equivalente, integrado a `governance:check`) que, para cada `model` novo introduzido num diff de `prisma/schema.prisma`, verifica se existe pelo menos uma migration em `supabase/migrations/` contendo o nome de tabela mapeado (`@@map(...)`) via `CREATE TABLE`. Heurística simples (grep no diff + grep nas migrations), não precisa ser um parser de SQL completo — o objetivo é pegar o caso "model novo, zero migration", que foi exatamente o que aconteceu aqui.

**Complemento normativo (já em `agents.md` v2.5.1):** toda migration/SQL raw **MUST** usar nomes físicos de `prisma/schema.prisma` (`@@map`/`@map`) e respeitar o boundary `app/api/infra/data/prisma.ts`. Cobre a classe de erro B1 do Radar (nome de model em `$queryRaw`/DDL) além do drift “model sem migration”.

---

## Restrições globais

- `Route → UseCase → [Service] → Prisma`; nenhuma mudança de camada além do wrapper de cron e da migration.
- Migrations: `db:migrate:new` (DA1); SQL idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE TYPE` com guarda `DO $$ ... IF NOT EXISTS $$`); replay validado localmente via `bun run db:migrate:reset:local` antes de qualquer push; **push remoto (`bun run db:migrate:push`) somente com autorização explícita do dono do projeto**, precedido de `bun run db:migrate:push:dry-run`.
- Nenhuma mudança de comportamento no dashboard `/backoffice/cron-executions` nem no payload enviado ao Slack.
- Após cada estágio: `bun run typecheck 2>&1 | head -20`, `bun run lint`, `bun run governance:check`, `bun run lint:pt-br`.
- Endpoint novo/alterado ⇒ nenhum endpoint HTTP novo é criado neste spec (só a migration e o wrapper mudam) — Postman não precisa de atualização.
- Cada estágio = 1 branch (a partir de `develop`) + 1 PR (CI abre o PR no push, conforme `agents.md`).

---

## Estágio 1 — Migration faltante: `backoffice_cron_executions` + `backoffice_cron_status`

**Objetivo:** materializar no banco exatamente o que `prisma/schema.prisma` já declara desde `2b36cd5d`.

**Passos:**
1. `bun run db:migrate:new create-backoffice-cron-executions`
2. Escrever SQL idempotente no arquivo gerado, espelhando `prisma/schema.prisma:184-190` (enum) e `:1698-1715` (model) — colunas, tipos, índices (`backoffice_cron_executions_cron_key_status_idx`, `backoffice_cron_executions_started_at_idx`) e `@@map` exatos.
3. Validar localmente: `bun run db:migrate:reset:local` (replay completo) — confirmar que `bunx prisma db push --skip-generate --accept-data-loss` (ou `db:migrate:from-prisma -- --dry-run`) não aponta mais diff pendente entre schema e banco local para este model.
4. `bun run db:migrate:push:dry-run` para revisão — **não** rodar `db:migrate:push` neste estágio sem autorização explícita do dono.

**Critério de sucesso:** `supabase migration list` (após push autorizado) mostra a migration aplicada; `prisma.backofficeCronExecution.create(...)` para de lançar `does not exist` em produção.

## Estágio 2 — Corrigir `withCronAudit` (DA2)

**Arquivo:** `app/api/lib/cron/withCronAudit.ts`

**Mudança:** envolver a chamada inicial `repository.create(...)` num `try/catch` que loga a falha (`console.error`) e permite que `handler()` execute de qualquer forma. Ajustar `markSuccess`/`markFailed` para tolerar `execution === null` (early return, sem lançar).

**Critério de sucesso:** teste unitário simulando `repository.create` rejeitando — `handler()` ainda é chamado e seu retorno/exceção se propaga normalmente para a rota, independente do resultado da auditoria.

## Estágio 3 — Novo check de governança anti-drift (DA3)

**Objetivo:** impedir recorrência do padrão "model novo em `schema.prisma` sem migration".

**Passos:**
1. Adicionar step ao script de governança (`scripts/ai-governance.ts` ou script irmão dedicado) que compara `model`s presentes em `prisma/schema.prisma` contra `CREATE TABLE`/nome mapeado em `supabase/migrations/**`.
2. Rodar contra o histórico atual do repositório como smoke test (não deve haver mais nenhum model sem migration, após o Estágio 1).
3. Documentar o novo check no `CLAUDE.md` (seção de Automated Enforcement) — fora do escopo de código deste spec editar `CLAUDE.md`/`agents.md` diretamente; abrir isso como item do PR checklist do Estágio 3.

**Critério de sucesso:** `bun run governance:check` falha se um novo model for adicionado sem migration correspondente (testável introduzindo temporariamente um model fictício sem migration num branch de teste local, depois revertendo).

## Estágio 4 — Replay/backfill do que os crons perderam (se autorizado)

### Runbook (orquestrador + dono)

**Pré-deploy (Estágio 1+2):**
1. `bun run db:migrate:push:dry-run` — revisar SQL de `create-backoffice-cron-executions`
2. Autorização explícita do dono para `bun run db:migrate:push`
3. Deploy da aplicação com `withCronAudit` corrigido

**Pós-deploy (24h):**
1. Logs: zero `Invalid prisma.backofficeCronExecution.create()` / `relation "backoffice_cron_executions" does not exist`
2. Dashboard `/backoffice/cron-executions`: execuções `running` → `success` para crons agendados
3. `database-backup`: dono decide se dispara backup manual para janela 2026-08-07→deploy

**Crons de intervalo curto (5–15 min):** próxima execução natural reprocessa fila pendente — sem replay manual salvo exceção documentada.

**Status:** aguardando autorização do dono para `db:migrate:push` remoto.

**Objetivo:** avaliar, para cada rota afetada, se há trabalho perdido que vale reprocessar manualmente uma vez (não é um mecanismo automático permanente).

- `database-backup`: confirmar com o dono se falta rodar um backup manual coprindo a janela sem backup (desde 2026-08-07) antes/depois do deploy do Estágio 1.
- `email/cron/dispatch-scheduled`, `process-import-jobs`, `notifications/cron/meeting-reminders` etc.: são crons de intervalo curto (5-15 min) que reprocessam a fila pendente a cada execução — uma vez que o Estágio 1 for deployado, a próxima execução natural já pega o trabalho pendente acumulado, sem necessidade de replay manual. Confirmar isso rota a rota antes de fechar o estágio.

**Este estágio só avança com autorização explícita do dono do projeto**, por envolver produção (ver `CLAUDE.md`: migrations e ações em produção exigem autorização).

## Estágio 5 — Registrar os 4 crons órfãos no `vercel.json` (investigação fechada)

**Base factual:** `CRON_OBSERVABILITY_AUDIT.md` §4 "Achado secundário" (2026-08-09) — confirmado: **não** há fila/worker/n8n acionando essas rotas; nunca estiveram no `vercel.json`; só Postman/manual.

**Objetivo:** passar a agendar pela Vercel Cron as rotas que o produto já implementou e documentou nos SPECs de domínio.

**Passos:**
1. Em `engagement-backfill`: adicionar `GET` que reutiliza o mesmo handler do `POST` (Vercel Cron só dispara GET). Manter `POST` para Postman/compat.
2. Incluir no array `crons` de `vercel.json` (schedules **propostos** — dono pode ajustar no PR):

| Path | Schedule proposto | Justificativa |
|---|---|---|
| `/api/v1/radar/cron/process-import-jobs` | `*/5 * * * *` | Espelha `email/cron/process-import-jobs` |
| `/api/v1/billing/cron/overdue-reminder` | `0 7 * * *` | Dunning diário (vizinho de `member-pro-expiration` às 06:00) |
| `/api/v1/notifications/cron/studio-bot-ai-rollup` | `15 */6 * * *` | Rollup periódico Bethânia IA (baixo volume) |
| `/api/v1/radar/cron/engagement-backfill` | `0 4 * * *` | Backfill pesado (lotes 500); janela noturna |

3. Após Estágio 1+2 em produção: validar no dashboard `/backoffice/cron-executions` que as 4 `cronKey`s passam a registrar execuções (`radar-import`, `overdue-reminder`, `studio-bot-ai-rollup`, `engagement-backfill`).
4. Não alterar secrets: `CRON_SECRET` (padrão) e `BACKOFFICE_BETHANIA_AI_ROLLUP_CRON_SECRET` (opcional no rollup) permanecem.

**Critério de sucesso:** nas 24h pós-deploy, cada uma das 4 rotas tem ≥1 execução registrada (ou skip documentado se o job for no-op por falta de trabalho), sem 401 por método HTTP errado.

**Dependência:** pode ir em PR separado depois do Estágio 1+2 (senão as novas schedules também estouram no `create()` da tabela ausente). Schedules finais **MUST** ser confirmados pelo dono no review do PR.

---

## Ordem de execução e dependências

Estágio 1 → Estágio 2 (podem ir no mesmo PR, já que travam o mesmo arquivo/schema) → Estágio 3 (independente, pode rodar em paralelo) → Estágio 4 (depende do Estágio 1 estar em produção) → Estágio 5 (depende do Estágio 1+2 em produção; PR próprio).

## Critérios de sucesso (macro)

- Zero ocorrências de `Invalid prisma.backofficeCronExecution.create() invocation` nos logs de produção nas 24h após o deploy do Estágio 1+2.
- Taxa de HTTP 500 nas 9 rotas da tabela do audit (§4/§5 do `CRON_OBSERVABILITY_AUDIT.md`) volta a zero (ou ao baseline de erros de negócio genuínos, não de infra).
- Alertas de Slack voltam a disparar corretamente em falhas reais de cron (validável simulando uma falha controlada em ambiente local/staging).
- `bun run governance:check` passa a barrar localmente um model de teste sem migration (Estágio 3).
- Após Estágio 5: as 4 `cronKey`s órfãs deixam de ser “só Postman” e passam a aparecer em `BackofficeCronExecution`.

## Open questions (bloqueiam apenas o estágio indicado)

1. ~~**(Estágio 5 / ex-órfãos)** São acionados por outro mecanismo ou ficaram esquecidos fora do `vercel.json`?~~ **Resolvido 2026-08-09** — órfãos de schedule; sem caller alternativo no repo. Correção = Estágio 5 (schedules finais confirmados pelo dono no PR).
2. **(Estágio 4)** Confirmar com o dono se algum backup manual precisa ser disparado para cobrir a janela sem `database-backup` desde 2026-08-07, ou se o próximo backup agendado já é suficiente.
3. **(Estágio 5)** Confirmar/ajustar os 4 cron expressions propostos na tabela do Estágio 5 (especialmente `engagement-backfill` diário vs menos frequente).
