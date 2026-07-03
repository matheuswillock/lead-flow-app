# Auditoria de Performance — Backend Hotspots

**Data:** 2026-07-02
**Escopo:** Auditoria somente leitura do código em `c:\develop\lead-flow-app`, correlacionada com logs de produção (3 dias, 214k entradas).
**Contexto de infraestrutura:** Next.js 16 (`cacheComponents: true` em `next.config.ts:43`), Prisma + Supabase Postgres (Supavisor), deploy Vercel.

---

## Sumário executivo

O padrão dominante em todos os hotspots é o mesmo: **cada request de API executa 5+ queries Prisma sequenciais só para autorização (`getTeamAccess`), sobre um pool Prisma com configuração default**, que se esgota sob concorrência serverless e produz os erros de `Timed out fetching a new connection from the connection pool` — e esses timeouts de pool (10s default) explicam diretamente os p50 de 4–6s em quase todas as rotas. Em cima disso, três rotas fazem chamadas externas (Evolution API, Google Calendar) **sem timeout no `fetch`**, o que explica os p95 de 17–31s e o estouro de 300s no webhook.

Prioridade sugerida (maior alavancagem → menor):

1. **Pool Prisma** (`connection_limit` + `pool_timeout` na `DATABASE_URL`) — afeta TODAS as rotas.
2. **Cache de `getTeamAccess`** — remove 3–5 queries de cada uma das ~25k requests/dia das rotas mais chamadas.
3. **Webhook Evolution assíncrono (`after()`) + `AbortSignal.timeout` em todos os fetches externos.**
4. Correções pontuais por rota (detalhadas abaixo).

---

## 1. GET /api/v1/features/access — `FeatureAccessUseCase` + `getTeamAccess`

**Bottleneck:** a resolução de features já está cacheada (60s), mas o `getTeamAccess` que a precede executa 5 queries Prisma sequenciais **por request** (13.150 invocações em 3 dias), e duplica a checagem de assinatura/banimento que o serviço de features refaz internamente.

**Evidência:**

- Fluxo por request em `app/api/v1/features/access/route.ts:9-18`: `getTeamAccess(request)` → `featureAccessUseCase.execute(...)`.
- `app/api/v1/utils/teamAccess.ts` — queries sequenciais por request:
  - Linha 104: `resolveProfileForTeamAccess` → `prisma.profile.findUnique` (linhas 37-50);
  - Linha 134: `resolveTeamMembershipForAccess` → `prisma.teamMember.findUnique` (linhas 52-79);
  - Linha 190: `isAccountSubscriptionActive` → 2 queries em paralelo (`profile.findUnique` + `profileSubscription.findUnique`, `lib/subscription/isAccountSubscriptionActive.ts:13-28`);
  - Linha 204: `isAccountMasterBanned` → `backofficeBannedUser.findFirst` (`lib/account/isAccountMasterBanned.ts:4-11`).
  - Total: **5 queries, 4 round-trips sequenciais**, por request, em toda rota `/api/v1`. O `cache()` do React (linha 37) só deduplica dentro do mesmo request.
- A parte cara já está cacheada: `app/api/useCases/featureAccess/FeatureAccessUseCase.ts:13-26` usa `"use cache"` + `cacheLife({ revalidate: 60 })` + `cacheTag`. No MISS, `FeatureAccessService.resolveAllowedSlugs` dispara ~7 queries em paralelo (`FeatureAccessService.ts:85-101`) e **repete** `isAccountSubscriptionActive` + `isAccountMasterBanned` (linhas 126-127) — que o `getTeamAccess` acabou de executar.
- `profile.findUnique` e `teamMember.findUnique` estão entre os principais alvos de `P2024` (pool timeout) nos logs — são as queries mais frequentes do sistema.

**Correção recomendada:**

1. Criar uma função `"use cache"` de curta duração (30–60s) para o trecho "assinatura ativa + banimento" do `getTeamAccess`, chaveada por `accountMasterId` e com `cacheTag` invalidada nos webhooks Asaas/backoffice que mudam assinatura/ban. Isso corta 3 das 5 queries de **todas** as rotas `/api/v1`, não só desta.
2. Opcionalmente, cachear também o par `profile + teamMember` por `supabaseId+teamId` com TTL curto (15–30s) e invalidação por tag em mutações de perfil/time — reduz o custo de autorização a ~0 queries no caso quente.

**Tradeoffs:** mudanças de assinatura/ban/role podem demorar até o TTL para surtir efeito (mitigável com `updateTag`/`revalidateTag` nos pontos de escrita, que já é o padrão do repo). Cache por usuário tem cardinalidade alta, mas os payloads são minúsculos.

**Impacto estimado:** p50 desta rota de 6,3s → sub-500ms no caso quente (resposta vira 0–2 queries); redução de ~40–60% no volume total de queries do banco (o `getTeamAccess` roda em praticamente todas as rotas), aliviando o pool para todo o resto.

---

## 2. Prisma / pool de conexões

**Bottleneck:** `PrismaClient` criado sem parâmetros sobre uma `DATABASE_URL` com `pgbouncer=true` mas **sem `connection_limit` nem `pool_timeout`** — o pool interno do Prisma usa defaults inadequados para serverless e estoura sob concorrência.

**Evidência:**

- `app/api/infra/data/prisma.ts:5-7`:

```5:7:app/api/infra/data/prisma.ts
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient();
```

- `.env.example:16-17`:

```text
DATABASE_URL=postgresql://...@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
```

  Porta 6543 (Supavisor transaction mode) e `pgbouncer=true` estão corretos, mas não há `connection_limit` nem `pool_timeout` em lugar nenhum do repo (busca por `connection_limit|pool_timeout` só encontra docs de skills).
- Sem `connection_limit`, o Prisma abre `num_cpus * 2 + 1` conexões **por instância de função**. Com N instâncias concorrentes na Vercel, isso multiplica rápido e disputa os slots do Supavisor; requests passam a esperar no pool interno do Prisma e falham após o `pool_timeout` default de 10s — exatamente o erro `Timed out fetching a new connection from the connection pool` visto em `profile.findUnique`, `emailLog.create`, etc. A espera de até 10s antes de falhar também explica os p50 de 4–6s generalizados.
- Agravante: `NotificationService.listByRecipientAndTeam` usa `prisma.$transaction` para um `findMany` + `count` (`app/api/services/notifications/NotificationService.ts:586-612`), segurando uma conexão para duas queries que não precisam de transação — 7.362 vezes em 3 dias.

**Correção recomendada:**

1. Adicionar parâmetros à `DATABASE_URL` de produção: `?pgbouncer=true&connection_limit=1&pool_timeout=20` como baseline serverless (com Fluid Compute ativo na Vercel, pode-se testar `connection_limit=3–5`, monitorando o uso de client connections no Supavisor). Documentar em `.env.example`.
2. Reduzir a demanda por conexões: eliminar o `$transaction` desnecessário em notificações e aplicar o cache do item 1 (menos queries = menos disputa de pool). O `withPrismaRetry` existente (`prisma.ts:15-50`) não cobre `P2024`, e não deve cobrir — retry em pool esgotado só piora.

**Tradeoffs:** `connection_limit=1` serializa queries dentro de uma mesma instância — rotas que fazem `Promise.all` de queries enfileiram internamente (latência levemente maior por request), em troca de eliminar o esgotamento global. Ajuste fino exige observar métricas do Supavisor.

**Impacto estimado:** eliminação da classe inteira de erros `P2024` e do "piso" de 4–6s nos p50; é a correção com maior efeito sistêmico da auditoria.

---

## 3. GET /api/v1/leads/[id]/details

**Bottleneck:** lookup de profile duplicado dentro do fluxo + query do lead com `include` de **todas** as activities (sem `take`) com autor e reactions — payload e tempo de query crescem sem limite com o histórico do lead.

**Evidência:**

- A rota já autentica de forma enxuta e paraleliza bem (`app/api/v1/leads/[id]/details/route.ts:100-153`): `profile.findUnique` → `teamMember.findUnique` → `lead.findUnique` (check) em série, depois `Promise.allSettled` de 4 fontes, 3 delas com `"use cache"` de 60s.
- **Lookup duplicado:** dentro do `Promise.allSettled`, `leadUseCase.getLeadById(supabaseId, leadId)` refaz a resolução de profile que a rota acabou de fazer — `app/api/useCases/leads/LeadUseCase.ts:539`: `await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId)` → `prisma.profile.findUnique` de novo (`ProfileUseCase.ts:116`).
- **Query pesada sem limite:** `LeadRepository.findById` (`app/api/infra/data/repositories/lead/LeadRepository.ts:124-179`) usa `include` com:

```151:172:app/api/infra/data/repositories/lead/LeadRepository.ts
        activities: {
          include: {
            author: { ... },
            reactions: { ... },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
```

  Sem `take`: um lead com centenas de activities (comuns em CRM) serializa tudo em cada MISS de cache, incluindo `rawPayload`/campos completos de activity. Isso explica o p95 de 19s e parte dos 63 erros (pool timeout durante a query longa).
- A verificação `leadCheck` (linhas 134-137) faz um `lead.findUnique` extra que poderia ser absorvido pela query principal.

**Correção recomendada:**

1. Limitar activities na query (`take: 50` + endpoint paginado de activities já existe: `[id]/activities/route.ts`) e trocar o `include` amplo por `select` dos campos consumidos pelo DTO — regra que o próprio `agents.md` exige.
2. Passar o `profileId` já resolvido pela rota para `getLeadById` (variante `WithCtx`, padrão TeamContext do governance), eliminando o `profile.findUnique` duplicado.

**Tradeoffs:** limitar activities muda o contrato do DTO (o frontend precisa buscar o restante paginado — a rota de activities já existe). `select` explícito exige manutenção quando o DTO ganha campos.

**Impacto estimado:** p95 de 19s → ~2–4s em leads com histórico longo; redução relevante de transferência de dados e de tempo de conexão ocupada no pool.

---

## 4. POST /api/webhooks/whatsapp/evolution/[teamToken]

**Bottleneck:** todo o processamento do evento (10–15 queries Prisma sequenciais + sync CDP + auto-resposta com chamada à Evolution API **sem timeout e com retry/backoff**) acontece de forma síncrona **antes** de responder o webhook — um fetch pendurado para a Evolution segura a função até o teto de 300s da Vercel.

**Evidência:**

- A rota responde só após o processamento completo: `app/api/webhooks/whatsapp/evolution/[teamToken]/route.ts:62-95` — `await processEvoWebhookUseCase.execute(...)` e só então `NextResponse.json`. Não há `after()`/`waitUntil` (busca no repo: só `webhooks/asaas` e `leads/[id]/transfer-teams` usam `after`), nem `export const maxDuration` — a função herda o limite do plano (300s), e é onde as 32 ocorrências de timeout estouram.
- Cadeia síncrona por mensagem em `ProcessEvoWebhookUseCase.processMessagesUpsertItem` (`app/api/useCases/whatsapp/ProcessEvoWebhookUseCase.ts:160-318`), tudo em série: `resolveTargetTeamContext` (até 3 queries) → `findOrCreateConversation` → `findMessageByProviderMessageId` → `createMessage` → `applyConversationSideEffects` → `findMessageByProviderMessageId` (de novo, linha 262) → `createUsageEvent` → `findConversationById` → `syncWhatsappMessageToCdpUseCase` (3+ upserts CDP, `CustomerDataPlatformService.ts:445+`) → `processWhatsAppInboundAutoResponseUseCase` (mais ~8 queries + **envio de mensagem via Evolution API**).
- Lotes: `handleMessagesUpsert` itera itens **em série** (linhas 155-157) — um upsert com N mensagens multiplica a cadeia inteira.
- Nenhum `fetch` para a Evolution tem timeout: `fetchEvo` (`app/api/services/whatsapp/evo/EvoApiService.ts:26-58`) chama `fetch(url, options)` sem `AbortSignal`; `fetchEvoWithRetry` (linhas 60-88) adiciona até 2 retries com backoff sobre um fetch que pode ficar pendurado indefinidamente. A auto-resposta usa esse caminho (`WhatsAppService.sendAutoResponseMessage` → `evoApiService.sendTextMessage`, `WhatsAppService.ts:572`). Se a Evolution API (self-hosted) não responde nem recusa, a função fica presa até 300s.
- Sob pool esgotado (item 2), cada uma das ~15 queries sequenciais pode esperar até 10s — só o banco já leva o webhook para dezenas de segundos.

**Correção recomendada:**

1. **Responder rápido e processar depois:** validar assinatura/payload, e mover `processEvoWebhookUseCase.execute` para `after()` (Next 16, já usado no webhook Asaas) — respondendo 200 imediatamente. Para garantia de entrega real (redelivery hoje depende do status 500), evoluir para fila (Supabase Queues/QStash) num segundo passo. Nota: o dedupe/dead-letter em memória (`failedEvents`, route.ts:7) não funciona entre instâncias serverless — a fila também resolve isso.
2. **`AbortSignal.timeout(10_000)` em `fetchEvo`** (um único ponto cobre todas as chamadas Evolution do sistema, incluindo os itens 5): falha rápida + fallback já existente nos try/catch.

**Tradeoffs:** com `after()`, falhas de processamento não geram mais 500 para a Evolution reentregar — é preciso confiar no healing por `providerMessageId` já implementado ou adotar fila com retry próprio. Timeout de 10s pode abortar operações legítimas em instâncias Evolution lentas (ajustável por operação).

**Impacto estimado:** p95 de 300s → <1s na resposta do webhook; eliminação dos 32 timeouts e liberação de horas de GB-s de compute; mensagens deixam de ser perdidas por timeout da Vercel.

---

## 5. GET /api/v1/teams/[teamId]/whatsapp/config | unread-count | usage | conversations

**Bottleneck:** o GET de config faz uma chamada **síncrona e sem timeout** à Evolution API (`getConnectionState`, às vezes + `fetchInstance` + updates no banco) em toda requisição; as demais rotas são DB-only e sofrem por `getTeamAccess` + pool.

**Evidência:**

- `config`: `GetWhatsAppConfigUseCase.execute` → `WhatsAppService.getConfig` (`app/api/services/whatsapp/WhatsAppService.ts:195-200`):

```195:200:app/api/services/whatsapp/WhatsAppService.ts
  async getConfig(teamId: string): Promise<ConfigOutput | null> {
    const config = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!config) return null
    const synced = await this.syncConfigWithEvolution(config)
    return toConfigOutput(synced)
  }
```

  `syncConfigWithEvolution` (linhas 202-246) chama `evoApiService.getConnectionState` (fetch sem timeout — `EvoApiService.ts:26-58`), e quando `state === "open"` sem telefone ainda chama `fetchInstance` + validações + `updateConfig` no banco. Uma Evolution lenta trava o GET — coerente com o p95 de 17–31s.
- `unread-count` (`unread-count/route.ts`), `usage` e `conversations` (`conversations/route.ts:14-58`) não tocam a Evolution — o custo é `getTeamAccess` (5 queries) + queries próprias, degradadas pelo pool. `unread-count` e `conversations` são polling do frontend.
- Nenhum desses GETs tem cache (`"use cache"`/ETag), apesar de `cacheComponents` ativo e do padrão já existente no repo (rota de lead details).

**Correção recomendada:**

1. **Timeout no `fetchEvo`** (mesma correção do item 4.2) + **sync condicional**: em `getConfig`, só chamar `syncConfigWithEvolution` se `lastSyncAt` for mais velho que ~30–60s (o campo já é gravado, linha 246); caso contrário retornar o estado persistido. Alternativa equivalente: envolver o resultado em `"use cache"` com `cacheLife({ revalidate: 30 })` + `cacheTag` por config, invalidada pelo webhook `CONNECTION_UPDATE` (que já atualiza o banco — `ProcessEvoWebhookUseCase.handleConnectionUpdate`).
2. **Cache curto para os alvos de polling:** `unread-count` com `"use cache"` de 10–15s chaveado por `teamId` (+ tag invalidada em `conversation-read` e no webhook de mensagem) elimina a maior parte das queries repetidas.

**Tradeoffs:** o status de conexão pode ficar até 30–60s defasado no painel (mitigado pelo webhook `CONNECTION_UPDATE`, que é a fonte em tempo real). Unread-count defasado em 10–15s é imperceptível para o usuário.

**Impacto estimado:** p95 do `config` de 17–31s → <1s (sem chamada externa no caminho quente); polling de unread/conversations deixa de pressionar o pool.

---

## 6. POST /api/v1/calendar/availability

**Bottleneck:** loop **sequencial** por closer chamando Google Calendar `freeBusy` (com refresh de token OAuth por closer), sem timeout no fetch — N closers × (token refresh + freeBusy) em série.

**Evidência:**

- `CalendarAvailabilityService.getAvailability` (`app/api/services/calendarAvailability/CalendarAvailabilityService.ts:133-181`):

```133:155:app/api/services/calendarAvailability/CalendarAvailabilityService.ts
    for (const closerProfile of closerProfiles) {
      // ...
      if (canUseGoogleCalendar) {
        try {
          // ...
          busyIntervals = await getCalendarBusyIntervals({
            organizer: { ... },
            timeMin,
            timeMax,
          });
          usedGoogle = true;
```

  O `await` dentro do `for` serializa as chamadas. Cada `getCalendarBusyIntervals` faz `getValidAccessToken` (podendo disparar `refreshAccessToken` → `fetch(GOOGLE_TOKEN_URL)`, `GoogleCalendarService.ts:81-90`) + `fetch` do `freeBusy` (`GoogleCalendarService.ts:197-204, 261-268`) — ambos **sem `AbortSignal`**.
- O fallback interno já existe (catch nas linhas 156-163 usa `internalBusyByCloser`), mas só é acionado quando o fetch *falha* — um fetch lento/pendurado não cai no fallback, só estoura o p95 (25s) e gera as 15 falhas de freeBusy observadas.

**Correção recomendada:**

1. Paralelizar: trocar o `for` por `Promise.allSettled(closerProfiles.map(...))` — a latência vira a do closer mais lento em vez da soma.
2. `AbortSignal.timeout(5_000)` em `googleCalendarFetch` e `refreshAccessToken`: timeout aciona o catch existente e o fallback interno responde imediatamente. Bônus: o `freeBusy` do Google aceita múltiplos `items` (calendários) em uma única chamada — dá para consolidar closers com o mesmo host num request quando a arquitetura de tokens permitir.

**Tradeoffs:** paralelismo aumenta o pico de chamadas simultâneas ao Google (irrelevante nos volumes atuais; quota do freeBusy é generosa). Timeout de 5s pode acionar fallback interno em redes lentas — comportamento aceitável por design (o fallback já é a degradação prevista).

**Impacto estimado:** p95 de 25s → ~3–5s (1 RTT ao Google em vez de N); falhas de freeBusy passam a degradar graciosamente para a agenda interna em 5s no pior caso.

---

## 7. GET /api/v1/notifications

**Bottleneck:** rota de polling (7.362 chamadas) que paga o `getTeamAccess` completo (5 queries) + um `$transaction` com `findMany` (com `include` de actor) + `count` a cada request, sem nenhum cache ou ETag/304.

**Evidência:**

- `app/api/v1/notifications/route.ts:9-29`: `getTeamAccess(request)` → `notificationUseCase.listNotifications(...)`, resposta JSON completa sempre 200.
- `NotificationService.listByRecipientAndTeam` (`app/api/services/notifications/NotificationService.ts:585-615`): `prisma.$transaction([findMany({ include: { actor } , take: 100 }), count()])` — transação desnecessária segurando conexão do pool, e `limit` default de 100 itens com join de actor a cada poll.
- Não há `"use cache"`, `cacheTag`, `ETag` ou `Cache-Control` — cada poll refaz tudo. p50 de 4s é quase inteiramente pool contention (a query em si é indexável e barata).

**Correção recomendada:**

1. Envolver a listagem em `"use cache"` com `cacheLife({ revalidate: 15 })` chaveada por `profileId+teamId+limit+offset`, com `cacheTag(notifications(profileId, teamId))` invalidada via `updateTag` nos pontos de escrita (`create` de notificação e no `markAllAsRead` da própria rota PATCH). Remover o `$transaction` (duas queries independentes em `Promise.all`).
2. Alternativa/complemento de maior alcance: o frontend já usa Supabase — migrar o polling para Supabase Realtime (a publication `supabase_realtime` já é usada no projeto, cf. migration `20260701210943_whatsapp-realtime-rls.sql`) e manter o GET apenas para carga inicial. Como paliativo barato, suportar `If-None-Match`/304 com ETag derivado de `max(createdAt)+total` para reduzir payload.

**Tradeoffs:** cache de 15s atrasa notificações novas em até 15s se não houver invalidação por tag (com `updateTag` no create, o atraso some para eventos gerados pelo próprio app). Realtime exige trabalho de frontend e RLS.

**Impacto estimado:** p50 de 4s → <300ms no caso quente; ~7k requests/3 dias deixam de disputar o pool (combinado com o item 1, o custo por poll cai para ~0 queries).

---

## Observação transversal — Cache Vercel (122k MISS × 69k HIT)

O ratio ruim de cache é consequência dos itens acima: as rotas mais chamadas (`features/access`, `notifications`, `whatsapp/unread-count`, `whatsapp/conversations`) não emitem cache HTTP nem usam `"use cache"` (exceto features/access, parcialmente). Cada item corrigido com `"use cache"` + `cacheTag`/`updateTag` converte MISS em HIT no data cache. As rotas autenticadas por header (`x-supabase-user-id`) não são elegíveis a CDN cache — o ganho vem do data cache do Next, não do edge.
