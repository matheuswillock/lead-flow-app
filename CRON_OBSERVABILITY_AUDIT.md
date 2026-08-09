# CRON_OBSERVABILITY_AUDIT.md — Auditoria: outage transversal dos cron jobs por drift de migration

**Data:** 2026-08-09 (log window 2026-08-08 22:06 → 2026-08-09 22:05 UTC, 29.244 linhas de log de produção da Vercel)
**Status:** ⚠️ **Ativo em produção** — reverificado em 2026-08-09 contra `origin/main` (release v0.200.0 / PR #708). O bug **não foi corrigido** pelo release mais recente.
**Documento par:** `CRON_OBSERVABILITY_SPEC.md` (correção executável)
**Método:** leitura de 29.244 linhas de log de produção (Vercel) anexadas pelo usuário, 3 agentes de exploração em paralelo sobre o código (`app/api/lib/cron/withCronAudit.ts`, `prisma/schema.prisma`, `supabase/migrations/**`, `vercel.json`), `git log`/`git show` contra `origin/main`.

---

## 1. Sumário executivo

Um único commit (`2b36cd5d`, 2026-08-07) adicionou um novo model Prisma (`BackofficeCronExecution`) e o conectou como wrapper obrigatório em **24 rotas de cron** — mas nunca gerou a migration correspondente. A tabela `backoffice_cron_executions` nunca existiu em nenhum ambiente. Como o wrapper (`withCronAudit`) chama `prisma.backofficeCronExecution.create()` **antes** de executar a lógica de negócio do cron, e essa chamada não está protegida por `try/catch`, **toda rota de cron que usa o wrapper falha com HTTP 500 antes de rodar seu trabalho real** — incluindo o backup diário do banco de dados.

Nas 24h analisadas: **2.775 linhas de erro** (9,96% de todas as linhas de log de produção), **273 respostas HTTP 500** (1,42% das invocações de function), das quais **209** são atribuíveis só a este bug, distribuídas por 9+ rotas de cron distintas observadas diretamente nos logs (a lista completa de rotas afetadas, por inspeção de código, é maior — ver §4).

**Confirmado ainda ativo:** reverifiquei em 2026-08-09 contra `origin/main` (release v0.200.0, o mais recente disponível) — nem a migration, nem o fix estrutural do `withCronAudit` foram aplicados. O outage continua no momento da publicação deste documento.

---

## 2. Causa raiz

### 2.1 Migration nunca criada (drift real de schema, não gap de push)

Commit `2b36cd5d` — *"feat: adicionar observabilidade completa para 24 cron jobs"* (2026-08-07 12:27:25 -0300, co-autor "Cursor") — adicionou a `prisma/schema.prisma`:

```prisma
// prisma/schema.prisma:184-190
enum BackofficeCronStatus {
  running
  success
  failed

  @@map("backoffice_cron_status")
}

// prisma/schema.prisma:1698-1715
model BackofficeCronExecution {
  id           String                  @id @default(cuid())
  cronKey      String                  @map("cronKey") @db.Text
  cronPath     String                  @map("cronPath") @db.Text
  status       BackofficeCronStatus    @default(running)
  startedAt    DateTime                @default(now()) @map("startedAt") @db.Timestamptz(6)
  finishedAt   DateTime?               @map("finishedAt") @db.Timestamptz(6)
  durationMs   Int?                    @map("durationMs")
  errorSummary String?                 @map("errorSummary") @db.Text
  errorDetail  String?                 @map("errorDetail") @db.Text
  metadata     Json?
  createdAt    DateTime                @default(now()) @map("createdAt") @db.Timestamptz(6)
  updatedAt    DateTime                @updatedAt @map("updatedAt") @db.Timestamptz(6)

  @@index([cronKey, status], map: "backoffice_cron_executions_cron_key_status_idx")
  @@index([startedAt], map: "backoffice_cron_executions_started_at_idx")
  @@map("backoffice_cron_executions")
}
```

O mesmo commit adicionou o repositório (`app/api/infra/data/repositories/backoffice/backofficeCronExecution/BackofficeCronExecutionRepository.ts`), o wrapper (`app/api/lib/cron/withCronAudit.ts`), o serviço de notificação Slack, a UI de backoffice (`/backoffice/cron-executions`) e conectou o wrapper em **24 rotas de cron** — mas **não tocou `supabase/migrations/`** (`git show 2b36cd5d --name-only | grep -c supabase/migrations` → `0`).

Confirmado por busca completa no histórico do git: `git log --all -p -- supabase/migrations | grep "backoffice_cron_executions\|backoffice_cron_status"` não retorna nenhum resultado. A tabela e o enum **nunca foram definidos em migration alguma**, em nenhum branch, em nenhum momento — não é um gap de "esqueceram de dar push", é um gap de "a migration nunca foi gerada".

Isso viola diretamente a política de migrations do próprio repositório (`CLAUDE.md`): toda mudança em `prisma/schema.prisma` deve passar por `bun run db:migrate:from-prisma` (schema) ou `bun run db:migrate:new` (DDL manual/observabilidade, como é o caso aqui) antes do merge. `prisma generate` e o typecheck local não detectam esse gap — o Prisma Client é gerado direto do schema, então o código compila e passa em CI normalmente, mascarando o problema até ele explodir em runtime contra o banco real.

### 2.2 Bug estrutural: auditoria de cron é dependência dura da execução do cron

`app/api/lib/cron/withCronAudit.ts` (96 linhas):

```ts
export async function withCronAudit<T>(
  config: CronConfig,
  handler: () => Promise<T>,
  dependencies?: CronDependencies
): Promise<T> {
  const repository = dependencies?.repository ?? backofficeCronExecutionRepository

  const execution = await repository.create({          // <-- SEM try/catch
    cronKey: config.cronKey,
    cronPath: config.cronPath,
    status: "running",
  })

  const start = Date.now()

  try {
    const result = await handler()                      // lógica real do cron
    // ...
    await repository.markSuccess(execution.id, duration, metadata)
    return result
  } catch (error) {
    // ...
    await repository.markFailed(execution.id, errorObj, duration)
    if (dependencies?.onFailure) {
      try {
        await dependencies.onFailure({ ... })            // alerta Slack
      } catch (notificationError) {
        console.error("[CronAudit] Falha ao executar callback de notificação:", notificationError)
      }
    }
    throw error
  }
}
```

`repository.create()` roda **antes** do `try` que envolve `handler()`. Como a tabela não existe, essa chamada lança — e a exceção nunca chega a invocar `handler()`. Consequência: **a lógica de negócio real do cron nunca executa**. Isso não é um problema de log barulhento — é um outage funcional completo de todo cron que usa o wrapper.

**Efeito colateral grave:** o sistema de alerta via Slack (`BackofficeCronSlackNotificationService`, acionado dentro do `catch` de `withCronAudit`) também nunca dispara para este erro específico, porque `create()` quebra *antes* daquele `try/catch` — a equipe não recebeu nenhum alerta apesar de o sistema de alertas existir e estar corretamente implementado para outras falhas.

Confirmado 24 arquivos de rota usando `withCronAudit` via `grep -rln "withCronAudit"`. Todas seguem o padrão `try { ... withCronAudit(...) ... } catch (error) { return 500 }` no nível da rota — o erro se propaga até ali e cada rota devolve HTTP 500 com uma mensagem de erro genérica ("Erro interno no cron de ...").

---

## 3. Reverificação contra a release mais recente (v0.200.0, `origin/main`, 2026-08-09)

Nem a migration nem o fix estrutural chegaram ao `main`, apesar de outro trabalho relacionado ter sido mergeado no mesmo período (PR #703, #704, #709, #710):

```
$ git ls-tree -r origin/main --name-only -- supabase/migrations | grep -i "cron_exec\|cron-exec"
(vazio — migration continua ausente)

$ git show origin/main:app/api/lib/cron/withCronAudit.ts | sed -n '38,50p'
export async function withCronAudit<T>(...): Promise<T> {
  const repository = dependencies?.repository ?? backofficeCronExecutionRepository

  const execution = await repository.create({    // ainda sem try/catch, ainda antes do try do handler
    ...
```

O que **foi** corrigido no mesmo período, por PRs adjacentes que tocaram código de campanha de e-mail (não o cron wrapper em si): `EmailCampaignUseCase.recoverStuckSendingCampaigns` passou a diferenciar campanha órfã (sem dispatch) de dispatch travado — mas isso é lógica de negócio de campanha, não do `withCronAudit`, e não resolve o outage de cron.

---

## 4. Inventário — todas as rotas afetadas

Toda rota de cron que usa `withCronAudit` (confirmado por `grep -rln "withCronAudit"` no código, 24 arquivos) está potencialmente afetada. As que aparecem no array `crons` do `vercel.json` (21 entradas, portanto agendadas ativamente pela Vercel Cron) e cruzam com os logs analisados:

| Rota | Schedule (`vercel.json`) | 500s por `backofficeCronExecution` (24h) | Invocações totais (24h) |
|---|---|---|---|
| `/api/v1/integrations/webhooks/cron/process-outbox` | `* * * * *` (a cada minuto — maior frequência) | 27 | 2.925 |
| `/api/v1/email/cron/process-import-jobs` | `*/5 * * * *` | 6 | 2.902 |
| `/api/v1/email/cron/dispatch-scheduled` | `*/5 * * * *` | 6 | 650 |
| `/api/v1/backoffice/cron/process-email-import-jobs` | `*/5 * * * *` | 6 | 302 |
| `/api/v1/notifications/cron/meeting-reminders` | `*/5 * * * *` | 6 | 298 |
| `/api/v1/notifications/cron/studio-bot-outbox` | `*/5 * * * *` | 6 | 298 |
| `/api/v1/automations/cron/evaluate-idle` | `*/15 * * * *` | 2 | 98 |
| `/api/v1/notifications/cron/lead-status-batch` | `*/15 * * * *` | 2 | 98 |
| `/api/v1/backoffice/cron/dispatch-email-campaigns` | `*/15 * * * *` | 2 | 98 |

**Demais rotas com `withCronAudit` no `vercel.json` (mesma classe de bug, sem volume suficiente na janela de 24h para aparecer isoladamente nos logs, mas com o mesmo defeito estrutural):** `/api/v1/whatsapp/cron/process-outbox` (`*/5`), `/api/v1/whatsapp/cron/sync-contacts` (`*/15`), `/api/v1/whatsapp/cron/ingest-media` (`*/2`), `/api/v1/whatsapp/cron/cleanup-orphan-media` (`0 */6 * * *`), `/api/v1/notifications/cron/task-overdue` (`0 8 * * *`), `/api/v1/notifications/cron/meeting-follow-up` (`0 11 * * *` e `0 17 * * *`), `/api/v1/billing/cron/member-pro-expiration` (`0 6 * * *`), `/api/v1/backoffice/cron/provision-live-campaign` (`0 16 * * 4`), **`/api/v1/backoffice/cron/database-backup`** (`0 8 * * *` — **o backup diário do banco não roda desde 2026-08-07**), `/api/v1/email/cron/reset-credits` (`0 3 1 * *`), `/api/cron/document-request-reminders` (`0 10 * * *`).

**Achado secundário — crons órfãos da configuração:** `radar/cron/engagement-backfill`, `radar/cron/process-import-jobs`, `billing/cron/overdue-reminder` e `studio-bot-ai-rollup` usam `withCronAudit` no código mas **não aparecem no array `crons` do `vercel.json`** — não são agendadas diretamente pela Vercel Cron. Confirmar se são acionadas por outro mecanismo (fila/worker) ou se ficaram órfãs de configuração; fora do escopo de causa raiz deste incidente, mas vale investigação separada.

---

## 5. Impacto quantificado (24h, produção)

- **2.775** linhas de log com `level: error` em produção — **9,96%** de todas as **27.852** linhas de log de produção na janela.
- **273** respostas HTTP 500 no total de invocações de `type: function` (**10.287**) — **1,42%**.
- **209** dessas 500s atribuídas diretamente a `backofficeCronExecution` em 9 rotas com volume suficiente para medir isoladamente (tabela acima).
- **Zero** alertas de Slack disparados para este incidente, apesar do sistema de alerta existir e estar corretamente implementado no `catch` de `withCronAudit` — porque a falha ocorre antes daquele bloco.
- **Backup diário do banco de dados sem rodar** desde 2026-08-07 (rota `database-backup` também usa `withCronAudit`).

---

## 6. Achado de governança/prevenção

Não existe hoje nenhum check em `bun run governance:check` (ou equivalente em CI) que detecte "model novo em `prisma/schema.prisma` sem migration correspondente em `supabase/migrations/`". Esse é exatamente o tipo de drift que permitiu este incidente passar por `typecheck`, `lint` e `governance:check` sem ser pego — `prisma generate` só lê o schema, nunca valida contra o histórico de migrations. Ver `CRON_OBSERVABILITY_SPEC.md` §Prevenção para a proposta de check.

---

## 7. Apêndice — achados relacionados, fora do escopo deste documento

- **Resend: cota mensal de envio excedida** — 95 ocorrências em 24h (`monthly_quota_exceeded`, HTTP 429), bloqueando e-mails reais de lembrete de reunião e convite de membro. Não é bug de código; é operacional (upgrade de plano/monitorar cota via dashboard Resend).
- **Auth `Invalid Refresh Token`** — 4 ocorrências em `/backoffice` e `/crm` na janela de 24h, robustez de sessão, baixo volume — não aprofundado aqui.

Ambos não têm relação causal com o outage de cron descrito neste documento; registrados apenas para não se perderem da leitura dos mesmos logs.
