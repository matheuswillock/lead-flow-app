# Especificação — Módulo Discadora Automática (Twilio)

**Versão:** 2.0.0
**Data:** 2026-06-11
**Status:** Plano de implementação aprovado
**Produto:** Lead Flow — Corretor Studio
**Substitui:** v1.1.0 (2026-03-30, branch `claude/twilio-auto-dialer-G9DOm`)

---

## 1. Visão Geral

O módulo de **Discadora Automática** permite que operadores executem campanhas de ligações para uma base de contatos pré-carregada. O sistema utiliza **Twilio Programmable Voice** para gerenciar as ligações, detectar atendimento, transferir chamadas ao vivo para o operador (WebRTC no browser) e gravar as conversas. **Cada operador visualiza em tempo real, num painel do time, todas as ligações ativas da campanha** (quem disca, para quem, status, duração), além da própria chamada conectada.

### Decisões de produto

- Provedor: **Twilio** (subconta por time — sem número compartilhado entre times).
- Pool de contatos: **upload de Excel (.xlsx) e JSON**.
- Tempo real: **painel do time + própria chamada** via Supabase Realtime (broadcast).
- Billing: add-on por time via **Asaas**.
- Feature **gerenciada pelo backoffice** com slug próprio, no mesmo modelo de Email e CRM.
- Gravação de ligação que origina um lead é **anexada ao lead e não pode ser removida**.
- Jobs assíncronos com **Upstash QStash** (infra compartilhada com o disparo agendado de email).

### Fluxo principal

```
Manager sobe base de contatos (.xlsx / .json)
        ↓
Operador inicia o discador para o time
        ↓
Twilio liga para o próximo contato da fila
        ↓
[Atendido em até 15s?]
  ├── SIM → Transfere para o operador (Conference) + inicia gravação
  └── NÃO → Registra tentativa, avança para o próximo contato
        ↓
Painel do time atualiza em tempo real a cada transição de estado
        ↓
Ao final: relatório de todas as ligações + gravações disponíveis
```

### Relação com o webhook 3C Plus

`app/api/webhooks/3cplus/route.ts` (develop) tem propósito distinto: **receber leads no CRM a partir de ligações já finalizadas no 3C Plus**. É um canal de entrada de leads independente da discadora e permanece intocado.

---

## 2. Nome e gestão da feature (backoffice)

A discadora é uma feature gerenciada no backoffice com slug próprio, replicando o modelo de Email e CRM.

**Nome recomendado: "Studio Voice"** — produto `voice`, alinhado ao branding "Corretor Studio" e extensível para evoluções de telefonia (URA, SMS, click-to-call no CRM). Alternativas: "Central de Ligações" (slug `call-center`) ou "Discadora" (slug `dialer`). Esta spec usa `voice`.

1. `lib/features/feature-slugs.ts`: `VOICE: "voice"`, `VOICE_CAMPAIGNS: "voice-campaigns"`, `VOICE_HISTORY: "voice-history"` (sub-features hierárquicas como `EMAIL_*`).
2. `lib/features/feature-product-slug-map.ts`: `[FEATURE_SLUGS.VOICE]: "voice"` (e sub-features).
3. `lib/features/feature-route-access.ts`: `{ prefix: "/dialer", slug: FEATURE_SLUGS.VOICE }`.
4. Registro no banco via backoffice (API/UI): criar `BackofficeProduct` slug `voice` + `POST /api/v1/backoffice/features` com `{ name: "Studio Voice", slug: "voice", productSlug: "voice", accessMode: "PAID" }` e sub-features com `parentId`.
5. `BackofficeFeatureAccessRule`: MASTER/MANAGER → FULL; OPERATOR/SDR/CLOSER → FULL na operação de discagem (criação de campanha continua restrita a manager pela API).
6. Sidebar (`components/app-sidebar.tsx`): item com `featureSlug: FEATURE_SLUGS.VOICE` + `hasAccess()`; `"/dialer"` em `protectedPrefixes` no `proxy.ts`.

O gate de billing (assinatura Asaas do add-on) é `Team.dialerEnabled` + `DialerSubscription`; o slug do backoffice controla visibilidade/rollout (beta via `BackofficeFeatureGrant`), exatamente como Email.

---

## 3. Banco de dados

Migrations via Supabase CLI (`bun run db:migrate:new <nome>`; SQL idempotente; schema Prisma → `bun run prisma:db:push` local → `bun run db:diff`). Nada aplicado no remoto sem autorização do owner.

### Novos enums e modelos Prisma

- `DialerCampaignStatus`: `draft | ready | running | paused | completed | canceled | limit_reached`.
- `DialerCallStatus`: `pending | calling | answered | transferred | completed | no_answer | busy | failed | machine`.
- `DialerPlan`: `dialer_basic | dialer_pro | dialer_unlimited`.
- `DialerCampaign` → `@@map("corretor_studio_dialer_campaigns")`: teamId, managerId, name, description, status, totalContacts, contactsProcessed, contactsAnswered, minutesUsed.
- `DialerContact` → `corretor_studio_dialer_contacts`: campaignId, name, phone (E.164), email?, metadata Json, processed, position. Índice `[campaignId, processed]`.
- `DialerCall` → `corretor_studio_dialer_calls`: campaignId, contactId, operatorId, twilioCallSid @unique, status, durationSeconds, recordingSid/Url/Path, startedAt/answeredAt/transferredAt/endedAt, notes, `leadId String? @db.Uuid` (lead criado a partir da ligação, FK para `Lead` com `onDelete: SetNull`).
- `DialerUsage` → `corretor_studio_dialer_usage`: `@@unique([teamId, billingMonth])`, minutesUsed, minutesLimit, callsCount.
- `DialerSubscription` → `corretor_studio_dialer_subscriptions`: teamId @unique, plan, status, asaasSubscriptionId, currentPeriodStart/End, monthlyMinutes (modelo `EmailCreditSubscription`).
- Campos novos em `Team`: `dialerEnabled`, `twilioSubaccountSid`, `twilioSubaccountToken` (cifrado), `twilioApiKeySid`, `twilioApiKeySecret` (cifrado), `twilioAppSid`, `twilioNumberSid`, `twilioPhoneNumber`. **Não** adicionar token Twilio em `Profile` (a v1.1.0 previa; token de client é efêmero — anti-pattern persisti-lo).
- Campo novo em `LeadAttachment`: `isProtected Boolean @default(false)` — anexos protegidos (gravações de ligação que originaram o lead) não podem ser excluídos; `LeadAttachmentService.deleteAttachment` recusa quando `isProtected = true`.

### SQL manual nas migrations

- `enable row level security` nas tabelas novas, sem policies de SELECT para o client (acesso só via API; o painel realtime usa broadcast, não postgres_changes — não adicionar à publication `supabase_realtime`).
- Índice único parcial — 1 chamada ativa por operador: `create unique index ... on corretor_studio_dialer_calls ("operatorId") where status in ('calling','answered','transferred')` (Prisma não expressa índice parcial).
- Policy de canal privado em `realtime.messages`: SELECT para `authenticated` quando `realtime.topic() like 'dialer:team:%'` e o usuário pertence ao time (join `corretor_studio_team_members` × `corretor_studio_profiles` por `auth.uid()`).

---

## 4. Backend

### Rotas

| Rota | Método | Papel |
|---|---|---|
| `api/v1/dialer/campaigns` | GET/POST | listar / criar campanha (POST: manager) |
| `api/v1/dialer/campaigns/[campaignId]` | GET/PUT/DELETE | detalhe/edição (mutações: manager) |
| `api/v1/dialer/campaigns/[campaignId]/contacts` | GET | contatos paginados |
| `api/v1/dialer/campaigns/[campaignId]/contacts/upload` | POST | upload Excel (.xlsx) ou JSON (manager) |
| `api/v1/dialer/campaigns/[campaignId]/start` / `pause` | POST | iniciar/pausar (operator) |
| `api/v1/dialer/campaigns/[campaignId]/live` | GET | snapshot p/ sync do painel realtime (sem cache) |
| `api/v1/dialer/campaigns/[campaignId]/calls` | GET | histórico (operador vê só as próprias) |
| `api/v1/dialer/calls/[callId]/recording` | GET | signed URL da gravação |
| `api/v1/dialer/calls/[callId]/create-lead` | POST | cria Lead no CRM a partir da ligação + anexa gravação |
| `api/v1/dialer/token` | GET | Access Token Twilio Client do operador |
| `api/v1/dialer/subscription` | POST/DELETE | ativar/cancelar add-on (manager) |
| `api/v1/dialer/cron/reconcile` | GET | watchdog scanner (auth `CRON_SECRET`) |
| `api/webhooks/twilio/voice` | POST | TwiML (Conference quando `AnsweredBy=human`) |
| `api/webhooks/twilio/status` | POST | atualiza `DialerCall`, soma minutos, dispara próxima discagem, broadcast |
| `api/jobs/dialer/reconcile-call` | POST | worker QStash do watchdog |
| `api/jobs/dialer/archive-recording` | POST | worker QStash de migração de gravação |

Todas as rotas `/api/v1/dialer/*` usam `getTeamAccess()` (`app/api/v1/utils/teamAccess.ts`) e propagam `TeamAccess` (Route → UseCase → Service → Repository `WithCtx`), retornando `Output` (`lib/output/index.ts`).

### Camadas

- UseCases (`app/api/useCases/dialer/`): `CreateCampaignUseCase`, `UploadContactsUseCase`, `StartDialerUseCase`, `DialNextContactUseCase`, `DialerCallProgressUseCase`, `CreateLeadFromCallUseCase`, `ActivateDialerUseCase` (todos com interface `I*`).
- Services (`app/api/services/`): `Twilio/TwilioSubaccountService` (criar subconta, comprar número BR, API Key, TwiML App, suspender/reativar), `Twilio/TwilioVoiceService` (initiateCall, generateAccessToken, fetchCall — client por subconta com token decifrado), `DialerCampaign/`, `DialerContactParser/` (xlsx/SheetJS para Excel + `JSON.parse` para JSON; colunas `name`/`phone`/`email`, normalização E.164, dedupe por phone, limite 10k), `DialerRealtime/` (broadcast), `DialerBilling/` — todos interface + impl.
- Repository: `app/api/infra/data/repositories/dialer/IDialerRepository.ts` + `DialerRepository.ts` com variantes `WithCtx`.

### Máquina de estados da discagem (sem worker persistente — Vercel serverless)

O motor é dirigido por webhook: **cada callback de término dispara a próxima discagem**.

1. **Start**: valida role/`dialerEnabled`/limite → campanha `running` → `DialNextContactUseCase` para o operador requisitante. Cada operador ativo tem sua própria cadeia de chamadas (`DialerCall.operatorId`), permitindo N operadores na mesma campanha.
2. **`DialNextContactUseCase`**: recarrega campanha (se ≠ `running` → no-op, é assim que pause funciona) → checa `DialerUsage` (estourou → `limit_reached` + broadcast) → **claim atômico** do próximo contato via `FOR UPDATE SKIP LOCKED` (`prisma.$queryRaw` em transação) → cria `DialerCall(calling)` → `TwilioVoiceService.initiateCall()` com `machineDetection: "Enable"`, `timeout: 15`, `statusCallback` para `/api/webhooks/twilio/status?teamId=...&callId=...`. Fila vazia + nenhuma call ativa → `completed` + broadcast.
3. **Webhook `voice`**: `AnsweredBy=human` → TwiML `<Dial><Conference record="record-from-start">dialer-{callId}</Conference></Dial>` na perna do contato + cria perna do operador via REST (`to: "client:operator-" + profileId`); machine → `<Hangup/>`.
4. **Webhook `status`**: idempotente por `twilioCallSid` + transições válidas (nunca regredir estado); em evento terminal soma `ceil(CallDuration/60)` no `DialerUsage` e chama `DialNextContactUseCase`.
5. **Pause/Resume**: só muda flag no banco; chamada corrente termina naturalmente; broadcast `campaign_update` imediato.
6. **Watchdog** (obrigatório): cron Vercel 5/5min `GET /api/v1/dialer/cron/reconcile` — scanner que acha `DialerCall` ativa com `updatedAt` > 3min e publica 1 job QStash por chamada (`jobs/dialer/reconcile-call`, seção 8); o worker consulta `client.calls(sid).fetch()`, corrige estado e re-dispara a fila. Sem isso, um webhook perdido trava a campanha silenciosamente.

### Painel realtime — broadcast (decisão: broadcast > postgres_changes)

Motivos: o webhook de status é o único ponto de escrita e conhece o estado joinado (nome do contato/operador) que o postgres_changes não entrega; canal privado com policy em `realtime.messages` tem superfície menor que expor a tabela via RLS; tópico por time é natural. A perda eventual de evento é coberta por re-sync (snapshot `GET .../live` em toda (re)conexão + polling de segurança 30s quando há campanha `running`) — mesmo padrão `onSyncRequested` de `hooks/useLeadActivitiesRealtime.ts`.

- `DialerRealtimeService` (chamado por `DialerCallProgressUseCase`) usa `createSupabaseAdmin()` (`lib/supabase/server.ts`) e `channel("dialer:team:" + teamId, { config: { private: true } }).send({ type: "broadcast", event: "call_update", payload })`. Falha de broadcast não falha o webhook.
- Payload tipado em `lib/dialer/realtime-types.ts` (compartilhado front/back): eventos `call_update` / `campaign_update`, dados da call (status, operador, contato, timestamps, durationSeconds), `serverNow` (correção de clock skew) e `seq` (descartar out-of-order).

### Lead a partir da ligação + gravação protegida

- `POST /api/v1/dialer/calls/[callId]/create-lead` → `CreateLeadFromCallUseCase`: reusa `LeadUseCase.createLead()` com os dados do `DialerContact` (name, phone, email) e contexto de origem "discadora" na atividade de criação; grava `DialerCall.leadId`.
- Em seguida anexa a gravação ao lead via `LeadAttachmentService` com `isProtected: true` — `ALLOWED_TYPES` ganha `audio/mpeg`/`audio/wav` (Twilio entrega .mp3/.wav). A `LeadActivity` do anexo identifica a origem (ligação + campanha).
- **A gravação anexada não pode ser removida**: `deleteAttachment` recusa `isProtected = true` (backend) e o frontend oculta a ação de excluir nesses anexos. A cópia em `dialer-recordings` segue o ciclo normal; a cópia anexada ao lead em `lead-attachments` é permanente.
- Se o lead for criado antes da gravação ficar disponível (callback de recording é assíncrono), o worker de recording verifica `DialerCall.leadId` e anexa retroativamente.

### Segurança dos webhooks Twilio

- Body `x-www-form-urlencoded` → `Object.fromEntries(await request.formData())`; validar `twilio.validateRequest(subaccountAuthToken, request.headers.get("x-twilio-signature"), fullUrl, params)`.
- A assinatura usa o auth token da **subconta**: a query `?teamId=` resolve o Team e decifra `twilioSubaccountToken` via `lib/dialer/secret-crypto.ts` (AES-256-GCM com env `DIALER_ENCRYPTION_KEY` — não usar o XOR de `lib/crypto.ts`). `fullUrl` = URL pública exata com query string (`getFullUrl()` de `lib/utils/app-url.ts`); o erro mais comum é mismatch de host atrás do proxy Vercel — testar cedo com ngrok.
- Assinatura inválida → 403 sem side effects; conferir que `CallSid` pertence ao `callId` da query.

### Env vars novas

`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_BUNDLE_SID`, `TWILIO_ADDRESS_SID`, `DIALER_ENCRYPTION_KEY`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` (+ atualizar `postman/Lead-Flow-API-Collection.json` e `postman/Lead-Flow-Environment.json` a cada endpoint novo).

---

## 5. Frontend

### Estrutura (padrão `features/`, base via `bun run scaffold:feature -- --name dialer`)

```
app/[supabaseId]/dialer/
  page.tsx / loading.tsx
  features/
    context/    DialerTypes.ts, DialerHook.ts, DialerContext.tsx, DialerDeviceHook.ts
    services/   IDialerService.ts, DialerService.ts
    container/  DialerContainer.tsx
    components/ CampaignCard.tsx, UploadContactsDialog.tsx, ContactTable.tsx,
                DialerControls.tsx, TeamCallsPanel.tsx, ActiveCallCard.tsx,
                CallLogTable.tsx, RecordingPlayer.tsx, CampaignReport.tsx,
                DialerUsageCard.tsx
hooks/useDialerRealtime.ts   (clonado de useLeadActivitiesRealtime.ts)
```

### Design das telas

Governança visual obrigatória na implementação: ler `DESIGN.md` + skill `corretor-studio-design` antes do JSX; componentes via shadcn MCP; tokens semânticos, nunca hex ou cores Tailwind cruas.

1. **Lista de campanhas** (rota `/dialer`): grid de `CampaignCard` (nome, `Badge` de status, progresso `contactsProcessed/totalContacts` com `Progress`, taxa de atendimento) + CTA "Nova campanha" (`Dialog` com `FieldGroup`/`Field`; `max-h-[90vh] flex flex-col` + área `overflow-y-auto flex-1` + `DialogFooter` fixo). Loading com `Skeleton`.
2. **Detalhe da campanha**: header com controles (`DialerControls`: botão Iniciar/Pausar com lock de request, estado do `Device`, mute/hangup) + `Tabs`: **Ao vivo** (`TeamCallsPanel`), **Contatos** (`ContactTable` paginada), **Histórico** (`CallLogTable` + `RecordingPlayer` com `<audio>` via signed URL), **Relatório** (`CampaignReport`). No histórico e no card da chamada ativa, ação **"Criar lead no CRM"** (com lock de request): cria o lead a partir do contato e anexa a gravação; depois vira link para o lead criado.
3. **TeamCallsPanel** (requisito central): grid de `ActiveCallCard` — avatar do operador (`Avatar` + `AvatarFallback`), nome do contato, telefone (mascarado para operadores que não são donos da chamada), `Badge` de status (`calling` = pulso no token `--primary`, `answered/transferred` = sucesso) e **duração ao vivo**: um único `setInterval` de 1s no contexto recalcula `elapsed` para todas as calls usando `answeredAt` + offset de `serverNow`; ao chegar `endedAt`, congela com `durationSeconds` do servidor. Card da própria chamada destacado com controles (mute/hangup).
4. **UploadContactsDialog**: dropzone + preview das primeiras linhas + mapeamento de colunas (`name`/`phone`/`email`) + validação E.164; feedback via `sonner`.
5. **DialerUsageCard**: consumo de minutos do ciclo (`Progress` + texto `minutesUsed/minutesLimit`), CTA de upgrade.

### Twilio Client (operador)

`DialerDeviceHook.ts`: dynamic import client-only de `@twilio/voice-sdk` (sem SSR); token de `GET /api/v1/dialer/token`; `new Device(token, { codecPreferences: ["opus","pcmu"] })`; `device.on("incoming", call => call.accept())` (auto-accept — operador "armou" o device ao clicar Iniciar, que também solicita permissão de microfone no gesture); `tokenWillExpire` → refetch; `device.destroy()` no unmount.

### Realtime (operador vê o time)

`hooks/useDialerRealtime.ts`: canal `dialer:team:{teamId}` com `private: true`, auth conforme `useLeadActivitiesRealtime` (sessão + fallback `GET /api/v1/realtime/auth-token`, `setAuth`, backoff máx 10s); `SUBSCRIBED`/reconexão → `onSyncRequested` → snapshot `GET .../live`.

---

## 6. Cache (Next.js Cache Components)

Princípio: **listagens e dados históricos cacheados com tags; tudo que é "ao vivo" fica fora do cache** (broadcast + snapshot sempre fresh).

- Novas tags em `lib/cache/cacheTags.ts`: `dialerCampaigns(teamId)`, `dialerCampaign(campaignId)`, `dialerCalls(campaignId)`, `dialerUsage(teamId)`, `dialerSubscription(teamId)`.
- `"use cache"` + `cacheTag()` + `cacheLife()` (padrão de `app/api/useCases/healthPlans/HealthPlanUseCase.ts`) nas leituras: lista/detalhe de campanhas (`cacheLife({ stale: 30, revalidate: 120, expire: 600 })` — agregados mudam via invalidation, não por TTL); histórico de chamadas e relatório (campanha `completed` pode ter vida longa); `DialerUsage`/assinatura.
- Novos helpers em `lib/cache/invalidation.ts` (server-only): `invalidateDialerCampaignCache({ teamId, campaignId })` (criar/editar/upload/start/pause + webhook `status` em transições de campanha e término de call), `invalidateDialerUsageCache({ teamId })` (soma de minutos + ciclo de billing), `invalidateDialerSubscriptionCache({ teamId })` (ativação/suspensão).
- **Nunca cachear**: `GET .../live`, `GET /dialer/token`, webhooks, cron, workers. O webhook de status invalida tags apenas em eventos terminais (não a cada ringing).
- Lookups `profile`/`teamMember` já são deduplicados por request via `React cache()` em `teamAccess.ts` — as rotas novas herdam isso usando `getTeamAccess()` (1 resolução por request).

---

## 7. Billing (Asaas) — add-on em tabela própria

`ProfileSubscription` é 1:1 com Profile e o dialer é por **time** → não mexer no enum `SubscriptionPlan`; o precedente exato é `EmailCreditSubscription`/`EmailCreditUsage`.

- Planos: `dialer_basic` R$ 49,90/300 min · `dialer_pro` R$ 89,90/800 min · `dialer_unlimited` R$ 199,90/2.000 min (teto transparente, ver seção 11).
- Ativação: `POST /api/v1/dialer/subscription` → `ActivateDialerUseCase` → `AsaasSubscriptionService.createSubscription` com `externalReference: "dialer:" + teamId` → `DialerSubscription(pending)`.
- Webhook Asaas: early-return em `PaymentValidationService` quando `externalReference` tem prefixo `dialer:` → delega a `DialerBillingService`: confirmado → `dialerEnabled=true`, provisiona subconta Twilio na 1ª ativação, cria `DialerUsage` do ciclo; overdue/canceled → suspende subconta + `dialerEnabled=false`. Fluxo atual de planos base permanece intocado.
- Enforcement: `DialNextContactUseCase` bloqueia no limite → status `limit_reached` + broadcast + invalidation. Excedente automático (cobrança avulsa) fica pós-MVP.
- Cron mensal de reset do `DialerUsage` (`vercel.json`).

---

## 8. Jobs assíncronos com Upstash (QStash) — infra compartilhada (email + discadora)

Padrão **scheduler → fila → worker**, multi-tenant e idempotente, sobre Vercel serverless:

```
Vercel Cron (*/5min) — scanner leve
   └─ busca no Supabase agendamentos vencidos na janela (scheduledAt <= now, status=scheduled)
   └─ para cada item: JobQueueService.publish() → QStash (1 mensagem por time/campanha,
      deduplicationId determinístico)
QStash → POST https://app/api/jobs/<dominio>/<job>  (assinatura verificada, retry automático + DLQ)
   └─ worker processa UM tenant: lock compare-and-set no banco → executa → marca resultado
```

### Infra nova

- `bun add @upstash/qstash`; env vars `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.
- `app/api/services/JobQueue/IJobQueueService.ts` + `JobQueueService.ts`: `publish({ url, body, deduplicationId, delay?, retries? })` usando `Client` do `@upstash/qstash`. Em dev local (sem QStash), modo fallback que chama o worker direto via `fetch` — mantém o fluxo testável localmente.
- Workers em **`app/api/jobs/<dominio>/<job>/route.ts`** — namespace de infraestrutura ao lado de `/api/webhooks/*` (endpoints invocados por sistema externo, não produto; documentar na seção de API Routing do `agents.md`). Helper `lib/jobs/verifyQStashSignature.ts` com `Receiver.verify()` (chaves current/next) — request sem assinatura válida → 403.
- **Idempotência em duas camadas**: (1) `deduplicationId` no publish (QStash descarta duplicatas — ex.: `email-campaign:{campaignId}:{scheduledAt ISO}`); (2) lock compare-and-set no worker (`updateMany({ where: { id, status: "scheduled" }, data: { status: "sending" } })` — padrão que o cron atual já usa). Reentrega do QStash vira no-op.

### Aplicação no módulo de email (motivador)

- `EmailCampaignUseCase`: validar `scheduledAt` em **janelas de 30 min** (minutos ∈ {00, 30}) na criação/edição; UI do agendamento oferece só esses slots. Recorrência **diária** opcional: campos `recurrence: "none" | "daily"` + `nextRunAt` em `EmailCampaign` (migration); ao concluir um disparo recorrente, o worker recalcula `nextRunAt` (+24h, mesma janela) e devolve o status para `scheduled` em vez de `sent`.
- `app/api/v1/email/cron/dispatch-scheduled/route.ts` (cron existente) vira **scanner**: busca `status=scheduled AND scheduledAt <= now` (sem `take: 5`), publica 1 job por campanha com `deduplicationId` e responde — sem processar nada inline.
- Novo worker `app/api/jobs/email/dispatch-campaign/route.ts`: move para cá a lógica atual do cron (créditos, lock, contatos, `EmailCampaignDispatchService.dispatchBatch`, `EmailLog`, débito de créditos) para **uma** campanha por invocação — elimina o gargalo de 5 campanhas/run e o risco de timeout; o retry do QStash cobre falha transitória de um tenant sem afetar os demais.

### Reuso pela discadora

- **Watchdog `reconcile`**: o cron escaneia chamadas órfãs e publica 1 job `jobs/dialer/reconcile-call` por chamada (dedupe por `callSid:updatedAt`), em vez de consultar a API Twilio inline para N times.
- **Migração de gravações**: término de chamada publica job `jobs/dialer/archive-recording` (download Twilio → Supabase Storage → anexo protegido retroativo se `leadId` → delete no Twilio), com retry automático — remove esse trabalho pesado do webhook.

---

## 9. Configuração Twilio (pré-requisito de produção) e testes em free tier

**Sem número compartilhado**: cada time tem seu próprio número BR na sua subconta. Checklist de configuração da conta mestre (manual, console Twilio):

1. Criar conta Twilio mestre (upgrade pago) e cadastrar cartão corporativo.
2. **Regulatory Bundle BR** (exigência ANATEL para números locais): Phone Numbers → Regulatory Compliance → criar Bundle com CNPJ + endereço comprobatório + Supporting Document; aguardar aprovação (dias). Bundles podem ser **compartilhados com subcontas** (criar na mestre e referenciar `bundleSid`/`addressSid` na compra do número via API em cada subconta) — é assim que o `TwilioSubaccountService` compra números sem repetir o processo regulatório por time.
3. Habilitar **Voice Geographic Permissions** para Brasil (Voice → Settings → Geo Permissions).
4. Criar as env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (mestre), `TWILIO_BUNDLE_SID`, `TWILIO_ADDRESS_SID`, `DIALER_ENCRYPTION_KEY`.
5. O restante (subconta, número, API Key, TwiML App com voice URL → `/api/webhooks/twilio/voice`) é **provisionado por código** pelo `TwilioSubaccountService` na ativação do add-on.

**Teste local em free tier (conta trial):**

- Conta trial dá ~US$ 15 de crédito; dá para comprar 1 número US de teste sem upgrade (número BR exige conta paga + bundle — em dev usar número US e ligar para **Verified Caller IDs**).
- Limitações do trial: só liga para números **verificados** (cadastrar os celulares dos devs), toca mensagem "trial account" antes de conectar, 1 número apenas. Suficiente para validar todo o fluxo (AMD, Conference, Client, webhooks, gravação).
- Webhooks locais: `ngrok http 3000` e apontar a voice URL do TwiML App para `https://<id>.ngrok.app/api/webhooks/twilio/voice`; setar `NEXT_PUBLIC_APP_URL` para a URL do ngrok para a validação de assinatura bater (ver também `docs/NGROK_WEBHOOK_SETUP.md`).
- Testes automatizados sem custo: **Test Credentials** da Twilio (SID/token de teste) + *magic numbers* (`+15005550006` = sucesso, `+15005550001` = inválido) validam `initiateCall` sem chamadas reais — usar nos testes do `TwilioVoiceService`.
- No trial, pular a criação de subconta (trial não cria subcontas): a rota provisória `POST /api/v1/dialer/setup` aceita modo `useMasterAccount: true` apenas em `NODE_ENV !== "production"` para apontar o time de teste à conta trial direto.

---

## 10. Fases (PRs incrementais — cada uma passa typecheck/lint/governance/design-check)

| PR | Escopo | Destaques |
|---|---|---|
| **0 — Infra de jobs (Upstash QStash) + disparo agendado de email** | `bun add @upstash/qstash`; `JobQueueService` (interface+impl) + `lib/jobs/verifyQStashSignature.ts`; namespace `app/api/jobs/**`; refatorar cron `dispatch-scheduled` em scanner + worker `jobs/email/dispatch-campaign`; janelas de 30 min + recorrência diária (`recurrence`/`nextRunAt` em `EmailCampaign`, migration); env vars QSTASH_* + Postman | Independente da discadora — entrega valor ao email primeiro; idempotência: dedupe QStash + lock compare-and-set |
| **1 — Fundação** | Schema Prisma + migration `add-dialer-module` (RLS + índice parcial + `LeadAttachment.isProtected` + `DialerCall.leadId`); rotas/useCases/services/repository de campanhas + upload Excel/JSON; scaffold frontend (lista de campanhas, upload, contatos); feature backoffice `voice` (slugs + product map + route access + registro via backoffice) + sidebar + `proxy.ts`; tags/invalidation de cache; Postman | Sem Twilio ainda — tudo testável local |
| **2 — Provisionamento Twilio** | `bun add twilio @twilio/voice-sdk`; `lib/dialer/secret-crypto.ts` (AES-256-GCM); `TwilioSubaccountService` (compra de número com `bundleSid`/`addressSid` da mestre) + `TwilioVoiceService`; `GET /dialer/token`; `lib/webhooks/twilioWebhookSecurity.ts` + stubs dos webhooks; rota `setup` provisória (isMaster, com modo trial `useMasterAccount` fora de produção); env vars | Iniciar **Bundle regulatório BR** na conta mestre já (aprovação leva dias) |
| **3 — Core da discagem** | `StartDialerUseCase`, `DialNextContactUseCase`, `DialerCallProgressUseCase`; rotas start/pause; webhooks completos (TwiML Conference / status); `DialerDeviceHook` + `DialerControls`; **watchdog `reconcile`** (cron scanner + job QStash `jobs/dialer/reconcile-call`) | Claim atômico SKIP LOCKED; idempotência por CallSid; AMD + `timeout: 15` |
| **4 — Painel realtime** | Migration policy `realtime.messages`; `DialerRealtimeService` (broadcast); `lib/dialer/realtime-types.ts`; `GET .../live`; `hooks/useDialerRealtime.ts`; `TeamCallsPanel` + ticker de duração | 2 browsers veem chamadas um do outro <1s; reconexão re-sincroniza; outro time não assina o canal |
| **5 — Gravações, histórico e lead a partir da ligação** | Recording callback; job QStash `jobs/dialer/archive-recording` move gravação Twilio → Supabase Storage (`dialer-recordings`) e apaga no Twilio (retry automático); `GET calls` (operador só vê as próprias) + signed URL; `POST calls/[callId]/create-lead` (`CreateLeadFromCallUseCase` + anexo da gravação com `isProtected: true`, anexação retroativa pelo recording callback); bloqueio de exclusão de anexo protegido no `LeadAttachmentService` + UI; `CallLogTable`/`RecordingPlayer`/`CampaignReport` (com cache + tags) | Gravação anexada ao lead é permanente |
| **6 — Billing Asaas** | `DialerBillingService`; rotas subscription; roteamento `dialer:` no `PaymentValidationService`; enforcement de limite ativo; `DialerUsageCard` + tela de ativação; cron reset mensal; remover/restringir rota `setup` | Regressão: webhook Asaas dos planos base continua OK |
| **7 — Hardening** | Suspensão/reativação de subconta amarrada ao ciclo; mascaramento de telefone no painel; rate limit nos webhooks e workers; revisão final Postman/governança | |

---

## 11. Análise de custos e plano "ilimitado" (referência da v1.1.0 — ainda válida)

### Custo por chamada (Twilio BR, cotação USD 1,00 ≈ R$ 5,20 — verificar sempre)

| Cenário | Custo aprox. |
|---------|--------------|
| Chamada atendida (3 min: sainte celular + AMD + gravação + bridge operador) | ~US$ 0,11 ≈ R$ 0,57 |
| Chamada não atendida (timeout 30s + AMD) | ~US$ 0,02 ≈ R$ 0,10 |
| 100 contatos discados (50% atendimento) | ~R$ 33,50 de infraestrutura |

Itens unitários: ligação sainte celular BR US$ 0,028/min · fixo US$ 0,016/min · Twilio Client US$ 0,004/min · AMD US$ 0,005/call · gravação US$ 0,0025/min (+ armazenamento US$ 0,0025/min/mês — por isso a migração para Supabase Storage) · número local BR US$ 1,00/mês.

### Plano "ilimitado"

O Twilio não tem flat-rate de voz para o Brasil — todo uso é por minuto. O `dialer_unlimited` é posicionado como **"até 2.000 min/mês"** (teto técnico transparente no contrato): custo Twilio médio ≈ R$ 150 no teto (margem ~25%), enquanto o uso típico de 200–500 min/mês dá margem muito maior. Excedente automático via cobrança avulsa Asaas fica pós-MVP.

### Fluxo de dinheiro

Cliente paga o Lead Flow via Asaas (mensalidade + excedentes) → Lead Flow paga a fatura Twilio consolidada da conta mestre (custos das subcontas sobem para a mestre) → margem = receita Asaas − custo Twilio. Não há repasse direto cliente → Twilio.

---

## 12. Verificação

- Cada PR: `bun run typecheck && bun run lint && bun run governance:check && bun run lint:pt-br` (+ `bun run design:check` em mudanças de UI).
- PR 0: agendar campanha de email num slot de 30 min → cron publica no QStash → worker dispara exatamente 1 vez (forçar reentrega para provar idempotência); worker rejeita request sem assinatura QStash (403); recorrência diária reagenda `nextRunAt` +24h; cron antigo não processa mais nada inline.
- PR 1: upload Excel (.xlsx) e JSON cria contatos normalizados; rotas respeitam roles (manager cria, operador só lê); feature `voice` registrada no backoffice controla a visibilidade no sidebar.
- PR 2: token decodifica com VoiceGrant correto; webhook rejeita assinatura inválida (403) e aceita assinada (script local com `getExpectedTwilioSignature` ou ngrok).
- PR 3: teste manual com conta trial Twilio + ngrok (guia da seção 9 — Verified Caller IDs, magic numbers para testes sem custo): atendida conecta operador no browser; não atendida avança fila; pause interrompe após chamada corrente; matar webhook → watchdog destrava em ≤5min.
- PR 4: 2 browsers/operadores; reconexão; isolamento por time via policy.
- PR 5: criar lead a partir de uma ligação anexa a gravação com `isProtected: true`; tentativa de excluir o anexo retorna erro e a UI não exibe a ação.
- PR 6: sandbox Asaas (confirmado habilita, overdue suspende e bloqueia start).
- Migrations: apenas locais (`bun run db:migrate:reset:local`); push remoto **somente com autorização do owner**.

## 13. Riscos

1. **Regulatório Twilio BR**: número local exige Regulatory Bundle aprovado — iniciar o processo na conta mestre antes do PR 2 (seção 9); o bundle da mestre é reutilizado pelas subcontas na compra dos números (sem número compartilhado entre times).
2. **Assinatura de webhook com subconta**: mismatch de host/URL atrás do proxy Vercel é o erro mais comum — validar com ngrok no PR 2.
3. **Webhook perdido trava campanha**: o watchdog `reconcile` é parte obrigatória do PR 3.
4. **`@twilio/voice-sdk` não suporta SSR**: dynamic import client-only.
5. **Custo**: ~R$ 0,57/chamada atendida de 3 min; AMD ativado; gravações migradas para Supabase Storage para reduzir armazenamento Twilio.
6. **Evento de broadcast perdido**: coberto por snapshot de re-sync + polling de segurança quando há campanha `running`.

## 14. Referências

- [Twilio Programmable Voice Quickstart (Node.js)](https://www.twilio.com/docs/voice/quickstart/server)
- [Twilio Pricing — Brazil](https://www.twilio.com/en-us/voice/pricing/br)
- [Twilio AMD (Answering Machine Detection)](https://www.twilio.com/docs/voice/answering-machine-detection)
- [Twilio Conference Rooms](https://www.twilio.com/docs/voice/twiml/conference)
- [Twilio Voice SDK (Browser)](https://www.twilio.com/docs/voice/sdks/javascript)
- [Twilio Subaccounts](https://www.twilio.com/docs/iam/api/subaccounts)
- [Upstash QStash](https://upstash.com/docs/qstash/overall/getstarted)
- Billing atual: `app/api/services/AsaasSubscription/AsaasSubscriptionService.ts` · `app/api/services/PaymentValidation/PaymentValidationService.ts`
- Realtime de referência: `hooks/useLeadActivitiesRealtime.ts` · `hooks/useTeamPresence.ts`
- Cache: `lib/cache/cacheTags.ts` · `lib/cache/invalidation.ts`
- Output contract: `lib/output/index.ts`
