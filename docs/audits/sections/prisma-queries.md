# Auditoria de Queries Prisma — Pool de Conexões e Hot Paths

**Data:** 2026-07-02
**Escopo:** somente leitura; nenhum arquivo de produção foi alterado.
**Contexto:** produção apresenta `Timed out fetching a new connection from the connection pool` nas queries `profile.findUnique`, `team.findUnique`, `teamMember.findMany`, `teamMember.findUnique`, `emailLog.create`, `teamTransferRoute.findMany`, `backofficeUserSubscription.findMany`, `teamWhatsAppConfig.findFirst`, `lead.findUnique`. Rotas mais quentes: `/api/v1/features/access` (13k/3d), `/api/v1/notifications` (7,3k), `/api/v1/leads/:id/details` (3,3k, p95 19s), `/api/v1/teams/:id/whatsapp/conversations` (1,3k, p95 17s), `/api/v1/teams/:id/members` (742, p95 18s), `/api/v1/leads` (868).

**Diagnóstico central:** o esgotamento do pool não vem de uma query lenta isolada, e sim da **multiplicação de queries de autorização por request** (4–6 queries sequenciais em `getTeamAccess` + re-resoluções redundantes de `profile`/`teamMember` dentro de use cases e repositórios), combinada com **cliente Prisma sem `connection_limit` explícito** em ambiente serverless (`app/api/infra/data/prisma.ts` instancia `new PrismaClient()` sem parâmetros — cada instância Vercel abre `num_cpus*2+1` conexões por padrão) e alguns **índices ausentes** que tornam queries quentes lentas, segurando conexões por mais tempo.

---

## 1. Modelos centrais e índices existentes (`prisma/schema.prisma`)

| Modelo | Linha | Índices/uniques existentes |
|---|---|---|
| `Profile` | 579 | `@unique supabaseId` (implícito pelo `findUnique`); `@@index`: `role`, `managerId`, `sponsorMasterId`, `canSponsorAccounts`, `cpfCnpj`, `googleConnectionId` |
| `Lead` | 1142 | `@@unique(teamId,email)`, `@@unique(teamId,cnpj)`; `@@index` simples: `teamId`, `assignedTo`, `closerId`, `createdBy`, `updatedBy`, `meetingDate`, `followUpAt`, `statusEnteredAt`, `status` — **nenhum composto** |
| `LeadActivity` | 1235 | `@@index(leadId)`, `@@index(createdBy)` — sem `(leadId, createdAt desc)` |
| `Team` | 1533 | `@@index(masterId)` |
| `TeamMember` | 1777 | `@@unique(teamId, profileId)`, `@@index(profileId)` |
| `TeamTransferRoute` | 1798 | `@@unique(sourceTeamId, targetTeamId)` (cobre prefixo `sourceTeamId`), `@@index(targetTeamId)` |
| `Notification` | 1673 | `@@index(recipientProfileId, teamId, isRead)`, `@@index(recipientProfileId, createdAt)`, `@@index(teamId, createdAt)` — sem `(recipientProfileId, teamId, createdAt)` |
| `EmailLog` | 2065 | `@@index(teamId,status)`, `(teamId,campaignId)`, `(campaignId,dispatchId)`, `(teamId,category,sentAt desc)`, `recipientEmail`, `sentAt desc` — cobertura boa |
| `TeamWhatsAppConfig` | 2575 | `@unique teamId`; `@@index(normalizedPhone)`, `@@index(primaryConfigId)` — **sem índice em `webhookSecret` nem `instanceName`** |
| `WhatsAppConversation` | 2619 | `@@unique(configId, externalChatId)`; `@@index(teamId, lastMessageAt desc)`, `(teamId, normalizedPhone)`, `leadId`, `createdByProfileId` — **sem índice em `assignedProfileId`** |
| `WhatsAppMessage` | 2658 | `@@unique(teamId, providerMessageId)`, `@@unique(teamId, providerEventId)`; `@@index(conversationId, createdAt asc)` — **sem índice em `sentByProfileId`** |
| `BackofficeUserSubscription` | 2283 | `@@unique(profileId, productId)`; `@@index(profileId, status)`, `productId`, `adhesionId` — cobertura boa |

---

## 2. Call sites das queries dos erros de pool

### 2.1 `profile.findUnique` (o maior ofensor)

| Arquivo:linha | Rota disparadora | Redundante/cacheável? |
|---|---|---|
| `app/api/v1/utils/teamAccess.ts:38` | Todas as rotas quentes (`features/access`, `notifications`, `whatsapp/conversations`, `unread-count`…) | Ponto legítimo de resolução. O `cache()` do React deduplica apenas dentro do mesmo request/render — não entre requests. Cacheável por sessão curta (ex.: `"use cache"` 30–60s por `supabaseId`). |
| `lib/subscription/isAccountSubscriptionActive.ts:14` | Chamado **dentro** de `getTeamAccess` (linhas 147/190) | **2ª execução de `profile.findUnique` no mesmo request.** Poderia ser incorporada ao select do próprio `resolveProfileForTeamAccess` quando `masterId === profile.id`, ou cacheada por `masterId` (status de assinatura muda raramente). |
| `app/api/infra/data/repositories/featureAccess/FeatureAccessRepository.ts:36` (`findOwnerProfile`) e `:244` (`findCurrentUserRoleInfo`) | `/api/v1/features/access` | **Redundante**: a rota já executou `getTeamAccess`, que resolveu profile, membership e assinatura. `findCurrentUserRoleInfo` refaz `profile.findUnique` + `teamMember.findUnique`; `findOwnerProfile`+`findOwnerProfileSubscription` repetem exatamente `isAccountSubscriptionActive`. Em um miss de cache, o request executa `profile.findUnique` **4x** e `teamMember.findUnique` **2x**. |
| `app/api/v1/leads/[id]/details/route.ts:100` | `/api/v1/leads/:id/details` | Rota chama Prisma direto (violação `Route -> UseCase`, presumivelmente allowlisted) e **depois** `leadUseCase.getLeadById` refaz o lookup (abaixo). |
| `app/api/infra/data/repositories/profile/ProfileRepository.ts:88` (`findBySupabaseId`, **sem `select`** — entidade `Profile` completa, 40+ colunas) via `ProfileUseCase.getProfileInfoBySupabaseId` (`app/api/useCases/profiles/ProfileUseCase.ts:110`) | `/api/v1/leads` (GET), `/api/v1/leads/:id/details` (via `getLeadById`, `LeadUseCase.ts:539`) e a maioria dos fluxos de `LeadUseCase` | **Redundante nos dois hotspots** (o profile já foi resolvido na rota) e retorna a entidade inteira quando só usa 7 campos. |
| `app/api/infra/data/repositories/teamMembers/TeamMembersRepository.ts:13` (`findRequesterProfile`) | `/api/v1/teams/:id/members` | Legítimo como 1ª resolução, mas a rota não usa `getTeamAccess` — padrão de auth duplicado e inconsistente (sem checagem de assinatura/ban). |
| `app/api/v1/backoffice/utils/getBackofficeAccess.ts:42` | Rotas backoffice | OK (1x por request, com `select`). |

### 2.2 `team.findUnique`

| Arquivo:linha | Rota | Avaliação |
|---|---|---|
| `teamAccess.ts:82` (`resolveTeamForSponsorAccess`) | Todas (fallback sponsor) | Só executa quando membership não existe — OK. |
| `TeamMembersRepository.ts:26` (`findTeam`) | `/teams/:id/members` | Executado no fluxo de autorização e **de novo** dentro de `getCachedTeamMembersData` (`TeamMembersUseCase.ts:24`) — 2x por request em miss de cache. |
| `app/api/v1/leads/[id]/details/route.ts:48` | `/leads/:id/details` | Dentro de `"use cache"` 60s — OK. |
| `app/api/infra/data/repositories/whatsapp/WhatsAppRepository.ts:462` (`findTeamMasterContext`) | Fluxos WhatsApp | OK, `select` mínimo. |

### 2.3 `teamMember.findUnique` / `teamMember.findMany`

| Arquivo:linha | Rota | Avaliação |
|---|---|---|
| `teamAccess.ts:53` | Todas as rotas quentes | Ponto legítimo. |
| `FeatureAccessRepository.ts:254` | `/features/access` | **Redundante** (ver 2.1). |
| `leads/[id]/details/route.ts:112` | `/leads/:id/details` | **Sem `select`** — retorna a entidade completa quando só usa `role` e `functions`. |
| `LeadUseCase.ts:629` (`getAllLeadsByUserRole`) | `/leads` (GET) | Necessário no desenho atual, mas duplicaria com `getTeamAccess` se a rota fosse migrada para o helper. |
| `leads/[id]/details/route.ts:30` (`findMany` com `include`) | `/leads/:id/details` | Dentro de cache 60s, mas seleciona `googleConnection.refreshToken` (ver §3). |
| `TeamMembersRepository.ts:74/104` (`findMembers`, `findMasterAccountTeamMembers`) | `/teams/:id/members` | Dentro de cache 60s. `findMembers` também expõe `refreshToken`. |
| `WhatsAppRepository.ts:592` (`getOperatorProfileIdsForTeam`) | `/teams/:id/whatsapp/conversations` (escopo manager) | Executa em **toda listagem** de conversas de manager; resultado muda raramente — cacheável por team. |
| `app/api/services/leadSchedule/participantDispatch.ts:48` | Agendamento de reunião | OK (1 query em lote por emails). |

### 2.4 `emailLog.create`

| Arquivo:linha | Rota/fluxo | Avaliação |
|---|---|---|
| `app/api/infra/data/repositories/emailLog/EmailLogRepository.ts:123` (`createQueuedLog`) ← `lib/email/team-email-dispatch-logger.ts:8` ← `lib/services/EmailService.ts:557` (`sendEmailDirect`) | Todos os envios transacionais (convites de reunião, notificações por e-mail) | 1 `create` por destinatário. O laço `sendEmailWithTeamTrackingPerRecipient` (`EmailService.ts:512`) executa **em série**: `emailLog.create` → HTTP Resend → `emailLog.update` (markSent) por destinatário. Com N destinatários são 2N escritas + N chamadas externas seriais dentro de um único request. Deveria pré-criar os logs via `createManyQueuedLogs` (já existe em `EmailLogRepository.ts:143`) e atualizar status em lote. |
| `app/api/v1/email/cron/dispatch-scheduled/route.ts:208` | Cron de campanhas | Já usa `createMany` + `resend.batch.send` — **correto**; não é a origem do problema. |

### 2.5 `teamTransferRoute.findMany`

| Arquivo:linha | Rota | Avaliação |
|---|---|---|
| `TeamMembersRepository.ts:140` (`findTransferTargets`) | `/teams/:id/members` e `/leads/:id/details` | Em `details` está sob `"use cache"` 60s; em `listMembers` (`TeamMembersUseCase.ts:141`) executa **fora do cache**, a cada request. Dado que rotas de transferência mudam raramente, é altamente cacheável. Índice coberto pelo prefixo do `@@unique(sourceTeamId, targetTeamId)`. |
| `app/api/v1/teams/route.ts:213` | `/teams` (GET) | OK. |
| `app/api/infra/data/repositories/leadTransfer/LeadTransferRepository.ts:212` | Transferências | OK. |

### 2.6 `backofficeUserSubscription.findMany`

| Arquivo:linha | Rota | Avaliação |
|---|---|---|
| `FeatureAccessRepository.ts:66` (`listActiveUserSubscriptions`) | `/features/access` | Sob cache 60s, mas usa `include` (ver §3). Índice `(profileId, status)` cobre o `where`. |
| `app/api/infra/data/repositories/billing/BillingRepository.ts:106` | `/billing/summary` | OK (`select` mínimo, filtrado por `adhesionId: { in }` — indexado). |

### 2.7 `teamWhatsAppConfig.findFirst`

| Arquivo:linha | Rota | Avaliação |
|---|---|---|
| `WhatsAppRepository.ts:99` (`findConfigByWebhookSecret`) | `app/api/webhooks/whatsapp/evolution/[teamToken]/route.ts:32` — **toda mensagem WhatsApp inbound** | **`where { webhookSecret }` sem índice → seq scan a cada webhook.** Alto volume + query lenta = conexões presas. Criar índice único em `webhookSecret`. |
| `WhatsAppRepository.ts:477` (`findConnectedConfigByNormalizedPhone`) | Fluxos de espelhamento | OK — `normalizedPhone` indexado. |
| `WhatsAppRepository.ts:507` (`findConfigByInstanceName`) | Webhooks/sync Evolution | **`instanceName` sem índice** — mesmo problema em menor escala. |

### 2.8 `lead.findUnique`

| Arquivo:linha | Rota | Avaliação |
|---|---|---|
| `leads/[id]/details/route.ts:134` (check de time) | `/leads/:id/details` | OK isolada (select mínimo), mas o mesmo lead é rebuscado logo em seguida por `findById` — 2 buscas do mesmo registro por request. |
| `app/api/infra/data/repositories/lead/LeadRepository.ts:125` (`findById`) | `/leads/:id/details`, `/leads/:id` | **Query mais pesada do sistema**: `include` de todos os escalares do Lead + **todas** as `activities` (sem `take`) com `author` e `reactions` + `_count`. Em leads antigos com centenas de atividades, esta única query explica boa parte do p95 de 19s. `@@index(leadId)` existe, mas falta `(leadId, createdAt desc)` para o `orderBy`. |

---

## 3. Violações de `select` vs `include` — 10 casos mais impactantes

1. **`LeadRepository.findById` (`lead/LeadRepository.ts:125`)** — `include` com `activities` ilimitadas + `reactions` + autores. O DTO de details usa os dados, mas o custo é desproporcional: atividades deveriam ser paginadas (a rota `/leads/:id/activities` já existe). *Retorna muito mais do que o necessário para primeira renderização.*
2. **`leads/[id]/details/route.ts:30`** — `teamMember.findMany` com `include.profile.googleConnection: { refreshToken }`. O DTO só precisa do booleano `googleCalendarConnected`; **trafegar `refreshToken` (segredo OAuth) para montar um boolean é overfetch e risco de segurança**. Bastaria `select { revokedAt, refreshToken: false }` + coluna derivada, ou comparar `refreshToken != null` via `where`.
3. **`TeamMembersRepository.findMembers` (`:74-98`)** — mesmo problema do item 2 (`refreshToken` exposto) na rota `/teams/:id/members`.
4. **`ProfileRepository.findBySupabaseId` (`:88`)** — `findUnique` **sem `select`**: retorna o `Profile` inteiro (endereço, dados Asaas, flags de assinatura etc.) quando `getProfileInfoBySupabaseId` consome 7 campos. Executado em `/leads` e `/leads/:id/details`.
5. **`leads/[id]/details/route.ts:112`** — `teamMember.findUnique` sem `select` (usa só `role`/`functions`).
6. **`FeatureAccessRepository.listActiveFeatures` (`:16`)** — `include: { accessRules: true }` traz todas as colunas de `BackofficeFeatureAccessRule`; o serviço usa `principal` + `accessLevel`. Query roda a cada miss de cache da rota mais quente do sistema.
7. **`FeatureAccessRepository.listActiveUserSubscriptions` (`:66`)** — `include` retorna `BackofficeUserSubscription` completa; o consumo é `product.featureSlug` + validade. Trocar por `select { status, endDate, product: { select: { featureSlug } } }`.
8. **`NotificationService.listByRecipientAndTeam` (`NotificationService.ts:592`)** — `include: { actor: { select … } }` está adequado nos campos, mas o `include` traz também `metadata` Json completa de cada notificação; aceitável, porém vale `select` explícito para blindar o DTO (governança pede `select` por padrão).
9. **`ProfileRepository.findBySupabaseIdWithRelations` (`:96`)** — `include` com `googleConnection.refreshToken` + `operators` completos; usado em fluxos de perfil; overfetch de segredo idem itens 2–3.
10. **`app/api/v1/teams/route.ts` (3 `include`)** — listagem de teams com `include` de membros/relacionamentos; rota de volume moderado, mas cada resposta carrega entidades completas onde o front usa nome/contadores.

---

## 4. N+1 e queries em loop

| Local | Padrão | Impacto |
|---|---|---|
| `lib/services/EmailService.ts:512` (`sendEmailWithTeamTrackingPerRecipient`) | `for` serial por destinatário: `emailLog.create` → HTTP Resend → `emailLog.update`. | 2N queries + N HTTPs por request. Origem provável dos timeouts em `emailLog.create`. Corrigir com `createManyQueuedLogs` + `updateMany`/batch por status. |
| `lib/services/EmailService.ts:689` (`sendEmailWithDispatchTracking`) | Mesmo padrão com `backofficeEmailDispatch` (create + markSent/markFailed por destinatário, serial). | Idem. |
| `FeatureAccessRepository.resolveEmailBetaAccess` (`:155-195`) | Loop `while` subindo a árvore de features com `findUnique` por nível (N queries sequenciais). | Roda no fluxo de `/features/access`; árvore é pequena, mas roda em rota de 13k chamadas — buscar todos os ancestrais numa única query (`findMany` por slugs/ids) ou cachear a árvore de features. |
| `TeamMembersUseCase.listMembers` (`:47-141`) | Cascata **serial** de 5+ queries: `findRequesterProfile` → `findTeam` → `canManageTeamMembers` → `findMembership` → dados cacheados → `findTransferTargets`. | Nenhum é N+1 clássico, mas o waterfall segura 1 conexão por toda a duração; sob pool esgotado, cada etapa espera vaga — explica p95 18s. Paralelizar (`Promise.all`) e mover `findTransferTargets` para o bloco cacheado. |
| `getTeamAccess` (`teamAccess.ts:104-209`) | Cascata serial de 4–5 queries em **todas** as rotas quentes: profile → teamMember → (profile + profileSubscription) → backofficeBannedUser. | ~20k+ execuções/3 dias × 4-5 queries = maior consumidor do pool. `isAccountSubscriptionActive`/`isAccountMasterBanned` são altamente cacheáveis (60s) por `masterId`. |
| `buildConversationVisibilityWhere` (`WhatsAppConversationAccessService.ts:28-67`) | Escopo manager: `getOperatorProfileIdsForTeam` + filtro `messages: { some: { sentByProfileId: { in } } }` (EXISTS em `whatsapp_messages` **sem índice** em `sentByProfileId`). Escopo operator: `getOperatorLeadPhones` carrega todos os telefones de leads do operador a cada request. | Explica p95 17s de `/whatsapp/conversations`. |
| `LeadRepository.findById` (`:151`) | Não é loop, mas `activities.include.reactions` gera join triplo sem limite. | Ver §3 item 1. |

Não foram encontrados loops `for`/`map` com `await prisma` por item em leads/details, teams/members ou envio de campanha (o cron usa batch corretamente).

---

## 5. Lookups duplicados por request (`profile.findUnique` + `teamMember.*`)

Regra de governança: o par não deve executar mais de 1x por request; repositórios devem oferecer variantes `WithCtx`.

| Rota quente | Execuções de `profile.findUnique` por request (pior caso, miss de cache) | `teamMember.findUnique/findFirst` | Usa `getTeamAccess`? | Usa `WithCtx`? |
|---|---|---|---|---|
| `/features/access` | **4** (`teamAccess:38`, `isAccountSubscriptionActive:14`, `findOwnerProfile:36`, `findCurrentUserRoleInfo:244`) | **2** (`teamAccess:53`, `FeatureAccessRepository:254`) | Sim | Não |
| `/notifications` e `/notifications/unread-count` | 2 (`teamAccess` + `isAccountSubscriptionActive`) | 1 | Sim | O contexto é repassado corretamente ao service ✓ |
| `/leads/:id/details` | **2** (rota `:100` + `ProfileRepository:88` via `getLeadById`) | 1 (sem `select`) | Não (auth manual) | Não |
| `/leads` (GET) | 2 (`ProfileRepository:88` sem select + `isAccountSubscriptionActive` não roda — rota não valida assinatura) | 1 (`LeadUseCase:629`) | **Não** | Não |
| `/teams/:id/members` | 2 (`findRequesterProfile:13` + nenhuma validação de assinatura) | 2 (`findMembership:45` + `canManageTeamMembers:60`) | **Não** | Não |
| `/teams/:id/whatsapp/conversations` | 2 (`teamAccess` + `isAccountSubscriptionActive`) | 1–2 (`teamAccess` + `getOperatorProfileIdsForTeam` se manager) | Sim | Contexto repassado ✓ |

Variantes `WithCtx` existem apenas em `MetricsRepository`, `LeadTransferUseCase`/repos e `CdpRepository`. **Nenhuma das rotas quentes usa o padrão** — `FeatureAccessRepository`, `LeadRepository`, `TeamMembersRepository` e `LeadUseCase` re-resolvem identidade internamente.

---

## 6. `$transaction` e escritas em série

- **`listConversations` (`WhatsAppRepository.ts:259`)** e **`listByRecipientAndTeam` (`NotificationService.ts:586`)** usam `$transaction([findMany, count])` para paginação. Não é bug, mas não há necessidade de consistência transacional; segura 1 conexão pelas 2 queries em rotas de altíssimo volume. `Promise.all` simples reduz o tempo de posse da conexão.
- **`leads/[id]/finalize/route.ts:173`** — transação interativa com 6 statements, todos DB, sem chamadas externas. Aceitável.
- **`LeadScheduleService.ts:596`** — as chamadas externas (Google Calendar/Resend) acontecem **antes** da transação; a transação em si é curta. Correto.
- **`EmailLogRepository.applyWebhookEvent` (`:61`)** — transação interativa com até 4 statements (update log, create event, update campaign, update dispatch). Curta, sem I/O externo. OK.
- **Escrita serial que deveria ser batch:** `EmailService.sendEmailWithTeamTrackingPerRecipient` e `sendEmailWithDispatchTracking` (§4). O repositório **já possui** `createManyQueuedLogs` (`EmailLogRepository.ts:143`) — usado só pelo enriquecimento/cron; o caminho quente de envio usa `create` unitário.
- Não foram encontradas transações englobando chamadas HTTP externas.

---

## 7. Índices ausentes (cruzamento where/orderBy × schema)

| Modelo | Query real | Índice sugerido | Justificativa |
|---|---|---|---|
| `Lead` | `findAllByTeamId` (`LeadRepository.ts:685`): `where { teamId, status?, createdAt range } orderBy createdAt desc` — **e sem `take`** | `@@index([teamId, status, createdAt(sort: Desc)])` (+ considerar `[teamId, createdAt(sort: Desc)])` | Hoje o planner escolhe entre `teamId` ou `status` isolados e ordena em memória; rota `/leads` retorna o time inteiro sem paginação. |
| `LeadActivity` | `findById` include `activities orderBy createdAt desc` | `@@index([leadId, createdAt(sort: Desc)])` | Evita sort de centenas de atividades por lead no hotspot p95 19s. |
| `Notification` | `listByRecipientAndTeam`: `where { recipientProfileId, teamId } orderBy createdAt desc` | `@@index([recipientProfileId, teamId, createdAt(sort: Desc)])` | Índices atuais cobrem `(recipient, teamId, isRead)` e `(recipient, createdAt)`, mas nenhum atende filtro duplo + sort — rota de 7,3k chamadas. |
| `TeamWhatsAppConfig` | `findConfigByWebhookSecret` (`:99`): `where { webhookSecret }` | `@@unique([webhookSecret])` (ou index) | Seq scan em **cada webhook inbound** do Evolution. |
| `TeamWhatsAppConfig` | `findConfigByInstanceName` (`:507`): `where { instanceName, primaryConfigId: null }` | `@@index([instanceName])` | Idem, menor volume. |
| `WhatsAppMessage` | Filtro de visibilidade manager: `messages.some.sentByProfileId in (...)` | `@@index([sentByProfileId])` | EXISTS sem índice na tabela com maior crescimento do domínio WhatsApp; afeta `/whatsapp/conversations` p95 17s. |
| `WhatsAppConversation` | `listConversations`: `where { teamId, isArchived, … } orderBy [unreadCount desc, lastMessageAt desc]`; filtros `assignedProfileId` | `@@index([teamId, isArchived, lastMessageAt(sort: Desc)])` e `@@index([assignedProfileId])` | O índice atual `(teamId, lastMessageAt)` não cobre `isArchived` nem o sort por `unreadCount`; `assignedProfileId` aparece em todos os filtros de visibilidade sem índice. |
| `Lead` | `getOperatorLeadPhones`/`findLeadByPhoneInTeam`: `phone contains` | (opcional) índice trigram `pg_trgm` em `phone` via migration manual | `contains` não usa btree; avaliar custo/benefício. |

---

## 8. Observações estruturais

1. **`PrismaClient` sem `connection_limit`** (`app/api/infra/data/prisma.ts:7`): em Vercel serverless, cada lambda cria seu próprio pool com default `num_cpus*2+1`. Com N lambdas concorrentes, o limite do PgBouncer/Supabase é atingido rápido. Recomenda-se `?connection_limit=1&pool_timeout=15` (ou valor baixo) na `DATABASE_URL` com `pgbouncer=true` — consistente com o achado já registrado em `docs/audits/sections/log-analysis.md`.
2. **Rotas quentes fora do padrão `getTeamAccess`** (`/leads`, `/leads/:id/details`, `/teams/:id/members`) duplicam autenticação com queries próprias e pulam validações de assinatura/ban — além de custo, é inconsistência de segurança.
3. **`getTeamAccess` não é cacheado entre requests**: com polling do front (features/access + notifications + unread-count), o mesmo usuário dispara o mesmo pipeline de 4–5 queries várias vezes por minuto. Um cache curto (30–60s) por `supabaseId+teamId` para as partes estáveis (assinatura, ban, membership) removeria dezenas de milhares de queries/dia.

---

## Tabela consolidada

| Query/Call site | Arquivo | Rota afetada | Problema | Correção sugerida | Impacto estimado |
|---|---|---|---|---|---|
| `getTeamAccess` (pipeline: profile + teamMember + profile + profileSubscription + bannedUser) | `app/api/v1/utils/teamAccess.ts:38-209` | Todas as rotas quentes | 4–5 queries sequenciais por request, sem cache entre requests | Cachear assinatura/ban por `masterId` (30–60s); combinar lookups em menos round-trips | **Alto** — maior consumidor do pool (~20k req/3d × 5) |
| `profile.findUnique` + `teamMember.findUnique` redundantes | `FeatureAccessRepository.ts:36,244,254` | `/api/v1/features/access` | Re-resolve identidade já resolvida pela rota (4x profile, 2x teamMember por miss) | Criar variantes `WithCtx` recebendo `TeamContext` do `getTeamAccess` | **Alto** — rota mais quente (13k/3d) |
| `isAccountSubscriptionActive` | `lib/subscription/isAccountSubscriptionActive.ts:13` | Todas via `getTeamAccess` | 2ª execução de `profile.findUnique` no mesmo request | Incorporar campos no select inicial ou cachear por `masterId` | **Alto** |
| `lead.findUnique` com include pesado | `lead/LeadRepository.ts:125` (`findById`) | `/api/v1/leads/:id/details` | Todas as activities sem `take` + reactions + autores; lead buscado 2x na rota | Paginar activities (`take`), select explícito, reutilizar o `leadCheck` | **Alto** — p95 19s |
| `teamMember.findMany` com `googleConnection.refreshToken` | `leads/[id]/details/route.ts:30`; `TeamMembersRepository.ts:74` | `/leads/:id/details`, `/teams/:id/members` | Overfetch de segredo OAuth para derivar um boolean | Selecionar apenas `revokedAt` + existência do token | **Médio** (+ segurança) |
| Waterfall `listMembers` | `TeamMembersUseCase.ts:47-141` | `/api/v1/teams/:id/members` | 5+ queries sequenciais; `findTransferTargets` fora do cache; auth duplicada sem `getTeamAccess` | Paralelizar, mover targets pro bloco cacheado, adotar `getTeamAccess`+ctx | **Médio-alto** — p95 18s |
| `teamWhatsAppConfig.findFirst` por `webhookSecret` | `whatsapp/WhatsAppRepository.ts:99` | `api/webhooks/whatsapp/evolution/[teamToken]` | `where` sem índice → seq scan a cada mensagem inbound | `@@unique([webhookSecret])` (+ índice em `instanceName`) | **Alto** — webhook de alto volume |
| Filtro de visibilidade de conversas | `WhatsAppConversationAccessService.ts:28-67` + `WhatsAppRepository.ts:259` | `/teams/:id/whatsapp/conversations` | EXISTS em `whatsapp_messages.sentByProfileId` sem índice; sort `unreadCount+lastMessageAt` sem índice; `getOperatorLeadPhones` full-fetch por request | Índices `sentByProfileId`, `(teamId,isArchived,lastMessageAt)`, `assignedProfileId`; cachear ids de operadores | **Alto** — p95 17s |
| `lead.findMany` sem paginação | `lead/LeadRepository.ts:685` (`findAllByTeamId`) | `/api/v1/leads` | Retorna todos os leads do time; where sem índice composto | `take`/cursor + `@@index([teamId, status, createdAt desc])` | **Médio-alto** |
| `profile.findUnique` sem `select` | `profile/ProfileRepository.ts:88` | `/leads`, `/leads/:id/details` | Entidade `Profile` completa para 7 campos; redundante com auth da rota | `select` mínimo; aceitar `profileId` do contexto (`WithCtx`) | **Médio** |
| `emailLog.create` em loop serial | `EmailService.ts:512,557` → `EmailLogRepository.ts:123` | Envios transacionais (agendamentos etc.) | create+update por destinatário em série no request | Usar `createManyQueuedLogs` (já existe, `:143`) + updates em lote | **Médio** — origem dos timeouts de `emailLog.create` |
| `notification.findMany/count` | `NotificationService.ts:586-612` | `/api/v1/notifications` | `$transaction` desnecessário; falta índice `(recipient, teamId, createdAt)` | `Promise.all`; novo índice composto | **Médio** — 7,3k chamadas |
| `teamTransferRoute.findMany` | `TeamMembersRepository.ts:140` | `/teams/:id/members`, `/leads/:id/details` | Executa fora de cache em `listMembers`; dado quase estático | Cachear por team (tag já existe) | **Baixo-médio** |
| `backofficeUserSubscription.findMany` com `include` | `FeatureAccessRepository.ts:66` | `/features/access` | `include` retorna entidade completa | `select` mínimo (`status`, `endDate`, `product.featureSlug`) | **Baixo-médio** |
| Loop de ancestrais de feature | `FeatureAccessRepository.ts:155-195` | `/features/access` | `findUnique` sequencial por nível da árvore | Buscar ancestrais em 1 query / cachear árvore | **Baixo-médio** |
| `PrismaClient` sem `connection_limit` | `app/api/infra/data/prisma.ts:7` | Global | Pool default por lambda esgota PgBouncer | `connection_limit=1..3` + `pool_timeout` na URL pooled | **Alto** (config, não código) |
