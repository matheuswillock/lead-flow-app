# Auditoria de Performance — Frontend (Corretor Studio)

**Data:** 2026-07-02
**Escopo:** análise estática (somente leitura) das 15 páginas de maior tráfego + infraestrutura client compartilhada (contexts globais, Sentry, providers).
**Contexto de produção (3 dias, Vercel):** `GET /api/v1/features/access` = 13.150 chamadas (p50 6,3s); `GET /api/v1/notifications` = 7.362 chamadas; tunnel Sentry `/monitoring` = 30.823 requests com 2.641 respostas 429.

**Legenda de severidade:** P0 = impacto direto em custo/latência de produção, corrigir primeiro · P1 = impacto relevante em UX/bundle · P2 = melhoria incremental.

---

## Problemas transversais

### T1. [P0] Polling de `/api/v1/features/access` a cada 60s por aba (`app/context/FeatureAccessContext.tsx`)

O provider está montado no layout protegido (`app/[supabaseId]/layout.tsx`), ou seja, ativo em **todas** as páginas autenticadas. Ele possui:

- `setInterval` de 60s (`ACCESS_POLL_INTERVAL_MS = 60_000`) chamando `fetchAccess()`;
- refetch em `window focus` **e** em `visibilitychange` (os dois disparam juntos ao voltar para a aba);
- TTL de cache de 60s (`ACCESS_CACHE_TTL_MS = 60_000`) — **igual** ao intervalo do poll, então na prática o cache nunca segura o poll: toda iteração do interval refaz o request.

O código segue a governança (request key estável, guard de in-flight, guard de last-success/TTL), mas o poll de 60s anula os guards. Com o endpoint respondendo em p50 6,3s, cada aba aberta gera ~60 chamadas caras por hora. Isso explica sozinho a maior parte das 13.150 chamadas.

**Correção sugerida:**
1. Remover o `setInterval` (flags de acesso raramente mudam em sessão) ou subir para ≥ 15 min.
2. Subir `ACCESS_CACHE_TTL_MS` para 5–15 min, de forma que focus/visibility revalidem só quando o cache está de fato velho.
3. Deduplicar `focus` + `visibilitychange` (disparam em sequência ao retornar à aba; hoje só o guard de in-flight evita chamada dupla).
4. Médio prazo: resolver o acesso no servidor (layout RSC) e hidratar o provider com dados iniciais, revalidando apenas na troca de time (`refresh()` já existe para isso).

### T2. [P0] `NotificationsContext` recarrega a lista completa (limit 100) em excesso (`app/[supabaseId]/notifications/features/context/NotificationsContext.tsx`)

Também montado globalmente no layout protegido. `loadNotifications({ limit: 100 })` (que chama `GET /api/v1/notifications`) é disparado em **todos** estes gatilhos:

- mount / troca de `activeTeamId` (linha 185–192);
- `SUBSCRIBED` do canal realtime (linha 357–361) — ou seja, todo (re)connect gera mais um fetch além do fetch de mount;
- **cada** evento realtime `INSERT` e `UPDATE` (`syncFromServer()` nas linhas 296 e 335) — redundante, pois o payload do evento já é aplicado ao estado local logo em seguida;
- `CHANNEL_ERROR` / `TIMED_OUT` (linhas 362–371), que também agendam reconnect (que ao assinar dispara outro fetch);
- `window focus` **e** `visibilitychange` (linhas 388–408), sem debounce e sem TTL.

Diferente do `FeatureAccessContext`, aqui **não há** guard de in-flight, request key nem last-success no `loadNotifications` — viola a regra de governança de useEffect request discipline. Um time ativo com várias notificações em sequência gera N fetches completos de 100 itens.

**Correção sugerida:**
1. Remover `syncFromServer()` dos handlers de `INSERT`/`UPDATE` (o payload já atualiza o estado) ou trocá-lo por um debounce de ≥ 5s.
2. Adicionar in-flight guard + TTL (ex.: 30–60s) no `loadNotifications`, como já feito no `FeatureAccessContext`.
3. No focus/visibility, consultar apenas `GET /api/v1/notifications/unread-count` (endpoint já existe) e só recarregar a lista se o contador divergir.
4. Evitar fetch duplo no mount: o `SUBSCRIBED` já dispara `syncFromServer`; o effect de mount pode aguardar o canal ou usar request key compartilhada.

### T3. [P0] Sentry client com amostragem máxima (`instrumentation-client.ts`)

```ts
tracesSampleRate: 1,               // 100% das transações
replaysSessionSampleRate: 0.1,     // 10% das sessões com replay
replaysOnErrorSampleRate: 1.0,
enableLogs: true,
consoleLoggingIntegration({ levels: ["log", "info", "warn", "error", "debug"] })
```

- `tracesSampleRate: 1` envia trace de **toda** navegação/request de **todos** os usuários — combinado com o polling dos itens T1/T2, cada poll vira também um evento de trace.
- A `consoleLoggingIntegration` captura `log`, `info` e `debug`. A própria governança do projeto exige `console.info` para logs de fluxo, então todo log de fluxo do app vira evento enviado ao tunnel.
- `replayIntegration()` é importado estaticamente (peso no bundle inicial, ~90KB gz) mesmo para os 90% de sessões que não gravam replay.

Isso explica os 30.823 requests no `/monitoring` e os 2.641 rate limits (429) — eventos pagos que estão sendo descartados.

**Correção sugerida:**
1. `tracesSampleRate: 0.1` (ou `tracesSampler` com taxa menor para rotas de polling).
2. `consoleLoggingIntegration({ levels: ["warn", "error"] })` — remover `log`, `info`, `debug`.
3. `replaysSessionSampleRate: 0.02`–`0.05` e carregar o replay de forma lazy (`Sentry.lazyLoadIntegration("replayIntegration")`).
4. Avaliar `enableLogs: false` se os logs estruturados não estiverem sendo consumidos.

### T4. [P1] Cadeia de providers client bloqueante no layout protegido (`app/[supabaseId]/layout.tsx` + `LayoutContent.tsx`)

`UserProvider → TeamProvider → FeatureAccessProvider → NotificationsProvider → InAppNotificationProvider` são todos client components com fetches encadeados em cascata: bootstrap do usuário → `/api/v1/teams` (TeamProvider depende de `useUser`) → `/api/v1/features/access` (depende de `activeTeamId`) → `/api/v1/notifications`. `LayoutContent` renderiza `GlobalLoading` até user+teams resolverem, bloqueando o conteúdo de **todas** as páginas — nenhum streaming/parcial acontece antes disso. O cache de bootstrap em sessionStorage (`sessionBootstrapCache`) mitiga navegações subsequentes, mas o primeiro paint autenticado paga o waterfall completo.

**Correção sugerida:** resolver usuário + times + acesso no servidor (o layout já é `async` e lê cookies) e passar como `initialData` aos providers; manter fetch client apenas para revalidação. Notificações podem carregar depois do primeiro paint (não devem bloquear).

### T5. [P2] Bibliotecas pesadas importadas estaticamente

- `recharts` importado estático em `app/[supabaseId]/dashboard/features/container/chart-area-interactive.tsx` (entra no bundle inicial do dashboard) e em `.../campanhas/features/components/analytics/DeliverabilityChart.tsx` (entra no bundle de campanhas mesmo com o dialog fechado).
- `components/calendar-studio.tsx` é um componente monolítico grande importado estaticamente pela página de calendário (não usa FullCalendar; usa o Calendar do shadcn — ok, mas o arquivo agrega dialogs, filtros e cards num único chunk).

**Correção sugerida:** `next/dynamic` com `ssr: false` + `Skeleton` para `ChartAreaInteractive`, `CampaignAnalyticsDialog` (todo o dialog, não só o chart) e, se possível, dividir `calendar-studio`.

---

## Achados por página

### 1. `app/page.tsx` (landing) — ✅ bom estado

Server Component puro, dados estáticos, `next/image` no hero com `priority`, JSON-LD inline, runtime client mínimo (`HomeClientRuntime` só faz cookie consent + redirect de token). Sem fetch client. Sem `<img>` cru nos componentes de landing.

- [P2] O hero renderiza **duas** variantes da mesma imagem (`product-banner.svg`) — a mobile (`lg:hidden`, sem `priority`) e a desktop (`hidden lg:flex`, com `priority`). Ambas são baixadas em qualquer viewport (ocultação via CSS) e a variante mobile, que é o LCP em telas pequenas, não tem `priority`. Sugestão: uma única `<Image>` com `sizes` responsivo, ou `priority` + `fetchPriority` na variante mobile.
- [P2] Não há `loading.tsx` na raiz, mas por ser página estática o impacto é nulo.

### 2. `app/lead-form/[supabaseId]/page.tsx` — ✅ bom estado

Server Component com `Suspense` + fallback reutilizando `loading.tsx`. Provider client só do form. Nenhum polling. Sem achados relevantes.

### 3. `app/[supabaseId]/crm/page.tsx`

- [P2] Página inteira `"use client"` apenas para ler `useUserContext` e mostrar um toast de sessionStorage — poderia ser shell server + `CrmPageClient` leaf.
- ✅ `BoardContext` (usado via `CrmContainer → BoardProvider`) segue a governança: `loadKey` estável, `leadsLoadInFlightKeyRef`, guards de last-success e `force` explícito.
- [P2] `useEffect` do toast depende de `searchParams` sem usá-lo — dependência morta que reexecuta o efeito a cada mudança de query string.
- ✅ `loading.tsx` presente.

### 4. `app/[supabaseId]/dashboard/page.tsx`

- [P1] **Sem `loading.tsx`** (única das 15 páginas autenticadas sem) — navegação para o dashboard não faz streaming; o skeleton só aparece após o JS client montar.
- [P1] `fetchMetrics` (`DashboardHook.ts` linha 104) **não tem** guard de in-flight nem request key, e o `useEffect` do `DashboardContext` (linha 98) depende de `dashboardState.fetchMetrics`, cuja identidade muda com `filters`/`customDateRange` (objetos) e `dashboardService` — qualquer render que recrie essas referências refaz as 2 chamadas (`getMetrics` + `getDetailedMetrics`). Viola a regra de request discipline.
- [P1] `recharts` estático via `ChartAreaInteractive` (ver T5).
- [P2] UI de erro usa cores cruas (`text-red-600`, `bg-blue-600`, `text-gray-600`) em vez de tokens semânticos.
- ✅ `Promise.all` para métricas + métricas detalhadas (paraleliza bem), cache de detailed metrics por chave.

### 5. `app/[supabaseId]/pme-simulador/page.tsx`

- [P2] Página `"use client"`; `loadCatalog()` roda em `useEffect` no mount — o catálogo é um dado semi-estático ideal para fetch no servidor (RSC com `revalidate`) ou pelo menos cache client.
- ✅ `loading.tsx` presente. Sem polling.

### 6. `app/[supabaseId]/calendar/page.tsx`

- [P1] Reusa o `BoardProvider` do board completo, ou seja, **carrega todos os leads do pipeline** para renderizar o calendário — payload potencialmente muito maior do que os eventos do período visível. Sugestão: endpoint/fetch por intervalo de datas.
- [P1] `calendar-studio.tsx` é um chunk monolítico estático (dialogs, filtros, task form, lead dialog) — candidato a `dynamic()`/split (ver T5).
- ✅ Guards de fetch herdados do `BoardContext`; `loading.tsx` presente.

### 7. `app/[supabaseId]/docs/page.tsx` — ✅ bom estado

Página server, `DocsContext`/`DocsHook` sem fetch remoto (conteúdo estático). `loading.tsx` presente. Sem achados.

### 8. `app/[supabaseId]/performance/page.tsx`

- ✅ `PerformanceHook` tem `lastFetchKey` ref (guard de last-success) e o fetch é disparado por `filters`/`teamScope` — padrão correto.
- [P2] Página `"use client"` só para o guard de assinatura; shell poderia ser server. Fetch inicial poderia ser pré-carregado no servidor.
- ✅ `loading.tsx` presente.

### 9. `app/[supabaseId]/whatsapp/page.tsx`

- ✅ Página server; hooks com guards síncronos exemplares (`isSendingRef`, `inFlightMessagesConvIdRef`, debounce de busca 400ms).
- [P1] Polling de fallback: quando o realtime está **saudável**, há interval de 60s chamando `refreshUnreadCounts()`; quando **não saudável**, interval de 12s recarrega conversas + mensagens da conversa aberta + unread counts. Se o realtime degradar (como já ocorre com os 429/instabilidades), cada aba gera 5 req/min pesados. Sugestão: backoff progressivo no modo unhealthy (12s → 30s → 60s) e recarregar mensagens só se `lastMessageAt` mudou.
- [P2] Interval extra de 30s durante `historySyncStatus === 'RUNNING'` (aceitável, é transitório) + health publish de 30s no `useWhatsAppRealtime`.
- ✅ `loading.tsx` presente.

### 10. `app/[supabaseId]/carteira/page.tsx`

- [P2] `useEffect(() => { fetchData(filters) }, [fetchData, filters])` — `fetchData` é `useCallback` dependente de contexto; não localizei guard de in-flight/last-success no trecho inicial do hook (diferente de lead-transfers, que tem `lastSuccessKeyRef`). Risco de fetch duplicado em re-renders de contexto. Adicionar request key + in-flight guard.
- [P2] Página `"use client"` para guard de assinatura; vários efeitos de localStorage bem isolados (ok).
- ✅ `loading.tsx` presente.

### 11. `app/[supabaseId]/email/templates/page.tsx`

- ✅ Shell server + provider client (padrão correto). `loading.tsx` presente.
- [P2] `fetchTemplates()` em `useEffect([fetchTemplates])` sem TTL — refaz o fetch em toda remontagem/troca de identidade do callback. Adicionar last-success guard.

### 12. `app/[supabaseId]/email/configuracoes/page.tsx`

- ✅ Shell server + provider client; `loading.tsx` presente.
- [P2] Mesmo padrão: `fetchSettings()` no mount sem guard de dedupe. O endpoint agrega settings + senders + domínio + variáveis — se for uma única chamada, ok; se forem várias sequenciais dentro de `fetchSettings`, paralelizar com `Promise.all` (verificar `EmailSettingsService`).

### 13. `app/[supabaseId]/lead-transfers/page.tsx`

- ✅ `LeadTransfersHook` implementa `lastSuccessKeyRef` (resetado em mudança de filtro) — padrão de governança correto.
- [P2] Página `"use client"` para guard de assinatura; shell poderia ser server. `loading.tsx` presente.

### 14. `app/[supabaseId]/email/contatos/page.tsx`

- ✅ Shell server + provider client; `loading.tsx` presente.
- [P2] `useEffect(() => { void fetchLists() }, [supabaseId])` omite `fetchContacts` do array mas o segundo efeito depende de `fetchContacts` — se a identidade mudar, refaz o fetch da lista selecionada. Adicionar request key.
- ✅ Waterfall lista → contatos é inerente à UX (contatos dependem da lista selecionada).

### 15. `app/[supabaseId]/email/campanhas/page.tsx`

- ✅ Shell server + provider client; `fetchCampaigns` + `fetchCredits` disparados em paralelo no mount; aguarda `teamLoading` antes de buscar. `loading.tsx` presente.
- ✅ `useCampaignAnalytics` é o **exemplo de referência** do repo: request key (`period:campaignId:tz`), `fetchingRef` de in-flight, `lastKeyRef` de last-success, e o poll de 30s só roda com o dialog aberto.
- [P1] `DeliverabilityChart` (recharts) importado estaticamente pelo `CampaignAnalyticsDialog` — entra no bundle da página mesmo sem abrir analytics (ver T5).
- [P2] `CampaignDispatchProgressBanner` tem interval de 700ms, mas é só animação de progresso local (sem rede) — aceitável; considerar CSS animation.

---

## Priorização recomendada

| # | Item | Severidade | Esforço | Impacto |
|---|------|-----------|---------|---------|
| 1 | T1 — remover/alongar poll de features/access + TTL | P0 | Baixo | Elimina ~90% das 13k chamadas do endpoint mais lento (p50 6,3s) |
| 2 | T2 — dedupe/debounce no NotificationsContext | P0 | Baixo | Reduz drasticamente as 7,3k chamadas de /notifications |
| 3 | T3 — amostragem Sentry + níveis de console | P0 | Baixo | Elimina 429s e custo de eventos; reduz bundle (lazy replay) |
| 4 | T4 — bootstrap server-side dos providers | P1 | Médio | Corta o waterfall do primeiro paint autenticado |
| 5 | Dashboard: loading.tsx + guards no fetchMetrics + dynamic recharts | P1 | Baixo | Melhora TTFB percebido e evita fetch duplicado |
| 6 | Calendar: fetch por período + split do calendar-studio | P1 | Médio | Reduz payload e bundle da página |
| 7 | WhatsApp: backoff no polling unhealthy | P1 | Baixo | Evita tempestade de requests quando realtime degrada |
| 8 | Demais P2 (shells client → server, guards de dedupe nos hooks de email/carteira) | P2 | Baixo cada | Higiene e consistência com a governança |
