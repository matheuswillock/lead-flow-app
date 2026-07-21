# Especificação — Módulo Discadora Automática (3C Plus + Billing de Repasse)

**Versão:** 3.1.0
**Data:** 2026-07-21
**Status:** Decisões A e B resolvidas pelo owner (seção 2) — Estágio 4 implementado
**Produto:** Lead Flow — Corretor Studio
**Substitui:** [`docs/TWILIO_AUTO_DIALER_SPEC.md`](TWILIO_AUTO_DIALER_SPEC.md) v2.1.0 — decisão de produto confirmada de trocar o motor de discagem de Twilio Programmable Voice para **3C Plus**. Ver [`docs/DIALER_3CPLUS_AUDIT.md`](DIALER_3CPLUS_AUDIT.md) para o raciocínio completo da auditoria que motivou esta reformulação.
**Herda sem alteração da spec anterior:** feature flag `voice` (já implementada), CRUD de campanha/contato (já implementado, agnóstico de provedor — Estágio 1 abaixo), padrão de jobs Vercel Cron + tabela no banco (`docs/specs/email-dispatch.md`), anexo de gravação protegido ao lead.

---

## 1. Visão Geral

O módulo de **Discadora Automática** ("Studio Voice") permite que operadores executem campanhas de ligações para uma base de contatos pré-carregada, usando a **3C Plus** como motor de discagem preditiva/automática hospedado.

### Diferença arquitetural fundamental vs. o plano Twilio anterior

A 3C Plus **não é** uma API de telefonia programável de baixo nível como o Twilio. É um discador preditivo hospedado, com fila de discagem, detecção de atendimento e (provavelmente) interface própria de agente já embutidas no produto. Isso muda o que o Lead Flow precisa construir:

| | Plano anterior (Twilio) | Plano atual (3C Plus) |
|---|---|---|
| Quem decide quando discar o próximo contato | Lead Flow (`DialNextContactUseCase`, claim atômico `FOR UPDATE SKIP LOCKED`) | 3C Plus (discador preditivo interno) |
| Quem detecta atendimento / secretária eletrônica | Lead Flow via Twilio AMD | 3C Plus |
| Quem conecta a chamada ao operador | Lead Flow via TwiML `<Conference>` + Twilio Client SDK no navegador | 3C Plus (softphone/agente próprio — **a confirmar na integração**, ver Decisão B) |
| O que o Lead Flow constrói | A própria máquina de estados de discagem | Um consumidor de eventos: sincroniza campanha/contatos via API 3C Plus, recebe webhook de eventos de chamada, atualiza `DialerCall` e retransmite via broadcast |

Isso **reduz** a complexidade do Lead Flow no controle de chamada, mas **adiciona** uma camada nova que não existia no plano Twilio: o **repasse de billing** (custo real da 3C Plus vs. preço cobrado do cliente via Asaas).

### Decisões de produto herdadas (não mudam com a troca de provedor)

- Pool de contatos: upload de Excel (.xlsx) e JSON — já implementado, não mexer.
- Tempo real: painel do time + própria chamada via Supabase Realtime (broadcast, não `postgres_changes`).
- Feature gerenciada pelo backoffice com slug próprio (`voice`) — já implementado, não mexer.
- Gravação de ligação que origina um lead é anexada ao lead e não pode ser removida.
- Jobs assíncronos com Vercel Cron + tabela de jobs no banco (`DialerJob`), sem fila externa.

### Decisão de produto nova desta versão

- Billing ao cliente final: **híbrido** — assento fixo mensal por operador ativo no Dialer + minutos inclusos + excedente cobrado por minuto (decisão tomada nesta rodada; ver seção 3, Decisão C).
- Repasse: custo real devido à 3C Plus (`custoRepasse3CPlus`) é rastreado **separadamente** do preço cobrado do cliente (`precoCobradoCliente`) — nunca um único campo/cálculo combinado.

---

## 2. Decisões arquiteturais (resolvidas pelo owner em 2026-07-21)

### Decisão A — Estrutura comercial com a 3C Plus (RESOLVIDA: implementar os dois caminhos)

O spec OpenAPI real da 3C Plus (`https://app.3c.plus/api/v1/swagger.json`, 159 endpoints — ver `docs/DIALER_3CPLUS_AUDIT.md` seção 2) confirma que a 3C Plus tem recursos nativos **`Teams`, `Users` e `Campaigns`** todos escopados a uma única "company", com autenticação por `api_token` **por usuário** (não por conta). Isso muda a natureza da incerteza: **tecnicamente**, a Hipótese A1 abaixo é implementável hoje só com endpoints públicos documentados (`POST /teams`, `POST /users`, `POST /campaigns/{id}/agents`) — não existe (nem é necessário) um "programa de revenda" especial. A pergunta contratual (se o acordo comercial com a 3C Plus permite uma única conta operar em nome de múltiplos clientes finais) continua sem resposta pública — mas **o owner decidiu não bloquear o código nela**: em vez de escolher uma hipótese, **os dois caminhos são implementados e coexistem como uma opção de configuração por Time** (`Team.dialer3cplusMode: master | own_account`, ver seção 3.1). A confirmação contratual da Hipótese A1 vira um pré-requisito operacional para *ativar* o modo `master` para um Time específico, não mais um bloqueio de arquitetura/código.

**Implementado no Estágio 4** (`app/api/services/VoiceProvider/ThreeCPlusVoiceProvider.ts`): a credencial é resolvida em runtime por `Team.dialer3cplusMode` — `master` usa `THREECPLUS_API_TOKEN` (env var de aplicação); `own_account` usa `Team.dialer3cplusApiToken` decifrado via `lib/dialer/secret-crypto.ts` (AES-256-GCM, criado nesta etapa — não reaproveitar `lib/crypto.ts`, que é XOR client-side). `createAgent` lança erro explícito no modo `own_account` ("não aplicável — o Time gerencia os próprios usuários na conta 3C Plus"), já que só faz sentido sob `master`.

| | Hipótese A1 — Conta mestre + agentes via API (reseller) | Hipótese A2 — Conta própria por Time cliente |
|---|---|---|
| Quem contrata a 3C Plus | Corretor Studio (1 contrato, 1 "company" 3C Plus) | Cada Time cliente contrata diretamente |
| Como o assento do operador é criado | `POST /users` (name, extension_number, role, web_extension) dentro da company mestre + `POST /teams` (1 Team 3C Plus por Time Lead Flow) + `POST /campaigns/{id}/agents` — todos endpoints públicos já confirmados no swagger | Cliente cria o usuário na própria conta 3C Plus; Lead Flow só consome credenciais fornecidas pelo cliente |
| Existe custo de repasse a reconciliar? | Sim — é o núcleo desta spec (`custoRepasse3CPlus` vs `precoCobradoCliente`), calculável a partir de `GET /calls` (filtro `campaigns[]`) × `Route.telephony-rates` | Não no sentido financeiro — vira só uma integração de credenciais por Time, sem repasse de custo do Corretor Studio |
| Onde ficam as credenciais no schema | 1 `api_token` de aplicação (env var), não por Team; o mapeamento Team→3C Plus é só `dialer3cplusTeamId`/`dialer3cplusCampaignId` (ids remotos, não segredo) | Credencial por Team (`Team.dialer3cplusApiToken` cifrado, análogo aos campos `twilio*` removidos) |
| Impacto no Estágio 5 (provisionamento) | `IVoiceProvider.createAgent()` chama `POST /users` + `POST /teams/{id}` (ou usa o Team já existente) com a conta mestre | `IVoiceProvider.createAgent()` não existe; em vez disso há uma tela de "conectar credenciais 3C Plus" por Time |

**Ação obrigatória antes do Estágio 5**: confirmar com o time comercial/parceria se o contrato permite o uso de uma única conta 3C Plus em nome de múltiplos clientes finais (a viabilidade técnica da Hipótese A1 já está confirmada pelo schema da API — o que falta é a permissão contratual, não o desenho técnico). Os Estágios 1-4 e 6-9 desta spec **não dependem** dessa decisão (são billing puro ao cliente ou schema agnóstico) e podem prosseguir. Não iniciar o Estágio 5 sem essa confirmação — desenhar o provisionamento errado aqui é caro de reverter (agentes/contas criadas de verdade na 3C Plus).

### Decisão B — Como o operador efetivamente atende a chamada (RESOLVIDA: webphone nativo embutido no Corretor Studio)

O owner decidiu que o webphone **fica embutido dentro do Corretor Studio** — não é uma aba separada da 3C Plus, nem um iframe do domínio dela (hipóteses 1 e 2 do desenho anterior estão descartadas). Vale a hipótese 3 numa forma mais forte: o Lead Flow constrói seu **próprio cliente de chamada** (não só orquestra mute/hangup via API sobre um softphone alheio).

**Achado técnico que sustenta essa decisão** (inspeção direta do swagger real e do JSON por trás da coleção Postman — `https://documenter.gw.postman.com/api/collections/25269027/2sA3JT1cqi`, que carrega via JS e por isso não aparece num fetch simples de HTML):

- `User.extension_password` e `User.telephony_id` são campos reais no schema do `User` da 3C Plus (não específicos de um endpoint) — junto com `Extension.extension_number`, esse é o formato clássico de credencial SIP (ramal + senha). O endpoint legado `POST /webphone-authenticate` (coleção Postman, host `app.3c.fluxoti.com.br`) devolve exatamente esses campos no login.
- O endpoint atual do swagger, `POST /agent/webphone/login`, só alterna o modo de login do agente para a campanha (`204 No Content`, sem corpo) — não devolve credencial nenhuma. Ou seja, existem duas gerações de API para funções relacionadas; a que interessa para o embed nativo é a que devolve credenciais.
- **Nenhuma menção a iframe/embed em toda a coleção Postman** (busca full-text vazia) — reforça que a 3C Plus não documenta um mecanismo de iframe oficial.
- Endpoints de controle de chamada do agente já confirmados no swagger (usados no adapter, seção 4.1): `POST /agent/call/{call-id}/hangup`, `POST /agent/consult`, `/agent/consult/cancel`, `/agent/consult/exit`, `/agent/consult/transfer`, `POST /agent/manual_call/*`, `POST /click2call`, `POST /agent/login`, `POST /agent/logout`.

**Caminho técnico recomendado (Estágio 6)**: um cliente SIP/WebRTC próprio no navegador (ex.: JsSIP ou SIP.js), autenticado com `extension_number`/`extension_password` obtidos via um endpoint interno do Lead Flow (nunca expor a chamada à 3C Plus direto no client), registrando no gateway SIP da 3C Plus.

**Gap que continua sem resposta na documentação pública, validação ao vivo obrigatória antes do Estágio 6**: o host/porta do gateway SIP/WSS não aparece em nenhum dos dois specs (swagger nem Postman). Validar inspecionando via DevTools o que o próprio webphone da 3C Plus abre ao logar, ou perguntando ao suporte/sucesso do cliente da 3C Plus.

### Decisão C — Modelo de billing ao cliente final (resolvida nesta rodada)

**Híbrido**: assento fixo mensal por operador ativo no Dialer + minutos inclusos por assento + excedente de minutos cobrado à parte — mesmo espírito do overage já especificado em `docs/specs/email-dispatch.md`/implementado em `EmailCreditService`. Ver seção 3 para o desenho de schema.

---

## 3. Banco de dados

Migrations via Supabase CLI (`bun run db:migrate:new <nome>`; SQL idempotente; nunca editar `20260611125755_add-dialer-module.sql`, já commitada — qualquer alteração de schema do Dialer a partir de agora é uma migration nova).

### 3.1 Remover/substituir campos Twilio-específicos

- `Team`: remover `twilioSubaccountSid`, `twilioSubaccountToken`, `twilioApiKeySid`, `twilioApiKeySecret`, `twilioAppSid`, `twilioNumberSid`, `twilioPhoneNumber`. Nenhum dado real existe nessas colunas (módulo nunca foi ao ar) — remoção é segura.
  - Campos de modo 3C Plus **já adicionados no Estágio 4** (migration `20260721212021_dialer-3cplus-mode.sql`, antes deste Estágio 2): `dialer3cplusMode Dialer3cPlusMode @default(master)` (enum `master | own_account`), `dialer3cplusAccountId String?` e `dialer3cplusApiToken String?` (cifrado com `lib/dialer/secret-crypto.ts`, AES-256-GCM — só usado sob `own_account`). Os dois caminhos da Decisão A coexistem por Time via esse campo de modo, não são mutuamente exclusivos no schema.
- `DialerCall`: renomear `twilioCallSid` → `providerCallId` (chave de idempotência genérica), `recordingSid` → `providerRecordingId`. Mesmo tipo/unicidade.

### 3.2 Novos modelos de billing e repasse (independem da Decisão A)

```prisma
enum DialerSeatStatus {
  pending
  active
  suspended
  canceled

  @@map("dialer_seat_status")
}

model DialerSeat {
  id              String           @id @default(uuid()) @db.Uuid
  teamId          String           @db.Uuid
  operatorId      String           @db.Uuid
  status          DialerSeatStatus @default(pending)
  providerAgentId String?          @db.Text // id do agente na 3C Plus, quando aplicável (Decisão A1)
  activatedAt     DateTime?        @db.Timestamptz(6)
  suspendedAt     DateTime?        @db.Timestamptz(6)
  createdAt       DateTime         @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime         @updatedAt @db.Timestamptz(6)

  team     Team    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  operator Profile @relation("DialerSeatOperator", fields: [operatorId], references: [id], onDelete: Cascade)

  @@unique([teamId, operatorId])
  @@map("corretor_studio_dialer_seats")
}

// Precedente direto: PendingOperator (app/api/useCases/subscriptions/SubscriptionUpgradeUseCase.ts)
model PendingDialerSeat {
  id             String   @id @default(uuid()) @db.Uuid
  managerId      String   @db.Uuid
  teamId         String   @db.Uuid
  operatorId     String   @db.Uuid // operador existente recebendo acesso ao Dialer
  paymentId      String?  @unique @db.Text
  subscriptionId String?  @db.Text
  paymentStatus  String   @db.Text // PENDING, CONFIRMED, FAILED
  paymentMethod  String   @db.Text // PIX, CREDIT_CARD
  seatActivated  Boolean  @default(false)
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)

  manager  Profile @relation("PendingDialerSeatManager", fields: [managerId], references: [id], onDelete: Cascade)
  team     Team    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  operator Profile @relation("PendingDialerSeatOperator", fields: [operatorId], references: [id], onDelete: Cascade)

  @@index([managerId])
  @@index([subscriptionId])
  @@map("corretor_studio_pending_dialer_seats")
}

model DialerPassthroughReconciliation {
  id                    String    @id @default(uuid()) @db.Uuid
  teamId                String    @db.Uuid
  billingMonth          String    @db.Text // "YYYY-MM"
  precoCobradoCliente   Decimal   @db.Decimal(12, 2) // derivado de DialerSubscription + DialerSeat + DialerUsage
  custoRepasse3CPlus    Decimal?  @db.Decimal(12, 2) // preenchido na reconciliação (manual nesta versão)
  source                String    @default("manual") @db.Text // "manual" | "api" (futuro)
  reconciledByProfileId String?   @db.Uuid
  reconciledAt          DateTime? @db.Timestamptz(6)
  notes                 String?   @db.Text
  createdAt             DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt             DateTime  @updatedAt @db.Timestamptz(6)

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, billingMonth])
  @@map("corretor_studio_dialer_passthrough_reconciliation")
}
```

**Nunca** colapsar `precoCobradoCliente` e `custoRepasse3CPlus` num único campo "líquido" — a margem só é visível se os dois lados existirem separados (risco crítico #2 da auditoria).

### 3.3 Alterações em modelos existentes

- `DialerUsage`: adicionar `overageMinutes Decimal @default(0) @db.Decimal(10, 2)` e `overageCharged Decimal @default(0) @db.Decimal(12, 2)` — mesmo padrão de `EmailCreditUsage.overageCount`/`overageCharged`.
- `DialerSubscription`: mantém `plan`/`monthlyMinutes` como estão (não são por-assento; o preço por assento fica em constantes de código, ver 4.2, mesmo padrão de `PLAN_CREDITS`/`OVERAGE_RATE_PER_HUNDRED` em `EmailCreditService.ts`). Nenhuma alteração de coluna necessária aqui além do que já existe.

### 3.4 SQL manual na migration

- RLS nas tabelas novas: sem policy de SELECT para o client (mesmo padrão da migration de fundação — acesso só via API/service role).
- Índice em `DialerPassthroughReconciliation` por `[teamId, billingMonth]` (já coberto pela unique).

---

## 4. Backend

### 4.1 Camadas e responsabilidades (separação estrita billing vs. controle de chamada)

```
Route → UseCase → Service → Repository (Prisma)
```

- **`IVoiceProvider`** (`app/api/services/VoiceProvider/IVoiceProvider.ts`) — **exclusivamente controle de chamada/campanha na 3C Plus**. Métodos e mapeamento confirmado para a API real (`docs/DIALER_3CPLUS_AUDIT.md` seção 2.1):

  | Método `IVoiceProvider` | Endpoint 3C Plus real |
  |---|---|
  | `createTeam(name)` | `POST /teams` (name, color) — 1 Team 3C Plus por Time Lead Flow |
  | `createAgent(name, extension)` | `POST /users` (name, extension_number, role: "agent", web_extension) — só relevante sob Decisão A1 |
  | `assignAgentToTeam(agentId, teamId)` | implícito em `POST /teams` (`agents[]`) ou `PUT /teams/{team-id}` |
  | `syncCampaignContacts(campaignId, contacts)` | `POST /campaigns/{campaign-id}/lists` + `POST /campaigns/{campaign-id}/lists/{list-id}/mailing.json` |
  | `startCampaign(campaignId)` | `PUT /campaigns/{campaign-id}/resume` |
  | `pauseCampaign(campaignId)` | `PUT /campaigns/{campaign-id}/pause` |
  | `getCampaignStatus(campaignId)` | `GET /campaigns/{campaign-id}` + `GET /campaigns/{campaign-id}/statistics` |
  | `listCallsForCampaign(campaignId, range)` | `GET /calls` com filtro `campaigns[]` (retorna `speaking_time` por chamada — insumo do cálculo de repasse, seção 4.5) |
  | `getRecording(callId)` | `GET /calls/{call-id}/recording` (+ variantes `recording_amd`/`recording_consult`/`recording_transfer`) |

  **Nunca** um método que decide se o Time pode pagar ou quanto cobrar — isso fica em `DialerBillingService`.
- **`ThreeCPlusVoiceProvider`** (`app/api/services/VoiceProvider/ThreeCPlusVoiceProvider.ts`, **implementado no Estágio 4**) — implementação concreta, chama `https://app.3c.plus/api/v1/*` (host confirmado no swagger: `3c.fluxoti.com`/`app.3c.plus`, `basePath /api/v1`, autenticação `?api_token=`). Credencial resolvida por `Team.dialer3cplusMode` (seção 2, Decisão A): `master` usa `THREECPLUS_API_TOKEN`; `own_account` decifra `Team.dialer3cplusApiToken`. Endpoints `POST /teams`, `POST /users`, `PUT /teams/{id}` usam `formData` (`application/x-www-form-urlencoded`), não JSON — só `POST /campaigns/{id}/lists/{list-id}/mailing.json` consome JSON de verdade (array de `{phone, data}`). `GET /calls` retorna `CallHistoryReport[]` direto (sem wrapper `data`); `GET /campaigns/{id}/statistics` retorna `{data: SingleCampaignStatistics[]}` (uma linha por dia no range, sem contagem total de contatos da campanha — `getCampaignStatus` soma os dias do range em `answeredCalls`/`notAnsweredCalls`/`abandonedCalls`/`failedCalls`, não existe campo de "total de contatos" documentado nesse endpoint).
- **`DialerBillingService`** (`app/api/services/DialerBilling/DialerBillingService.ts`) — assinatura, assentos, cálculo de excedente, reconciliação. **Nunca** chama `IVoiceProvider` diretamente para decidir billing; é o `UseCase` que orquestra: primeiro `DialerBillingService` confirma que o Time pode ter o assento, só depois o `UseCase` chama `IVoiceProvider.createAgent`.
- Repository: `IDialerRepository`/`DialerRepository` (já existe) ganha métodos `WithCtx` para os novos modelos (`DialerSeat`, `PendingDialerSeat`, `DialerPassthroughReconciliation`).

### 4.2 Constantes de plano (código, não banco — mesmo padrão de `EmailCreditService.ts`)

```typescript
// app/api/services/DialerBilling/DialerBillingService.ts
const SEAT_PRICE_BRL: Record<DialerPlan, number> = {
  dialer_basic: 49.9,
  dialer_pro: 39.9, // preço por assento cai conforme o plano sobe (mesmo racional de EmailCreditPlan)
  dialer_unlimited: 34.9,
};

const INCLUDED_MINUTES_PER_SEAT: Record<DialerPlan, number> = {
  dialer_basic: 150,
  dialer_pro: 300,
  dialer_unlimited: 600,
};

const OVERAGE_RATE_PER_MINUTE_BRL: Record<DialerPlan, number> = {
  dialer_basic: 0.45,
  dialer_pro: 0.35,
  dialer_unlimited: 0.28,
};
```

> Valores acima são placeholders de exemplo para a spec — precisam ser confirmados contra o custo real de repasse assim que a Decisão A for fechada (o preço ao cliente só faz sentido com margem sobre o custo 3C Plus real, hoje desconhecido).

### 4.3 Rotas novas

| Rota | Método | Papel |
|---|---|---|
| `api/v1/dialer/subscription` | POST/DELETE | ativar/cancelar add-on do Time (manager) — `ActivateDialerUseCase` |
| `api/v1/dialer/seats` | GET | listar assentos do Time (ativo/pendente/suspenso) |
| `api/v1/dialer/seats` | POST | manager solicita assento p/ operador → cria `PendingDialerSeat` + cobrança Asaas |
| `api/v1/dialer/seats/[seatId]` | DELETE | manager cancela assento (suspende, não deleta histórico) |
| `api/v1/dialer/usage` | GET | consumo do ciclo atual (minutos, excedente) — `DialerUsageCard` |
| `api/v1/backoffice/dialer/reconciliation` | GET | lista `DialerPassthroughReconciliation` por Time/mês (Backoffice, `getBackofficeAccess()`) |
| `api/v1/backoffice/dialer/reconciliation/[id]` | PUT | preenche `custoRepasse3CPlus` manualmente após conferir fatura 3C Plus (Backoffice) |
| `api/v1/dialer/campaigns/[campaignId]/start` / `pause` | POST | inicia/pausa campanha via `IVoiceProvider` (Estágio 6) |
| **Webhook a decidir explicitamente (risco #6 da auditoria)** | POST | eventos de chamada da 3C Plus — **recomendação: endpoint novo e dedicado**, não reaproveitar `app/api/webhooks/3cplus/route.ts` (esse continua sendo o canal de lead-intake não relacionado, documentado no spec antigo). Nome sugerido: `app/api/webhooks/3cplus-voice/route.ts`. **Atualização**: o swagger real da 3C Plus expõe um parâmetro `url` por campanha (`POST /campaigns` → `url`, `DialerSettings.url`) que sugere webhook HTTP tradicional (compatível com rota serverless) — mas o payload/gatilho não está documentado no spec e precisa ser validado ao vivo antes do Estágio 4. A alternativa documentada é um canal **Socket.IO** por company (`socket_channel`, catálogo de eventos em `docs/DIALER_3CPLUS_AUDIT.md` seção 2.1), que exige um cliente de conexão persistente — **incompatível com funções serverless do Vercel** e provavelmente exigindo um pequeno processo sempre ativo (ex.: na VPS já usada para o bot do WhatsApp) fazendo a ponte para o banco/broadcast do Lead Flow. Essa escolha de infra é decidida no Estágio 4, não nesta tabela. |

Todas as rotas de billing/assento seguem `getTeamAccess()` → `TeamContext` propagado (Route → UseCase → Service → Repository `WithCtx`), retornando `Output`. As rotas de backoffice usam `getBackofficeAccess()`, nunca `getTeamAccess()` (isolamento de módulo do `agents.md`).

### 4.4 Fluxo de ativação de assento (espelha `PendingOperator`/`SubscriptionUpgradeUseCase`)

1. Manager solicita assento de Dialer para um operador existente → `POST /api/v1/dialer/seats`.
2. `DialerBillingService` cria `PendingDialerSeat(paymentStatus: PENDING)` + cobrança Asaas (`externalReference: "dialer-seat:" + teamId + ":" + operatorId`).
3. Webhook Asaas confirma pagamento → `PaymentValidationService` roteia por prefixo `dialer-seat:` → `DialerBillingService.confirmSeatPayment()`.
4. **Só então** — e só se Decisão A = A1 — o `UseCase` chama `IVoiceProvider.createAgent()` para provisionar o agente na 3C Plus. Sob Decisão A2, este passo não existe: em vez disso, o Manager conecta credenciais 3C Plus do próprio Time numa tela separada (fora do fluxo de pagamento).
5. `DialerSeat(active)` criado/atualizado; `PendingDialerSeat.seatActivated = true`.
6. Cancelamento/suspensão: mesma lógica invertida (suspende no billing primeiro, depois suspende/remove o agente via `IVoiceProvider`, nunca ao contrário).

### 4.5 Reconciliação de repasse (cálculo automático via API + fallback manual)

A rodada anterior desta spec assumia "fatura mensal consolidada" e reconciliação só manual. O swagger real da 3C Plus corrige essa premissa: **a 3C Plus opera em saldo pré-pago** (`Company.balance`, recarregado via `POST /company/generate-bill`, sem fatura mensal), e expõe dados suficientes para calcular o custo real por Time programaticamente:

1. **Cálculo automático (caminho primário)**: cron mensal (Vercel Cron) chama `GET /calls?campaigns[]={campaignId}&start_date=...&end_date=...` para cada `DialerCampaign` do Time (1 campanha 3C Plus = 1 Time, Hipótese A1), soma `speaking_time` das chamadas do período, e aplica a tarifa vigente obtida em `GET /routes` (`Route.telephony-rates` → `TelephonyRate.value`/`cadence`/`minimum_duration`) para chegar em `custoRepasse3CPlus`. Grava em `DialerPassthroughReconciliation` com `source = "api"`.
2. `precoCobradoCliente` continua calculado como antes: `DialerSeat` ativos × `SEAT_PRICE_BRL` + `DialerUsage.overageCharged` do mês.
3. **Fallback manual**: se o cálculo automático divergir de forma inexplicada do saldo real da 3C Plus (`Company.balance` monitorado antes/depois do período) — por exemplo, se existir algum custo adicional não capturado pelas chamadas de campanha (ex.: chamadas manuais fora de campanha, `Call.mode = "manual"`, ou taxas não relacionadas a chamada) — o Backoffice pode sobrescrever `custoRepasse3CPlus` manualmente, marcando `source = "manual"` e preenchendo `notes` com a justificativa.
4. Tela de Backoffice lista os Times do mês com a reconciliação calculada, permitindo conferência/ajuste manual — nunca opaca (risco #5 da auditoria): sempre mostrar `precoCobradoCliente`, `custoRepasse3CPlus` e a margem lado a lado.
5. **Ainda a confirmar antes de fechar esse desenho como definitivo** (seção 2.2 da auditoria): (a) se existe um endpoint de relatório financeiro pronto (`DailyFinanceStats` aparece no schema da 3C Plus mas está órfão neste export do swagger — pode já existir sob um path não documentado aqui, valeria confirmar com o suporte da 3C Plus antes de implementar o cálculo por `GET /calls` do zero); (b) se `GET /calls` com `campaigns[]` grande o suficiente é paginado de forma viável para o volume esperado.

---

## 5. Frontend

Estrutura `features/` já existente em `app/[supabaseId]/dialer/` (não recriar — só estender).

### Telas novas desta versão

1. **Ativação do Dialer (`/dialer/settings` ou seção dentro de `/dialer`)**: `Card` com plano atual, CTA "Ativar Discadora" (`Dialog` com `FieldGroup`/`Field`, seleção de plano via `RadioGroup` ou `Select`), preço por assento e minutos inclusos exibidos por plano. Estado sem assinatura mostra `Empty`/CTA; estado ativo mostra `Badge` de status (`active`/`suspended`/`canceled`).
2. **Gestão de assentos**: `Table` de operadores do Time com coluna de status do assento (`Badge`: `pending`/`active`/`suspended`), ação "Solicitar assento" por operador sem assento (abre fluxo de pagamento — reaproveitar o padrão visual de `PaymentDialog` já usado no fluxo de operador comum, com PIX/cartão via Asaas).
3. **`DialerUsageCard`**: consumo de minutos do ciclo (`Progress` + texto `minutesUsed/minutesLimit`) + excedente do mês (`overageMinutes`/`overageCharged`) + CTA de upgrade de plano.
4. **Painel de reconciliação (Backoffice)**: `Table` com colunas Time, mês, `precoCobradoCliente`, `custoRepasse3CPlus` (editável inline ou via `Dialog` de edição), margem calculada (`precoCobradoCliente - custoRepasse3CPlus`, com tratamento visual — `Badge` destrutivo se margem negativa), status de reconciliação (`Badge`: pendente/reconciliado).

### Telas herdadas sem mudança estrutural

- Lista de campanhas, criação de campanha, upload de contatos (`CampaignCard`, `CreateCampaignDialog`, `UploadContactsDialog`) — já implementadas, agnósticas de provedor.
- `TeamCallsPanel`/painel ao vivo (Estágio 6) — o desenho de broadcast/realtime da spec antiga (seção "Painel realtime" do `TWILIO_AUTO_DIALER_SPEC.md`) é reaproveitado sem alteração: o que muda é apenas a origem do evento (webhook 3C Plus em vez de webhook Twilio), não a mecânica de broadcast.

Governança visual obrigatória de sempre: `DESIGN.md` + skill `corretor-studio-design` antes do JSX; componentes via shadcn MCP; tokens semânticos, nunca hex ou cores Tailwind cruas; `sonner` para toasts; lock de request nos botões de pagamento/ativação.

---

## 6. Estágios (PRs incrementais)

> Estágio 1 já está implementado na branch `claude/loving-wozniak-y4bmrd` (PR #306) — listado aqui só para referência de escopo, **não refazer**.

### Estágio 1 — Fundação (já implementado, referência apenas)

**Escopo já em produção na branch**: schema `DialerCampaign`/`DialerContact`/`DialerCall`/`DialerUsage`/`DialerSubscription`; migration `20260611125755_add-dialer-module.sql`; CRUD de campanha + upload Excel/JSON; feature flag `voice`; frontend de lista/criação de campanha.

**Não tocar**: `app/api/infra/data/repositories/dialer/*`, `app/api/useCases/dialer/DialerCampaignUseCase.ts`, `app/api/services/DialerContactParser/*`, a migration já commitada, `lib/features/feature-slugs.ts`/`feature-product-slug-map.ts`/`feature-route-access.ts` (já corretos).

---

### Estágio 2 — Schema de billing com repasse (sem 3C Plus ainda)

**Prompt Codex:**
```
Criar migration Supabase (bun run db:migrate:new dialer-billing-passthrough) e os modelos Prisma
correspondentes para: (1) renomear Team.twilio* removendo os 7 campos Twilio-específicos (nenhum dado
real existe); (2) renomear DialerCall.twilioCallSid -> providerCallId e recordingSid -> providerRecordingId;
(3) criar os modelos DialerSeat, PendingDialerSeat e DialerPassthroughReconciliation exatamente como
descritos na seção 3.2 de docs/DIALER_SPEC.md; (4) adicionar overageMinutes e overageCharged em
DialerUsage. RLS nas tabelas novas sem policy de SELECT para o client, mesmo padrão da migration de
fundação. Rodar bun run prisma:db:push local e bun run db:diff para conferir o SQL gerado antes de
finalizar a migration. Não aplicar no remoto.
```

**Não tocar**: qualquer campo/modelo fora dos listados; a migration de fundação já commitada (criar migration nova).

**Critérios de aceite**:
- `bun run prisma:db:push` local aplica sem erro; `bun run db:migrate:reset:local` recria o banco do zero com a nova migration.
- `DialerSeat`/`PendingDialerSeat`/`DialerPassthroughReconciliation` aparecem no client Prisma gerado com os relations corretos.
- Nenhuma referência a `twilio*` sobrevive em `prisma/schema.prisma`.

**Validação manual**: rodar `bun run typecheck` após regenerar o client — nenhum arquivo deve quebrar (esperado, já que nada em código usa os campos Twilio ainda, conforme a auditoria confirmou).

---

### Estágio 3 — `DialerBillingService` + ativação/assinatura + assentos (billing puro, sem 3C Plus)

**Prompt Codex:**
```
Implementar app/api/services/DialerBilling/{IDialerBillingService,DialerBillingService}.ts com as
constantes SEAT_PRICE_BRL / INCLUDED_MINUTES_PER_SEAT / OVERAGE_RATE_PER_MINUTE_BRL (seção 4.2 de
docs/DIALER_SPEC.md), métodos activateSubscription, requestSeat (cria PendingDialerSeat + cobrança
Asaas com externalReference "dialer-seat:" + teamId + ":" + operatorId), confirmSeatPayment (chamado
pelo roteamento de webhook Asaas por prefixo, mesmo padrão de PendingOperator em
app/api/useCases/subscriptions/SubscriptionUpgradeUseCase.ts), suspendSeat, calculateOverage (mesmo
algoritmo de EmailCreditService.deductCredits em app/api/services/EmailCredit/EmailCreditService.ts,
adaptado para minutos). Criar ActivateDialerUseCase, DialerSeatUseCase (request/list/cancel) retornando
Output. Rotas api/v1/dialer/subscription (POST/DELETE), api/v1/dialer/seats (GET/POST),
api/v1/dialer/seats/[seatId] (DELETE), api/v1/dialer/usage (GET) usando getTeamAccess() e TeamContext
propagado até o repository WithCtx. Métodos WithCtx novos em IDialerRepository/DialerRepository para
DialerSeat/PendingDialerSeat. Atualizar postman/Lead-Flow-API-Collection.json e
Lead-Flow-Environment.json. Não criar nenhum client/adapter de 3C Plus nesta etapa — billing é
inteiramente independente do provedor de voz.
```

**Não tocar**: `IVoiceProvider` (não existe ainda, não criar nesta etapa); qualquer lógica de discagem/campanha; `PaymentValidationService` além de adicionar o novo prefixo de roteamento.

**Critérios de aceite**:
- Solicitar assento sem `DialerSubscription` ativa retorna erro claro (`Output(false, ...)`).
- `confirmSeatPayment` é idempotente (reprocessar o mesmo webhook não duplica `DialerSeat`).
- Cálculo de excedente bate com o exemplo: plano `dialer_basic` (150 min inclusos/assento, R$0,45/min excedente), 2 assentos ativos, 350 min usados no mês → 50 min de excedente → R$22,50.

**Validação manual**: sandbox Asaas — ativar assinatura, solicitar assento, confirmar pagamento (PIX simulado), checar `DialerSeat.status = active` e `PendingDialerSeat.seatActivated = true`; cancelar assento e checar suspensão sem apagar histórico.

---

### Estágio 4 — `IVoiceProvider` (adapter) + integração de leitura/campanha 3C Plus (**implementado em 2026-07-21**)

`app/api/services/VoiceProvider/IVoiceProvider.ts` (interface, sem nenhum import de `Output`/Asaas/billing) +
`app/api/services/VoiceProvider/ThreeCPlusVoiceProvider.ts` (implementação real) + `lib/dialer/secret-crypto.ts`
(AES-256-GCM, `DIALER_ENCRYPTION_KEY`) + migration `20260721212021_dialer-3cplus-mode.sql` (`Team.dialer3cplusMode`,
`dialer3cplusAccountId`, `dialer3cplusApiToken`) + env vars `THREECPLUS_API_BASE_URL`/`THREECPLUS_API_TOKEN`
(`.env.example`, `lib/env/validation.ts`). Suporta os dois caminhos da Decisão A via `Team.dialer3cplusMode`.

Detalhes de payload confirmados durante a implementação (evitar retrabalho — ver seção 4.1): `POST /teams`,
`POST /users` e `PUT /teams/{id}` usam `application/x-www-form-urlencoded`; `POST /campaigns/{id}/lists/{list-id}/mailing.json`
é o único endpoint tocado que consome JSON de verdade; `GET /calls` retorna array direto (`CallHistoryReport[]`,
sem wrapper); `GET /campaigns/{id}/statistics` retorna `{data: [...]}` com uma linha por dia (sem total de contatos
da campanha — só contagens de atendida/não atendida/abandonada/falha por dia, que `getCampaignStatus` soma no range).

**Pendente, não incluído nesta etapa (fica para o Estágio 6, exige acesso real a uma company 3C Plus)**: a
validação manual do parâmetro `url` da campanha apontando para um endpoint de log (decide se o Estágio 6 usa
webhook HTTP simples ou exige um cliente Socket.IO persistente — seção 4.3) e a validação do host SIP/WSS do
webphone (seção 2, Decisão B) não foram feitas — ambas dependem de credenciais reais/sandbox da 3C Plus, que
não estavam disponíveis nesta rodada. `createAgent` lança erro explícito quando `dialer3cplusMode = own_account`
(não é mais "aguardando decisão" — é uma regra de negócio real: nesse modo o Time gerencia os próprios usuários).

**Não tocado**: `DialerBillingService`/`ActivateDialerUseCase`/`DialerSeatUseCase` (Estágio 3, sequência
independente); nenhuma rota de billing; nenhuma rota `/api/v1/dialer/*` nova (este estágio só entrega os
services de adapter, sem rota HTTP ainda — rotas de discagem chegam no Estágio 6).

**Ainda por fazer antes de considerar o Estágio 4 fechado**: rodar `bun run prisma:db:push` local +
`bun run db:migrate:reset:local` (não executado nesta rodada por falta de Docker/Supabase local no ambiente)
para confirmar que a migration aplica limpo; testes unitários do `ThreeCPlusVoiceProvider` mockando `fetch`
(nenhum teste foi criado ainda — mesma lacuna já sinalizada para o restante do módulo Dialer).

---

### Estágio 5 — Provisionamento de agente/assento na 3C Plus (desbloqueado — Decisão A resolvida como "os dois caminhos")

Como a Decisão A não escolhe mais uma hipótese única, o provisionamento de assento passa a ramificar por
`Team.dialer3cplusMode` em vez de depender de uma confirmação comercial prévia:

**Prompt Codex:**
```
Ligar DialerSeatUseCase.confirmSeatPayment (Estágio 3) a app/api/services/VoiceProvider/ThreeCPlusVoiceProvider.ts
(Estágio 4) ramificando por Team.dialer3cplusMode: sob "master", chamar IVoiceProvider.createAgent() +
assignAgentToTeam() para provisionar o operador de verdade na conta mestre; sob "own_account", não chamar
createAgent (ele já lança erro explícito nesse modo) — em vez disso, checar que Team.dialer3cplusApiToken
está configurado (senão retornar Output(false, ...) pedindo para o Manager conectar a credencial numa tela
dedicada antes de solicitar assentos). Qualquer que seja o modo, suspensão de assento deve suspender o
billing antes de suspender/remover o agente na 3C Plus, nunca ao contrário (risco #3 da auditoria). Ativar
o modo "master" para um Time específico continua sendo uma decisão operacional (confirmar com comercial/
parceria da 3C Plus antes de apontar times de produção para a conta mestre) — não bloqueia o código, só
o rollout.
```

**Não tocar**: nada além do necessário para ligar Estágio 3 (billing) ao Estágio 4 (adapter) — não redesenhar nenhum dos dois.

**Critérios de aceite**:
- Modo `master`: confirmar pagamento cria o agente na 3C Plus via API e vincula `DialerSeat.providerAgentId`.
- Modo `own_account`: confirmar pagamento sem `Team.dialer3cplusApiToken` configurado retorna erro claro sem criar `DialerSeat(active)`.
- Suspensão de assento sempre suspende o billing primeiro (testável independente do modo).

---

### Estágio 6 — Discagem ao vivo + painel realtime + webphone nativo embutido

**Pré-requisito**: a validação manual do Estágio 4 (campanha de teste com `url` apontando para um log — não feita ainda, ver nota no Estágio 4) precisa responder se a 3C Plus entrega eventos de chamada por webhook HTTP simples ou só por Socket.IO antes de escolher entre as variantes A/B abaixo. Este estágio também precisa da validação ao vivo do host SIP/WSS do webphone (seção 2, Decisão B) antes de codificar `DialerWebphoneHook`.

**Escopo novo desta versão — webphone nativo (Decisão B resolvida)**: além do consumo de eventos (variantes A/B abaixo, inalteradas), este estágio ganha um componente `DialerWebphoneHook`/`DialerWebphone` (paralelo ao antigo `DialerDeviceHook` do plano Twilio) usando um cliente SIP/WebRTC no navegador (JsSIP é a opção mais comum e leve para esse caso; validar contra o host SIP real antes de fixar a biblioteca). Autenticação via um novo endpoint interno (`GET /api/v1/dialer/webphone-credentials` ou similar) que chama `IVoiceProvider`/`ThreeCPlusVoiceProvider` para obter `extension_number`/`extension_password` do operador sem expor a chamada direta à 3C Plus no client — o navegador nunca vê o `api_token` da 3C Plus, só a credencial SIP do próprio operador.

**Prompt Codex (variante A — `url` de campanha entrega webhook HTTP utilizável):**
```
Implementar o consumo de eventos de chamada da 3C Plus via app/api/webhooks/3cplus-voice/route.ts:
mapear os eventos recebidos no payload real (confirmado na validação manual do Estágio 4) para status
de DialerCall (usando o enum DialerCallStatus já existente), persistir via IDialerRepository.WithCtx, e
retransmitir via broadcast Supabase Realtime reaproveitando o desenho de
docs/TWILIO_AUTO_DIALER_SPEC.md seção 5 ("Painel realtime — broadcast"), incluindo o canal privado
dialer:team:{teamId}, o payload tipado compartilhado front/back e o watchdog via Vercel Cron para
chamadas travadas. Implementar hooks/useDialerRealtime.ts e o componente TeamCallsPanel no frontend
seguindo a mesma estrutura descrita na spec antiga (que é agnóstica de provedor). Não implementar
nenhuma lógica de "próxima discagem" no lado Lead Flow — isso é responsabilidade da 3C Plus
internamente (diferença arquitetural da seção 1).
```

**Prompt Codex (variante B — só Socket.IO disponível, exige processo persistente):**
```
Implementar um pequeno serviço Node sempre ativo (fora do runtime serverless do Vercel — avaliar a VPS
Hostinger já usada para outros serviços) que conecta via socket.io-client ao canal da company 3C Plus
(socket_channel configurado em PUT /company/settings, autenticado via query token) e escuta os eventos
documentados (call-was-created, call-was-answered, call-was-connected, call-was-ended,
call-was-finished, call-was-abandoned, call-was-abandoned-due-amd, call-was-not-answered,
call-was-failed, call-history-was-created — catálogo completo em docs/DIALER_3CPLUS_AUDIT.md seção
2.1). Esse processo traduz cada evento numa chamada HTTP autenticada (CRON_SECRET ou token dedicado)
para uma rota interna do Lead Flow (ex.: app/api/webhooks/3cplus-voice/route.ts) que persiste via
IDialerRepository.WithCtx e retransmite via broadcast Supabase Realtime — a partir daqui, o resto é
igual à variante A (canal dialer:team:{teamId}, TeamCallsPanel, watchdog).
```

**Não tocar**: `IVoiceProvider`/`ThreeCPlusVoiceProvider` (Estágio 4, salvo extensão pontual de mapeamento de evento); billing.

**Critérios de aceite**: 2 operadores em navegadores diferentes veem o painel do time atualizar em tempo real; reconexão re-sincroniza via snapshot; Time A não recebe eventos do Time B (isolamento de canal).

---

### Estágio 7 — Gravações, histórico e lead a partir da ligação

Mesmo desenho da spec antiga (seção "Lead a partir da ligação + gravação protegida"), trocando a origem da gravação de Twilio para 3C Plus (download via API/URL fornecida pelo webhook, mesmo padrão de `DialerJob(archive_recording)` para mover ao Supabase Storage). `LeadAttachment.isProtected` e o bloqueio de exclusão não mudam.

**Critérios de aceite**: idênticos aos da spec antiga (seção 12, item PR 5) — gravação anexada ao lead não pode ser excluída; job de arquivamento é idempotente.

---

### Estágio 8 — Painel de reconciliação de repasse (Backoffice)

**Prompt Codex:**
```
Implementar rotas api/v1/backoffice/dialer/reconciliation (GET) e
api/v1/backoffice/dialer/reconciliation/[id] (PUT) usando getBackofficeAccess() (nunca getTeamAccess(),
regra de isolamento do módulo backoffice em agents.md). Criar cron mensal (Vercel Cron) que gera uma
linha DialerPassthroughReconciliation por Time com dialerEnabled=true, calculando precoCobradoCliente
a partir de DialerSeat ativos x SEAT_PRICE_BRL + DialerUsage.overageCharged do mês. Tela de Backoffice
(seguindo app/backoffice/** já existente) listando Times/meses com custoRepasse3CPlus pendente,
permitindo preenchimento manual e exibindo a margem calculada (precoCobradoCliente -
custoRepasse3CPlus) com destaque visual quando negativa.
```

**Não tocar**: qualquer rota/service fora do módulo backoffice; não importar services/useCases de produto no código backoffice (regra de isolamento do `agents.md`).

**Critérios de aceite**: cron gera exatamente 1 linha por Time/mês (idempotente — reexecução no mesmo mês não duplica); preenchimento manual do custo persiste `reconciledAt`/`reconciledByProfileId`; margem negativa é visualmente destacada.

---

### Estágio 9 — Hardening

Rate limit no webhook `3cplus-voice`; mascaramento de telefone no painel para quem não é dono da chamada; revisão final de Postman/governança; confirmar se a automação de reconciliação via API (seção 4.5) é viável com a documentação real da 3C Plus obtida nesse ponto.

---

## 7. Verificação (todas as etapas)

- Cada estágio: `bun run typecheck && bun run lint && bun run governance:check && bun run lint:pt-br` (+ `bun run design:check` em mudanças de UI).
- Migrations: apenas locais (`bun run db:migrate:reset:local`); push remoto **somente com autorização do owner**.
- Testes obrigatórios sem exceção (regra do `agents.md`), com ênfase em: cálculo de excedente de minutos (Estágio 3), idempotência de `confirmSeatPayment` e do webhook de chamada (Estágios 3 e 6), geração idempotente da reconciliação mensal (Estágio 8).

---

## 8. Riscos (herdados da auditoria + novos desta versão)

1. **Decisão A resolvida como "os dois caminhos", mas a confirmação contratual com a 3C Plus para operar o modo `master` em nome de múltiplos Times continua pendente** — não é mais um bloqueio de código (Estágio 5 desbloqueado), mas é um bloqueio de rollout: não apontar Times de produção para `dialer3cplusMode = master` antes dessa confirmação comercial.
2. **Preços de exemplo da seção 4.2 são placeholders** — não têm base em custo real de repasse ainda desconhecido; revisar assim que houver visibilidade da fatura 3C Plus real (mesmo que só após os primeiros meses de reconciliação manual).
3. **Ausência de sandbox/trial 3C Plus confirmado** — ao contrário do Twilio (que tem trial documentado com magic numbers), não há confirmação pública de um ambiente de teste gratuito da 3C Plus; isso já afetou o Estágio 4 (implementado só com testes unitários mockados, sem validação end-to-end contra a API real) e continua bloqueando a validação ao vivo exigida pelos Estágios 4/6 (payload do webhook de campanha, host SIP/WSS do webphone).
4. **Webphone nativo (Decisão B) depende de um host SIP/WSS não documentado publicamente** — o desenho do `DialerWebphoneHook` (Estágio 6) só pode ser fechado depois de uma validação ao vivo (DevTools no webphone real da 3C Plus, ou contato direto com o suporte).
5. Riscos #2, #3, #4, #5, #6, #7 do `DIALER_3CPLUS_AUDIT.md` seção 4 permanecem válidos e são endereçados pelos Estágios 2-8 acima.

---

## 9. Referências

- Auditoria desta rodada: `docs/DIALER_3CPLUS_AUDIT.md`.
- Spec substituída (histórico, Estágio 1 ainda válido): `docs/TWILIO_AUTO_DIALER_SPEC.md`.
- Precedente de overage: `app/api/services/EmailCredit/EmailCreditService.ts`.
- Precedente de recurso pago gated por confirmação: `app/api/useCases/subscriptions/SubscriptionUpgradeUseCase.ts`.
- Padrão de jobs: `docs/specs/email-dispatch.md`.
- Realtime de referência: `hooks/useLeadActivitiesRealtime.ts`.
- Output contract: `lib/output/index.ts`.
- **Spec OpenAPI real da 3C Plus (fonte primária desta versão)**: `https://app.3c.plus/api/v1/swagger.json` (carregada por `https://api-docs.3c.fluxoti.com/`) — 159 endpoints, usada para toda a tabela de mapeamento da seção 4.1 e o desenho de billing da seção 4.5. Baixar de novo antes de implementar cada estágio para conferir se a versão publicada mudou.
- Documentação complementar (não substitui o swagger acima): `3cplusnow.com/desenvolvedores/`, `alo.3cplusnow.com/help/voz`, collection Postman `https://documenter.getpostman.com/view/25269027/2sA3JT1cqi` (SPA — abrir dentro do app Postman ou via `curl` no JSON cru servido por `https://documenter.gw.postman.com/api/collections/25269027/2sA3JT1cqi?segregateAuth=true&versionTag=latest`, não via fetch simples de HTML). Usada na Decisão B (seção 2) para confirmar os campos `extension_password`/`telephony_id`/`webphone-authenticate`.
