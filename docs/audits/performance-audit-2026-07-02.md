# Auditoria de Performance — Corretor Studio

**Data:** 2026-07-02
**Fonte de dados:** logs de produção Vercel (`corretor-studio-log-export-2026-07-02T14-31-40.json`) — 214.485 entradas, 2026-06-29 a 2026-07-02 (3 dias) — cruzados com análise estática do código (backend, queries Prisma, frontend e crítica de design Impeccable das 15 rotas de maior tráfego).
**Escopo:** somente diagnóstico — nenhum código de produção foi alterado.

**Relatórios detalhados (anexos):**

- [Análise dos logs](sections/log-analysis.md)
- [Hotspots backend](sections/backend-hotspots.md)
- [Queries Prisma](sections/prisma-queries.md)
- [Performance frontend](sections/frontend-perf.md)
- [Crítica Impeccable — app](sections/impeccable-app.md)
- [Crítica Impeccable — landing e lead-form](sections/impeccable-brand.md)

---

## 1. Sumário executivo — Top 5 problemas por impacto

### 1.1 Functions em `iad1` (EUA), banco em São Paulo — latência fixa de segundos em toda rota

Todas as invocações de API rodam em `iad1` (Virgínia) enquanto o Supabase está em `aws-1-sa-east-1` (São Paulo). Cada query Prisma paga ~130–150ms de RTT intercontinental; rotas com 5–15 queries sequenciais acumulam segundos de latência **constante**. Evidência: p50 de `features/access` é ~6,3s em **todas** as horas do dia, inclusive madrugada sem tráfego — não é cold start nem carga. Não há `preferredRegion` em nenhuma rota nem configuração de região no projeto.

**Correção:** fixar a região das functions em `gru1` (São Paulo) — configuração de projeto na Vercel ou `regions`/`preferredRegion`. É a mudança com maior alavancagem de toda a auditoria: reduz o "piso" de latência de todas as rotas simultaneamente.

### 1.2 Pool de conexões Prisma esgotando (P2024) — 115 erros em 1 hora no pico

`PrismaClient` criado sem parâmetros ([app/api/infra/data/prisma.ts](../../app/api/infra/data/prisma.ts)) sobre `DATABASE_URL` com `pgbouncer=true` mas **sem `connection_limit` nem `pool_timeout`**. Cada lambda abre `num_cpus*2+1` conexões; sob concorrência os slots do Supavisor esgotam e requests esperam até 10s (default) antes de falhar — o que também explica parte do p50 de 4–6s generalizado. Erros em rajada: 28 em 30/06 20h, 115 em 02/07 13h.

**Correção:** `?connection_limit=1&pool_timeout=20` na `DATABASE_URL` (testar 3–5 com Fluid Compute), mais a redução de demanda dos itens 1.3 e 2.

### 1.3 Autorização executa 4–5 queries sequenciais em toda rota + frontend em polling agressivo

`getTeamAccess` roda `profile.findUnique → teamMember.findUnique → (profile + profileSubscription) → backofficeBannedUser` **em série, por request, sem cache entre requests** — e o frontend chama `features/access` a cada 60s por aba (`FeatureAccessContext` com `setInterval` de 60s e TTL igual ao intervalo, anulando o cache) e `notifications` em todo focus/visibility/evento realtime **sem guard de in-flight**. Resultado: 13.150 + 7.362 chamadas em 3 dias das duas rotas mais caras do sistema. Na rota `features/access`, um miss de cache executa `profile.findUnique` **4x** e `teamMember.findUnique` **2x** (re-resolução redundante no `FeatureAccessRepository`).

**Correção (dupla):** backend — cachear assinatura/ban por `accountMasterId` (30–60s, invalidação por tag) e criar variantes `WithCtx`; frontend — remover/alongar o interval de 60s, subir TTL para 5–15min, e adicionar in-flight guard + TTL no `NotificationsContext`.

### 1.4 Webhook Evolution processa tudo sincronamente — timeouts de 300s e mensagens perdidas

`POST /api/webhooks/whatsapp/evolution/:token` só responde após a cadeia completa (10–15 queries sequenciais + sync CDP + auto-resposta via Evolution API **sem timeout no fetch**). 32 timeouts de 300s e 91 respostas 504 em 3 dias, correlacionados com eventos `CONTACTS.UPDATE`/`CONTACTS.UPSERT` (sync de contatos em massa). Cada execução presa segura conexão do pool. Agravante: `teamWhatsAppConfig.findFirst({ webhookSecret })` faz seq scan (campo sem índice) em toda mensagem inbound.

**Correção:** responder 200 imediatamente e mover o processamento para `after()` (padrão já usado no webhook Asaas); `AbortSignal.timeout(10s)` no `fetchEvo` (cobre todas as chamadas Evolution); índice único em `webhookSecret`.

### 1.5 Chamadas externas sem timeout e Sentry client no máximo

- Rotas WhatsApp (`config` p95 31s) chamam a Evolution API sincronamente sem `AbortSignal`; `calendar/availability` (p95 25s) itera closers **em série** chamando Google Calendar `freeBusy` sem timeout (15 falhas nos logs).
- Sentry client com `tracesSampleRate: 1` (100%), console integration capturando `log/info/debug` e replay estático no bundle: o tunnel `/monitoring` foi o caminho mais acessado do domínio (30.823 requests) com **2.641 respostas 429** — eventos pagos sendo descartados.

**Correção:** timeout em todos os fetches externos + paralelizar o loop de closers; `tracesSampleRate: 0.1`, console só `warn/error`, replay lazy.

---

## 2. Backend — bottleneck por rota

Detalhes completos com evidência arquivo:linha em [sections/backend-hotspots.md](sections/backend-hotspots.md).

| Rota | Volume/p50/p95 | Bottleneck | Correção | Tradeoff |
|---|---|---|---|---|
| GET /api/v1/features/access | 13.150x · 6,3s · 12s | 5 queries de auth por request + re-resolução redundante no repository; a parte cara já tem `use cache` 60s | Cache 30–60s de assinatura/ban por `masterId` + variantes `WithCtx` | Mudança de assinatura/ban demora até o TTL (mitigável com `updateTag`) |
| GET /api/v1/notifications | 7.362x · 4s · 10,7s | `getTeamAccess` completo + `$transaction([findMany include actor, count])` desnecessário a cada poll, sem cache/ETag | `use cache` 15s por `profileId+teamId` com `updateTag` no create; `Promise.all` no lugar da transação; médio prazo, Supabase Realtime | Notificação atrasa até 15s sem invalidação por tag |
| GET /api/v1/leads/:id/details | 3.282x · 6,4s · 19s | `include` de **todas** as activities (sem `take`) com autor+reactions; profile re-resolvido 2x; lead buscado 2x | `take: 50` + `select` explícito; passar `profileId` resolvido (`WithCtx`) | Frontend busca o resto paginado (rota de activities já existe) |
| POST /api/webhooks/whatsapp/evolution/:token | 463x · 2s · **300s** | Processamento síncrono completo antes de responder; fetch Evolution sem timeout com retry | `after()` + resposta imediata; `AbortSignal.timeout(10s)`; fila num 2º passo | Falha de processamento não gera mais 500 para redelivery — confiar no healing por `providerMessageId` ou adotar fila |
| GET /api/v1/teams/:id/whatsapp/config | 117x · 5,1s · 31s | `syncConfigWithEvolution` chama a Evolution em todo GET, sem timeout | Sync condicional por `lastSyncAt` (30–60s) + timeout no `fetchEvo` | Status de conexão até 60s defasado (webhook `CONNECTION_UPDATE` compensa) |
| GET /api/v1/teams/:id/whatsapp/conversations | 1.266x · 4s · 17s | Filtro de visibilidade com EXISTS em `sentByProfileId` **sem índice**; sort sem índice composto; ids de operadores rebuscados por request | Índices (`sentByProfileId`, `teamId+isArchived+lastMessageAt`, `assignedProfileId`) + cache de operadores | — |
| POST /api/v1/calendar/availability | 173x · 6s · 25s | Loop **serial** por closer (token refresh + freeBusy), fetch sem timeout | `Promise.allSettled` + `AbortSignal.timeout(5s)` acionando o fallback interno existente | Fallback interno em redes lentas (degradação prevista por design) |
| GET /api/v1/teams/:id/members | 742x · 6,1s · 18s | Waterfall serial de 5+ queries; `findTransferTargets` fora do cache; auth própria sem `getTeamAccess` (pula validação de assinatura/ban) | Paralelizar, mover targets pro bloco cacheado, adotar `getTeamAccess`+ctx | — |
| Crons (`meeting-reminders` a cada 1min) | 8.117x + execuções em deployments antigos | `lead-status-batch` com p95 de 50–60s competindo pelo pool; invocações duplicadas em deployments anteriores | Revisar necessidade do cron por minuto; investigar crons ativos em deployments não-produção | — |

## 3. Queries Prisma

Tabela completa (16 itens) com call sites em [sections/prisma-queries.md](sections/prisma-queries.md). Destaques:

**Índices ausentes (migration recomendada):**

| Modelo | Índice sugerido | Motivo |
|---|---|---|
| `TeamWhatsAppConfig` | `@@unique([webhookSecret])` + `@@index([instanceName])` | Seq scan em **cada webhook** Evolution |
| `WhatsAppMessage` | `@@index([sentByProfileId])` | EXISTS do filtro de visibilidade de conversas (p95 17s) |
| `WhatsAppConversation` | `@@index([teamId, isArchived, lastMessageAt desc])` + `@@index([assignedProfileId])` | Listagem de conversas |
| `Lead` | `@@index([teamId, status, createdAt desc])` | `/api/v1/leads` retorna o time inteiro sem paginação e sem índice composto |
| `LeadActivity` | `@@index([leadId, createdAt desc])` | Sort de activities no hotspot p95 19s |
| `Notification` | `@@index([recipientProfileId, teamId, createdAt desc])` | Rota de 7,3k chamadas sem índice para filtro duplo + sort |

**Violações de `select` vs `include` mais graves:**

- `LeadRepository.findById` — activities ilimitadas + reactions + autores (query mais pesada do sistema).
- `leads/[id]/details/route.ts:30` e `TeamMembersRepository.findMembers` — **trafegam `googleConnection.refreshToken` (segredo OAuth) para derivar um boolean** (overfetch + risco de segurança).
- `ProfileRepository.findBySupabaseId` — `Profile` completo (40+ colunas) para 7 campos, em rotas quentes.
- `FeatureAccessRepository` — `include` completo de `accessRules` e `BackofficeUserSubscription` na rota mais chamada.

**Outros:**

- `EmailService.sendEmailWithTeamTrackingPerRecipient` — `emailLog.create` + Resend + `update` **em série por destinatário** (origem dos timeouts de `emailLog.create`); `createManyQueuedLogs` já existe e não é usado no caminho quente.
- `$transaction([findMany, count])` desnecessários em notificações e conversas WhatsApp — seguram conexão em rotas de altíssimo volume.
- Rotas quentes fora do padrão `getTeamAccess` (`/leads`, `/leads/:id/details`, `/teams/:id/members`) duplicam auth com queries próprias **e pulam validação de assinatura/ban** (inconsistência de segurança, além de custo).
- Nenhuma rota quente usa variantes `WithCtx` (a regra de governança TeamContext não está aplicada onde mais importa).

## 4. Frontend — performance

Detalhes por página em [sections/frontend-perf.md](sections/frontend-perf.md).

**Transversais:**

- **[P0] `FeatureAccessContext`** — `setInterval` 60s + TTL 60s (cache nunca segura o poll) + refetch em focus **e** visibilitychange. Explica sozinho a maior parte das 13k chamadas.
- **[P0] `NotificationsContext`** — recarrega lista completa (limit 100) em mount, `SUBSCRIBED`, **cada** INSERT/UPDATE realtime (redundante), erro de canal, focus e visibility — **sem guard de in-flight nem TTL** (viola a governança de useEffect).
- **[P0] Sentry client** — `tracesSampleRate: 1`, console `log/info/debug` capturado, replay estático no bundle (~90KB gz). Causa dos 2.641 rate limits no `/monitoring`.
- **[P1] Waterfall de providers** — `UserProvider → TeamProvider → FeatureAccessProvider → NotificationsProvider` em cascata client-side bloqueia o primeiro paint de todas as páginas autenticadas atrás de `GlobalLoading`.
- **[P1] recharts estático** no dashboard e no dialog de analytics de campanhas (entra no bundle mesmo fechado).

**Por página (resumo):** dashboard é a pior (sem `loading.tsx`, fetch sem guards, recharts estático); calendar carrega **todos os leads do pipeline** para renderizar o calendário e usa um monólito de 1.632 linhas; WhatsApp tem polling de fallback de 12s quando o realtime degrada (sem backoff); landing e lead-form estão bem em fetch discipline; os hooks de email/carteira têm dedupe incompleto (P2). O `useCampaignAnalytics` é o exemplo de referência do repo.

## 5. Crítica Impeccable por rota

Relatórios completos: [app (13 rotas)](sections/impeccable-app.md) · [landing + lead-form](sections/impeccable-brand.md).

| Rota | Nota | Destaque |
|---|---|---|
| WhatsApp | 8,5 | Melhor página do app — estados completos, empty state que orienta a próxima ação |
| PME Simulador | 8,0 | Melhor forma/função; único débito: skeletons custom `animate-pulse` |
| Email Templates | 8,0 | Fluxo de listagem bem resolvido; tab bar custom diverge das irmãs |
| Lead Transfers | 8,0 | Badges no padrão-ouro dos tokens semânticos — referência para refatorar as demais |
| CRM | 7,0 | `loading.tsx` retorna `null` na página mais usada (flash em branco diário); `orange-500` raw no botão de presets |
| Docs | 7,0 | 15 ocorrências de `space-y-*`; eyebrows uppercase em série |
| Carteira | 7,0 | Mapa de cores de operadoras em raw ignorando os tokens `--sim-op-*` que o PME já usa |
| Email Campanhas | 7,0 | Aviso de créditos em `amber-*` raw com `dark:` manuais |
| Landing | 6,5 | **`text-md` (classe inexistente) inverte a hierarquia do hero no mobile**; gradient text tricolor (ban); hero-metric sem lastro (`LogoBar` sem logos); form de demo sem `htmlFor`/focus |
| Email Configurações | 6,5 | Header-herói com radius 28px + gradiente + sombra (2 bans) numa tela de tarefa |
| Calendar | 6,0 | Monólito de 1.632 linhas fora de `features/`; cores RSVP raw; 5º estilo de botão destrutivo |
| Email Contatos | 6,0 | **Duas colunas fixas sem colapso mobile** (overflow garantido <768px); badges raw |
| Lead-form | 6,0 | ~4s de página branca + spinner (dupla espera na rota pública de conversão); focus invisível no chip-input (WCAG 2.4.7) |
| Performance | 5,0 | **P0: banner de erro `text-red-300` sobre fundo claro (ilegível)**; chip "há 2 min" **hardcoded/falso**; copy sem acentos |
| Dashboard | 4,0 | **P0: grid `grid-cols-3` fixo quebra no mobile**; 4 famílias de accent + gradientes + emojis (~150 cores raw) — a página mais desalinhada do DESIGN.md |

**Padrões sistêmicos:** ~200 cores raw Tailwind com substituto direto já documentado no DESIGN.md §9; `space-y-*` em 5+ páginas; skeletons custom em 2; três dialetos de tabs; copy sem acentuação em Performance/Docs/PME (o `lint:pt-br` deveria acusar). O app em geral **passa** no slop test — as exceções são Dashboard, o header de Email Configurações e a landing (gradient text + hero-metric + glassmorphism parcial).

## 6. Backlog priorizado

### P0 — corrigir primeiro (impacto sistêmico ou quebra de uso)

1. **Região das functions → `gru1`** (config Vercel). Remove o piso de segundos de todas as rotas.
2. **`connection_limit` + `pool_timeout` na `DATABASE_URL`** e documentar em `.env.example`. Elimina a classe P2024.
3. **Webhook Evolution assíncrono** (`after()` + resposta imediata) + `AbortSignal.timeout` no `fetchEvo` + `@@unique(webhookSecret)`.
4. **Frontend: desligar a tempestade de polling** — interval/TTL do `FeatureAccessContext`, guards no `NotificationsContext`.
5. **Sentry: amostragem** (`tracesSampleRate: 0.1`, console warn/error, replay lazy).
6. **UI:** grid fixo do dashboard (`section-cards-with-context.tsx:468,644`) e banner de erro ilegível do Performance (`PerformanceContainer.tsx:128`).

### P1 — alta alavancagem

7. Cache de assinatura/ban no `getTeamAccess` (30–60s por `masterId`) + variantes `WithCtx` no `FeatureAccessRepository`.
8. `leads/:id/details`: `take` nas activities + `select` explícito + remover lookups duplicados; **parar de selecionar `refreshToken`** (aqui e em `TeamMembersRepository`).
9. Migration de índices (tabela da seção 3).
10. `use cache` + `updateTag` em `notifications` e `whatsapp/unread-count`; remover `$transaction` desnecessários.
11. Timeout + paralelização no Google Calendar (`calendar/availability`); sync condicional no `whatsapp/config`.
12. Bootstrap server-side dos providers do layout autenticado (corta o waterfall do primeiro paint).
13. Lead-form: diagnosticar SSR de 4s (middleware em rota pública) + skeleton com silhueta do form.
14. Landing: `text-md` → `text-base` (1 linha), gradient text → `text-primary` sólido, `htmlFor`/focus no form de demo.
15. Dashboard: `loading.tsx` + guards no `fetchMetrics` + `dynamic()` no recharts; reescrever a Seção 1 no padrão `CarteiraStatsRow`.
16. `EmailService`: batch de `emailLog` (usar `createManyQueuedLogs` no caminho quente).

### P2 — higiene e consistência

17. Varredura mecânica cores raw → tokens semânticos (Carteira/Calendar/Campanhas/Contatos/CRM); `space-y-*` → `gap-*`; skeletons custom → `Skeleton`; unificar tabs e botão de presets.
18. Calendar: fetch por período (em vez do board inteiro) + quebra do monólito `calendar-studio.tsx` em `features/`.
19. Contatos: colapso responsivo do painel de listas.
20. Corrigir acentuação (Performance, Docs, PME, landing) e o chip "há 2 min" hardcoded.
21. Adotar `getTeamAccess` nas rotas quentes que fazem auth própria (`/leads`, `/teams/:id/members`) — segurança + consistência.
22. Revisar cron `meeting-reminders` (1/min) e crons em deployments antigos.

## 7. Plano de verificação (antes/depois)

Baseline registrado nesta auditoria (janela de 3 dias, mesma metodologia de agregação dos logs Vercel):

| Métrica | Baseline | Meta pós-P0/P1 | Como medir |
|---|---|---|---|
| p50 `features/access` | 6,3s | < 500ms | Export de logs Vercel, agregação por rota (mesmo script desta auditoria) |
| p50 geral das rotas /api/v1 | 4–6s | < 800ms | Idem |
| p95 `leads/:id/details` | 19,4s | < 4s | Idem |
| Erros P2024 (pool) | 115/h no pico | 0 | Busca por "Timed out fetching a new connection" nos logs |
| Timeouts 300s webhook Evolution | 32 em 3 dias | 0 | Busca por "Task timed out" |
| p95 webhook Evolution | 300s | < 1s (resposta) | Agregação por rota |
| Chamadas `features/access` | 13.150/3 dias | < 2.000/3 dias | Contagem por rota |
| Chamadas `notifications` | 7.362/3 dias | < 3.000/3 dias | Contagem por rota |
| 429 no `/monitoring` | 2.641/3 dias | ~0 | Contagem por status+rota |
| Cache Vercel HIT ratio | 36% | > 55% | Campo `vercelCache` |

Recomendação de processo: aplicar as mudanças em ondas (região+pool primeiro, depois polling+cache, depois webhook), exportando logs de 24–48h entre ondas para atribuir o ganho a cada mudança. Para as mudanças de UI, validar com Lighthouse (landing e lead-form) e screenshot em 360px (dashboard e contatos).
