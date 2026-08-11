---
name: Auditoria Email Campaigns Radar
overview: Auditoria multi-agente abrangente do sistema de campanhas de e-mail e eventos do Radar, usando MCP Supabase/Vercel/Resend, análise de arquivos HAR, investigação de falhas de entrega, validação de criação de leads e avaliação de estratégia Redis/Upstash para resiliência
todos:
  - id: mcp-auth
    content: Autenticar servidores MCP (Supabase, Vercel, Resend) no Cursor IDE
    status: in_progress
  - id: har-analysis
    content: Analisar arquivos HAR, extrair erros de API e patterns de falha
    status: completed
  - id: resolve-lead-conflict
    content: "✅ RESOLVIDO: Regra é form_started (Fase E correto). Executar E6 após deploy."
    status: completed
  - id: multiskill-campaigns
    content: "Investigar campanhas Rede Dor (Multiskill): entrega sem open/click, órfãos, leads perdidos"
    status: completed
  - id: katherein-campaigns
    content: "Investigar campanhas Katherein: erro de redisparo, logs falhados, eventos Radar"
    status: completed
  - id: radar-events-audit
    content: "Auditar eventos Radar (3 times, 7 dias): volume, gaps, performance, eventos perdidos"
    status: completed
  - id: cache-inventory
    content: "Inventariar cache existente, analisar PR #704, avaliar necessidade Redis/Upstash"
    status: completed
  - id: redis-architecture
    content: "Propor arquitetura Redis: filas (Radar, webhook), cache (score, segmentos), DLQ"
    status: completed
  - id: lead-validation
    content: "Validação retroativa de leads: identificar perdidos ou fantasmas, propor backfill"
    status: pending
  - id: final-report
    content: Consolidar achados, métricas por time, diagnósticos root cause, recomendações priorizadas
    status: completed
isProject: false
---

# Plano de Auditoria — Email Campaigns & Radar (Multi-Agente)

## Contexto Crítico Identificado

### ✅ REQUISITO ESCLARECIDO — Criação de Leads por `form_started`

**Regra de negócio correta (esclarecida):**
> "Se o lead **iniciou** o formulário (`form_started`) ele deveria constar no CRM em nova oportunidade"

**Spec Fase E (implementado, aguardando deploy):**
> E1 corrige o "incidente de leads fantasmas" removendo a criação de leads em `form_viewed`, permitindo apenas em `form_started` e `form_completed`

**Conclusão:** ✅ **O Spec Fase E está CORRETO**. A regra de negócio foi mal especificada inicialmente como "viu o formulário" mas o correto é "iniciou o formulário". Os 52 leads fantasmas de Katherein (criados por `form_viewed`) devem ser tratados conforme script E6 após deploy de E1.

---

## Fase 1: Setup e Autenticação MCP

### 1.1 Autenticar MCP Servers

**Servidores necessários:**
- **Supabase**: acesso ao banco de dados (campanhas, logs, eventos Radar)
- **Vercel**: logs de runtime, erros, latência de rotas
- **Resend** (se disponível): status de webhooks, rate limits

**Ação para o usuário:** Autenticar esses servidores no Cursor Desktop IDE:
1. Abrir Command Palette (Cmd/Ctrl+Shift+P)
2. "MCP: Manage Servers"
3. Autenticar Supabase (projeto: `wcnxwdcoambpfwxwubka`)
4. Autenticar Vercel (projeto: Lead Flow App)

### 1.2 Análise dos Arquivos HAR

**Arquivos:**
- `/home/ubuntu/.cursor/projects/workspace/uploads/www.corretorstudio.com_Archive__26-08-07_12-27-20__faf8.har` (2.835 linhas)
- `/home/ubuntu/.cursor/projects/workspace/uploads/www.corretorstudio.com_Archive__26-08-07_12-27-20__baa1.har` (2.835 linhas)

**Extrair:**
- Requests para `/api/q/*` (campanhas) e `/api/v1/email/*`
- Status codes 4xx/5xx
- Erros de timeout
- Padrões de falha (rate limits, auth errors, validation errors)
- Timestamps de requisições para correlação com logs do servidor

---

## Fase 2: Auditoria das Campanhas — Time Multiskill

### 2.1 Investigação "Rede Dor Mulheres" e "Rede Dor 02"

**Objetivo:** Identificar por que tiveram entregabilidade mas zero taxa de abertura/clique + erros de processamento + possível perda de leads

**Queries SQL via MCP Supabase:**

```sql
-- Buscar campanhas por nome (backoffice ou product)
SELECT id, name, "createdAt", "scheduledAt", "status", 
       "totalRecipients", "totalSent", "totalDelivered", 
       "totalOpened", "totalClicked", "totalBounced", "errorMessage"
FROM "public"."backoffice_email_campaigns"
WHERE name ILIKE '%Rede Dor%'
ORDER BY "createdAt" DESC;

SELECT id, name, "teamId", "createdAt", "scheduledAt", "status",
       "totalRecipients", "totalSent", "totalDelivered",
       "totalOpened", "totalClicked", "totalBounced"
FROM "public"."corretor_studio_email_campaigns"
WHERE name ILIKE '%Rede Dor%'
ORDER BY "createdAt" DESC;

-- Buscar time Multiskill
SELECT t.id, t.name, t."masterId", p.email as master_email
FROM "public"."corretor_studio_teams" t
JOIN "public"."corretor_studio_profiles" p ON t."masterId" = p.id
WHERE t.name ILIKE '%Multiskill%' OR t.name ILIKE '%Multi Skill%';
```

**Para cada campanha encontrada:**

1. **Dispatches:**
```sql
SELECT id, "campaignId", "dispatchedAt", "status", "errorMessage",
       "totalRecipients", "totalSent", "totalFailed"
FROM "public"."backoffice_email_campaign_dispatches"  -- ou corretor_studio_email_campaign_dispatches
WHERE "campaignId" = '<campaign_id>'
ORDER BY "dispatchedAt";
```

2. **Logs de envio (sample de 20):**
```sql
SELECT id, "recipientEmail", "status", "resendEmailId", 
       "sentAt", "deliveredAt", "openedAt", "clickedAt", "errorMessage"
FROM "public"."backoffice_email_logs"  -- ou corretor_studio_email_logs
WHERE "dispatchId" = '<dispatch_id>'
ORDER BY "sentAt" NULLS LAST
LIMIT 20;
```

3. **Eventos de webhook (sample):**
```sql
SELECT el.id, el."recipientEmail", ee."type", ee."occurredAt", ee."metadata"
FROM "public"."backoffice_email_logs" el
JOIN "public"."backoffice_email_events" ee ON ee."logId" = el.id
WHERE el."dispatchId" = '<dispatch_id>'
ORDER BY ee."occurredAt" DESC
LIMIT 50;
```

4. **Órfãos (eventos sem `resendEmailId`):**
```sql
SELECT COUNT(*) as orphan_count
FROM "public"."backoffice_email_logs"
WHERE "dispatchId" = '<dispatch_id>' 
  AND "resendEmailId" IS NULL 
  AND "status" != 'failed';
```

**Cruzar com Vercel logs:**
- Buscar `[ResendWebhookUseCase]` para a janela de tempo do dispatch
- Identificar 429 rate limits, 500 errors, timeouts
- Correlacionar `resendEmailId` dos logs com webhook events

**Análise de leads:**
```sql
-- Leads criados a partir dessa campanha (via Radar attribution)
SELECT l.id, l.name, l.email, l.phone, l.status, l."createdAt",
       l."originChannel", l."originMetadata"
FROM "public"."corretor_studio_leads" l
WHERE l."teamId" = '<multiskill_team_id>'
  AND l."originChannel" = 'public_form'
  AND l."originMetadata"::jsonb->>'attribution' = 'email_campaign'
  AND l."createdAt" BETWEEN '<campaign_scheduledAt>' AND '<campaign_scheduledAt + 7 days>'
ORDER BY l."createdAt";
```

### 2.2 Diagnóstico Esperado

Com base nos achados do `EMAIL_AUDIT.md`:

- **Campanha `sent` com `totalSent = 0`**: estado terminal quebrado
- **Dispatches presos em `sending`**: timeout do Vercel sem recovery
- **Logs `queued` sem `resendEmailId`**: batch nunca processado ou crash mid-dispatch
- **Órfãos de webhook**: race condition (webhook chega antes do persist do `resendEmailId`) OU caminhos de envio sem tags corretas
- **Zero open/click**: possível pixel de tracking quebrado OU emails nunca entregues de fato (Resend API mentiu?)

---

## Fase 3: Auditoria das Campanhas — Time Katherein

### 3.1 Investigação das 3 Campanhas com Erro de Redisparo

**Objetivo:** Identificar por que o botão "Reenviar apenas falhas" retorna erro interno

**Query inicial:**

```sql
-- Time Katherein
SELECT t.id, t.name, t."masterId"
FROM "public"."corretor_studio_teams" t
JOIN "public"."corretor_studio_profiles" p ON t."masterId" = p.id
WHERE p.email ILIKE '%katherein%' OR t.name ILIKE '%katherein%';

-- Campanhas desde o primeiro envio
SELECT id, name, "createdAt", "scheduledAt", "status", "errorMessage",
       "totalRecipients", "totalSent", "totalFailed", "parentCampaignId"
FROM "public"."corretor_studio_email_campaigns"
WHERE "teamId" = '<katherein_team_id>'
ORDER BY "createdAt" ASC;
```

**Para campanhas com `totalFailed > 0`:**

1. **Dispatches com falhas:**
```sql
SELECT id, "campaignId", "dispatchedAt", "status", "errorMessage",
       "totalRecipients", "totalSent", "totalFailed"
FROM "public"."corretor_studio_email_campaign_dispatches"
WHERE "campaignId" = '<campaign_id>'
  AND ("totalFailed" > 0 OR "status" = 'failed')
ORDER BY "dispatchedAt" DESC;
```

2. **Logs com falha (todos):**
```sql
SELECT id, "recipientEmail", "status", "errorMessage", "sentAt", "failedAt"
FROM "public"."corretor_studio_email_logs"
WHERE "dispatchId" = '<dispatch_id>'
  AND "status" = 'failed'
ORDER BY "failedAt" DESC;
```

3. **Pattern de erro:**
```sql
SELECT "errorMessage", COUNT(*) as count
FROM "public"."corretor_studio_email_logs"
WHERE "dispatchId" = '<dispatch_id>' AND "status" = 'failed'
GROUP BY "errorMessage"
ORDER BY count DESC;
```

**Análise do código de redisparo:**

Ler [`EmailCampaignUseCase.ts`](app/api/useCases/email/EmailCampaignUseCase.ts) método `retrySendFailedRecipients` ou similar:

- Validações que podem falhar (credits, domain, window, status lock)
- Query de recipients falhados
- Se existe path de retry ou está quebrado
- Error handling e mensagens retornadas

**Cruzar com Vercel logs (últimos 7 dias):**
- Buscar `[EmailCampaignUseCase]` + `retr` ou `resend` ou `failed`
- Stack traces de erros 500
- Rate limits 429 do Resend no momento do retry

### 3.2 Análise de Logs do Radar (Time Katherein)

**Objetivo:** Validar se tivemos eventos mas não conseguimos processar

**Query de eventos Radar (últimos 7 dias):**

```sql
SELECT 
  re."eventType",
  DATE(re."occurredAt") as event_date,
  COUNT(*) as event_count,
  COUNT(DISTINCT re."profileId") as unique_profiles
FROM "public"."corretor_studio_radar_events" re
JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
WHERE rp."teamId" = '<katherein_team_id>'
  AND re."occurredAt" >= NOW() - INTERVAL '7 days'
GROUP BY re."eventType", DATE(re."occurredAt")
ORDER BY event_date DESC, event_count DESC;
```

**Eventos de formulário + email para Katherein:**

```sql
SELECT 
  re."eventType",
  re."sourceType",
  re."occurredAt",
  re."metadata",
  rp."normalizedEmail",
  rp."normalizedPhone"
FROM "public"."corretor_studio_radar_events" re
JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
WHERE rp."teamId" = '<katherein_team_id>'
  AND re."occurredAt" >= NOW() - INTERVAL '7 days'
  AND (re."eventType" LIKE 'email.%' OR re."eventType" LIKE 'form.%')
ORDER BY re."occurredAt" DESC
LIMIT 200;
```

**Eventos de email sem lead correspondente:**

```sql
-- form_viewed sem lead
SELECT 
  re."eventType",
  re."occurredAt",
  rp."normalizedEmail",
  rp.id as profile_id,
  l.id as lead_id
FROM "public"."corretor_studio_radar_events" re
JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
LEFT JOIN "public"."corretor_studio_radar_identities" ri 
  ON ri."profileId" = rp.id AND ri.type = 'lead_id'
LEFT JOIN "public"."corretor_studio_leads" l 
  ON l.id = ri."normalizedValue"::uuid AND l."teamId" = rp."teamId"
WHERE rp."teamId" = '<katherein_team_id>'
  AND re."occurredAt" >= NOW() - INTERVAL '7 days'
  AND re."eventType" IN ('form.viewed', 'form.started', 'form.completed')
  AND l.id IS NULL  -- sem lead associado
ORDER BY re."occurredAt" DESC;
```

**Cruzar com o incidente Fase E:**

```sql
-- Leads fantasmas Katherein (do audit script)
SELECT l.id, l.name, l.email, l.phone, l."createdAt", l."originMetadata"
FROM "public"."corretor_studio_leads" l
JOIN "public"."corretor_studio_teams" t ON l."teamId" = t.id
WHERE t.name ILIKE '%katherein%'
  AND l."originChannel" = 'public_form'
  AND l."originMetadata"::jsonb->>'attribution' = 'email_campaign'
  AND l."createdAt" >= '2026-08-05'  -- data do incidente
  AND NOT EXISTS (
    SELECT 1 FROM "public"."corretor_studio_public_form_submissions" pfs
    WHERE pfs."leadId" = l.id
  )
ORDER BY l."createdAt";
```

**Esperado:** confirmar os 52 leads afetados mencionados no spec Fase E.

---

## Fase 4: Auditoria dos Eventos do Radar (3 Times)

### 4.1 Análise de Performance e Falhas

**Para cada time (Katherein, Multiskill, Avalanche de Vendas):**

1. **Volume de eventos por tipo (últimos 7 dias):**

```sql
SELECT 
  t.name as team_name,
  re."eventType",
  COUNT(*) as total_events,
  MIN(re."occurredAt") as first_event,
  MAX(re."occurredAt") as last_event
FROM "public"."corretor_studio_radar_events" re
JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
JOIN "public"."corretor_studio_teams" t ON rp."teamId" = t.id
WHERE t.name IN ('Katherein Antunes', 'MultiSkill', 'Avalanche de Vendas Unipessoal Ltda')
  AND re."occurredAt" >= NOW() - INTERVAL '7 days'
GROUP BY t.name, re."eventType"
ORDER BY t.name, total_events DESC;
```

2. **Engagement score distribution:**

```sql
SELECT 
  t.name as team_name,
  CASE 
    WHEN rp."engagementScore" >= 75 THEN 'Quente (75-100)'
    WHEN rp."engagementScore" >= 50 THEN 'Morno (50-74)'
    WHEN rp."engagementScore" >= 25 THEN 'Frio (25-49)'
    ELSE 'Congelado (0-24)'
  END as temperatura,
  COUNT(*) as profile_count,
  AVG(rp."engagementScore") as avg_score
FROM "public"."corretor_studio_radar_profiles" rp
JOIN "public"."corretor_studio_teams" t ON rp."teamId" = t.id
WHERE t.name IN ('Katherein Antunes', 'MultiSkill', 'Avalanche de Vendas Unipessoal Ltda')
GROUP BY t.name, temperatura
ORDER BY t.name, avg_score DESC;
```

3. **Advisory locks e contention (Vercel logs):**

Buscar no Vercel (últimos 7 dias):
- `pg_advisory_xact_lock` + timeout ou lentidão
- `[RadarRepository]` + errors
- `[RadarService]` + `appendEventIfNew` + duplicate key violations (logs Postgres via Supabase)
- `[SyncPublicFormMetricToRadarUseCase]` + errors

4. **Eventos inline vs. cron:**

```sql
-- Eventos de sync manual/backfill (sourceType indica origem)
SELECT 
  "sourceType",
  COUNT(*) as event_count,
  MIN("occurredAt") as first_sync,
  MAX("occurredAt") as last_sync
FROM "public"."corretor_studio_radar_events"
WHERE "occurredAt" >= NOW() - INTERVAL '7 days'
  AND "sourceType" IN ('crm_sync', 'email_sync', 'whatsapp_sync', 'portfolio_sync')
GROUP BY "sourceType";
```

### 4.2 Identificação de Eventos Perdidos

**Hipótese:** inline sync falhou silenciosamente (fire-and-forget + catch-and-log)

**Validação:**

1. **Emails enviados vs. eventos Radar:**

```sql
-- Emails sent (últimos 7 dias, times específicos)
SELECT 
  t.name as team_name,
  COUNT(DISTINCT el.id) as emails_sent
FROM "public"."corretor_studio_email_logs" el
JOIN "public"."corretor_studio_email_campaign_dispatches" ecd ON el."dispatchId" = ecd.id
JOIN "public"."corretor_studio_email_campaigns" ec ON ecd."campaignId" = ec.id
JOIN "public"."corretor_studio_teams" t ON ec."teamId" = t.id
WHERE t.name IN ('Katherein Antunes', 'MultiSkill', 'Avalanche de Vendas Unipessoal Ltda')
  AND el."sentAt" >= NOW() - INTERVAL '7 days'
  AND el."status" != 'failed'
GROUP BY t.name;

-- Eventos email.sent no Radar
SELECT 
  t.name as team_name,
  COUNT(*) as radar_email_events
FROM "public"."corretor_studio_radar_events" re
JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
JOIN "public"."corretor_studio_teams" t ON rp."teamId" = t.id
WHERE t.name IN ('Katherein Antunes', 'MultiSkill', 'Avalanche de Vendas Unipessoal Ltda')
  AND re."occurredAt" >= NOW() - INTERVAL '7 days'
  AND re."eventType" LIKE 'email.%'
GROUP BY t.name;
```

**Gap esperado:** se `emails_sent >> radar_email_events`, confirma que eventos inline foram perdidos.

2. **Leads criados vs. eventos `lead.created`:**

```sql
-- Leads criados (últimos 7 dias)
SELECT 
  t.name as team_name,
  COUNT(*) as leads_created
FROM "public"."corretor_studio_leads" l
JOIN "public"."corretor_studio_teams" t ON l."teamId" = t.id
WHERE t.name IN ('Katherein Antunes', 'MultiSkill', 'Avalanche de Vendas Unipessoal Ltda')
  AND l."createdAt" >= NOW() - INTERVAL '7 days'
  AND l."deletedAt" IS NULL
GROUP BY t.name;

-- Eventos lead.created no Radar
SELECT 
  t.name as team_name,
  COUNT(*) as radar_lead_events
FROM "public"."corretor_studio_radar_events" re
JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
JOIN "public"."corretor_studio_teams" t ON rp."teamId" = t.id
WHERE t.name IN ('Katherein Antunes', 'MultiSkill', 'Avalanche de Vendas Unipessoal Ltda')
  AND re."occurredAt" >= NOW() - INTERVAL '7 days'
  AND re."eventType" = 'lead.created'
GROUP BY t.name;
```

---

## Fase 5: Análise de Cache Existente e Avaliação Redis/Upstash

### 5.1 Inventário de Cache Atual

**Ler arquivos identificados com "cache":**

- [`lib/cache/cacheTags.ts`](lib/cache/cacheTags.ts)
- [`lib/cache/invalidation.ts`](lib/cache/invalidation.ts)
- [`lib/bootstrap/sessionBootstrapCache.ts`](lib/bootstrap/sessionBootstrapCache.ts)
- [`lib/team/teamMembersClientCache.ts`](lib/team/teamMembersClientCache.ts)

**Mapear:**
- Onde é usado cache hoje (React Cache, Next.js cache, in-memory?)
- Tags de invalidação
- TTL configurados
- Padrões de read-through, write-through, cache-aside

**Buscar por `unstable_cache`, `cache`, `revalidate`:**

```bash
rg "unstable_cache|revalidateTag|revalidatePath" -t ts -t tsx --stats
```

### 5.2 Pontos de Contenção Identificados

**Com base no `RADAR_AUDIT.md` e exploration anterior:**

1. **Engagement score recalc**: `updateEngagementScore` lê todos os eventos na janela de 90 dias para cada evento novo → O(N×M) onde N = eventos e M = tamanho da janela
2. **Advisory locks**: `appendEventIfNew` serializa escritas por chave de idempotência → contention sob carga de pixel/form
3. **Segmentos in-memory**: `listSegmentProfileIds` faz full scan de perfis em memória
4. **Webhook Resend enrich**: busca síncrona na API Resend para cada evento órfão (rate limit 429)

### 5.3 Análise de Viabilidade Redis/Upstash

**Casos de uso potenciais:**

| Caso | Estratégia Redis | Ganho esperado | Complexidade |
|------|------------------|----------------|--------------|
| **Fila de eventos Radar** | Bull/BullMQ com Upstash Redis | Alta resiliência (DLQ automática); retry automático; backpressure | 🟡 Média (infraestrutura nova) |
| **Cache de engagement score** | Cache-aside com TTL 5min | Reduz recalcs redundantes (mesmo perfil, múltiplos eventos curto prazo) | 🟢 Baixa |
| **Fila de webhook Resend enrich** | Retry queue com exponential backoff | Evita 429; processa órfãos assincronamente | 🟡 Média |
| **Cache de segmentos** | Materializar audiência + cache | Substitui full scan in-memory por lookup | 🟢 Baixa (já existe `listSegmentProfileIds`, adicionar cache) |
| **Deduplicação de eventos (idempotency)** | Redis SET com TTL 24h | Remove advisory lock; SET O(1) vs. Postgres unique check | 🟡 Média (muda semântica: TTL vs. eterno) |
| **Rate limit global** | Token bucket/sliding window | Protege APIs downstream (Resend, Sentry) | 🟢 Baixa |

**Custo Upstash:**
- Free tier: 10K comandos/dia
- Pay-as-you-go: $0.20 por 100K comandos

**Alternativas já no stack:**
- Vercel KV (Redis) — já provisionado?
- Vercel Queue — beta, nativo
- Supabase Realtime + pg_notify — event sourcing nativo Postgres

**Recomendação preliminar:**

1. **Curto prazo (sem Redis):**
   - Mover `updateEngagementScore` para cron batch (não inline)
   - Mover webhook enrich para cron (processar órfãos em batch, não síncrono)
   - Cache in-process (Map + TTL) para segmentos

2. **Médio prazo (com Redis/Upstash):**
   - Fila de eventos Radar (Bull/BullMQ)
   - Cache distribuído de engagement score
   - DLQ para email dispatch e webhook failures

**Validar decisão com:**
- Vercel analytics: latência p95/p99 das rotas de webhook e Radar
- Supabase logs: contagem de advisory lock waits
- Custo projetado (comandos Redis por evento Radar × volume diário)

### 5.4 Análise do PR #704 (Performance Improvements)

**Branch:** `perf/radar-fast-counts`

**Commits principais:**
- `9d40eb43`: Email cancelamento em fase de entrega
- `2b36cd5d`: Observabilidade para 24 cron jobs
- `88c21a4f`: **Otimizar segmentos com SQL e cache** ← CRÍTICO para avaliação

**Ler diff:**

```bash
git diff origin/perf/radar-fast-counts~2..origin/perf/radar-fast-counts -- \
  'app/api/useCases/radar/*.ts' \
  'app/api/services/radar/*.ts' \
  'lib/radar/*.ts' \
  'lib/cache/*.ts'
```

**Validar:**
- Se já implementou cache de segmentos (tornaria Redis redundante para esse caso)
- Se cron observability ajuda a debugar eventos perdidos
- Se cancelamento de email resolve o problema de dispatches travados

---

## Fase 6: Validação Retroativa de Criação de Leads

### 6.1 Decisão Confirmada — Seguir Spec Fase E

**✅ DECISÃO:** Manter Fase E1 como implementado

**Regra final:**
- `form_viewed` **NÃO** cria lead (evita leads fantasmas de scanners)
- `form_started` **CRIA** lead em `new_opportunity` (primeira interação real)
- `form_completed` **CRIA/ATUALIZA** lead com dados completos

**Implicações:**
1. Os **52 leads fantasmas de Katherein** (+ outros times) devem ser **removidos** via script E6
2. **Nenhum lead foi "perdido"** — leads legítimos são criados em `form_started` (quando a pessoa de fato interage)
3. A auditoria retroativa deve focar em **eventos `form_started` sem lead** (falha real de criação)

**Próximos passos:**
1. Deploy Fase E1-E5 em produção
2. Executar script E6 `--apply` para limpar leads fantasmas (após confirmação final do owner)
3. Monitorar criação de leads via `form_started` por 7 dias

### 6.2 Auditoria de Leads Perdidos (Regra: `form_started`)

**Buscar eventos `form_started` sem lead criado:**

```sql
-- Eventos form.started sem lead correspondente (últimos 7 dias)
SELECT 
  t.name as team_name,
  re."eventType",
  re."occurredAt",
  re."metadata"->>'recipientEmail' as email,
  rp."normalizedPhone" as phone,
  rp.id as profile_id,
  re."metadata" as full_metadata
FROM "public"."corretor_studio_radar_events" re
JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
JOIN "public"."corretor_studio_teams" t ON rp."teamId" = t.id
LEFT JOIN "public"."corretor_studio_radar_identities" ri 
  ON ri."profileId" = rp.id AND ri.type = 'lead_id'
LEFT JOIN "public"."corretor_studio_leads" l 
  ON l.id = ri."normalizedValue"::uuid AND l."teamId" = rp."teamId"
WHERE t.name IN ('Katherein Antunes', 'MultiSkill', 'Avalanche de Vendas Unipessoal Ltda')
  AND re."occurredAt" >= NOW() - INTERVAL '7 days'
  AND re."eventType" = 'form.started'  -- ← mudou de form.viewed para form.started
  AND re."metadata"->>'emailLogId' IS NOT NULL  -- veio de campanha de email
  AND l.id IS NULL  -- sem lead criado
ORDER BY re."occurredAt" DESC;
```

**Para cada lead perdido (falha real de criação):**
- Validar se tem nome + telefone suficiente (gate de criação de `ResolveEmailCampaignFormAttributionUseCase`)
- Verificar se EmailLog existe e está válido
- Checar logs Vercel para exception em `upsertLeadFromEmailRecipient`
- Identificar causa: validation gate falhou, exception silenciosa, ou race condition

### 6.3 Scripts de Correção

**Script 1: Cleanup de Leads Fantasmas (Fase E6)**

**Já existe:** `scripts/audit-fake-email-attribution-leads.ts`

**Executar:**
```bash
# Dry-run — identificar leads fantasmas (form_viewed sem submission real)
bun run audit:fake-email-attribution-leads

# Apply — SOMENTE após E1 em produção + OK do owner
# (Remove os 52 leads de Katherein + outros times afetados)
bun run audit:fake-email-attribution-leads -- --apply
```

**Script 2: Backfill de Leads Perdidos (Se Houver)**

**Se a auditoria encontrar `form_started` sem lead criado:**

Criar `scripts/backfill-form-started-leads.ts`:

**Lógica:**
1. Buscar eventos `form.started` com `emailLogId` válido sem lead (query 6.2)
2. Para cada evento:
   - Resolver EmailLog → recipientEmail, campaign, team
   - Extrair nome + telefone do perfil Radar
   - Validar gates de criação (mesmo de `upsertLeadFromEmailRecipient`)
   - Dry-run: logar o que seria criado
   - Apply: chamar `LeadUseCase.createLead` com `originChannel: 'public_form'`, `originMetadata: { attribution: 'email_campaign', emailLogId }`

**Rodar:**
```bash
# Dry-run primeiro
bun run backfill:form-started-leads -- --dry-run --teams=katherein,multiskill,avalanche

# Apply com confirmação (se houver leads perdidos legítimos)
bun run backfill:form-started-leads -- --apply --teams=katherein,multiskill,avalanche
```

---

## Fase 7: Síntese e Relatório Final

### 7.1 Consolidação de Achados

**Para cada time (Multiskill, Katherein, Avalanche):**

| Métrica | Valor | Status |
|---------|-------|--------|
| Campanhas auditadas | X | |
| Emails enviados (totalSent) | X | |
| Taxa de entrega real (delivered / sent) | X% | |
| Taxa de abertura (opened / delivered) | X% | 🔴/🟡/🟢 |
| Taxa de clique (clicked / opened) | X% | 🔴/🟡/🟢 |
| Órfãos (logs sem resendEmailId) | X | |
| Dispatches travados | X | |
| Eventos Radar perdidos | X | |
| Leads criados por campanha | X | |
| Leads fantasmas (se Fase E) | X | |
| Leads perdidos (se regra `form_viewed`) | X | |

### 7.2 Diagnósticos por Categoria

**Campanhas de Email:**
- [ ] Race condition webhook vs. persist `resendEmailId`
- [ ] Dispatches travados sem recovery
- [ ] Rate limit 429 Resend
- [ ] Campanha `sent` com 0 enviados
- [ ] Órfãos de webhook (tags incorretas)
- [ ] Enrichment síncrono causando 429

**Radar:**
- [ ] Eventos inline perdidos (fire-and-forget failures)
- [ ] Advisory locks sob contenção
- [ ] Engagement score recalc em toda inserção (performance)
- [ ] Segmentos in-memory lento
- [ ] Sem DLQ para eventos falhados

**Criação de Leads:**
- [ ] ✅ Requisito esclarecido: `form_started` cria lead (Fase E correto)
- [ ] Leads fantasmas de scanners (`form_viewed`) — 52+ identificados, script E6 pronto
- [ ] Leads perdidos por falha inline (`form_started` sem lead) — verificar na auditoria
- [ ] Gate de validação (nome+telefone) — pode bloquear criação legítima

### 7.3 Recomendações de Arquitetura

**Email Campaigns:**
1. **Implementar recovery de dispatches travados** (cron detecta `sending > 30min` → retry ou fail explícito)
2. **Webhook idempotente real** (upsert em vez de create, já corrigido em Fase E5)
3. **Enrich assíncrono** (cron processa órfãos em batch, não síncrono no webhook)
4. **Circuit breaker para Resend** (parar dispatch em 429, não marcar todos como failed)
5. **Persist `resendEmailId` ANTES de retornar 200 ao Resend** (evita órfãos por race)

**Radar:**
1. **Fila de eventos com Redis/Upstash** (Bull/BullMQ) + DLQ
2. **Engagement score batch** (cron a cada 15min, não inline em cada evento)
3. **Segmentos materializados + cache** (SQL + Redis/in-memory TTL 5min)
4. **Remover advisory locks** (usar Redis SET para idempotency, TTL 24h)
5. **Alerting de eventos perdidos** (Sentry: gap entre email_sent e radar email.sent)

**Redis/Upstash:**
- **Prioridade 1:** Fila de eventos Radar (maior impacto em resiliência)
- **Prioridade 2:** Cache de engagement score (maior impacto em performance)
- **Prioridade 3:** Fila de webhook enrich (resolve 429)
- **Não urgente:** Dedup com Redis SET (advisory locks funcionam, só contendem sob carga extrema)

### 7.4 Entregáveis

1. **Relatório consolidado** (`AUDIT_REPORT_2026_08_07.md`):
   - Métricas por time e campanha
   - Diagnósticos detalhados com evidências (queries SQL, logs Vercel, HAR)
   - Root causes confirmadas
   - Recomendações priorizadas

2. **Scripts de correção**:
   - ✅ `scripts/audit-fake-email-attribution-leads.ts` (já existe — E6)
   - `scripts/backfill-form-started-leads.ts` (criar se houver leads perdidos legítimos)
   - `scripts/recover-stuck-dispatches.ts` (criar se houver dispatches travados)

3. **Spec de implementação Redis** (`REDIS_QUEUE_SPEC.md`):
   - Arquitetura de filas (Bull/BullMQ)
   - Upstash config + custo projetado
   - Migration plan (features incrementais)
   - Rollback strategy

4. **Dashboard de observabilidade**:
   - Vercel Analytics: p95 latência webhook, Radar inline
   - Sentry: alertas de gap eventos
   - Supabase: queries de health check (órfãos, travados, eventos perdidos)

---

## Execução Multi-Agente

**Agentes em paralelo:**

1. **Agent HAR Analyzer**: Parse HAR files, extract errors, correlate with server logs
2. **Agent Campaign Investigator (Multiskill)**: SQL queries, Vercel logs, diagnose Rede Dor campaigns
3. **Agent Campaign Investigator (Katherein)**: SQL queries, diagnose retry failures, find root cause
4. **Agent Radar Auditor**: Event volume, gaps, performance bottlenecks, identify lost events
5. **Agent Cache Architect**: Inventory current cache, evaluate Redis use cases, analyze PR #704
6. **Agent Lead Validator**: Identify conflict, query lost/phantom leads, propose backfill strategy

**Sequencial (após paralelo):**

7. **Agent Report Synthesizer**: Consolidate findings, create final report, prioritize recommendations

**Estimativa:** 6 agentes paralelos × ~15min cada = ~15min wall-clock (dependendo de MCP auth)

---

## Próximos Passos Imediatos

1. **Usuário autentica MCPs** (Supabase, Vercel)
2. ~~**Usuário resolve conflito de requisitos**~~ ✅ **RESOLVIDO:** `form_started` cria lead (Fase E correto)
3. **Iniciar execução multi-agente**
4. **Review intermediate findings** (após Fase 4)
5. **Aprovar correções/backfills** (após Fase 6)
6. **Implementar Redis** (após Fase 5 avaliação)
