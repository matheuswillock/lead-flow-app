# Spec: Bethânia — Bot N8N do Corretor Studio

Introduz a **Bethânia**, assistente conversacional do Corretor Studio orquestrada por **N8N** (sem LLM em v1), para notificações bidirecionais com usuários do produto (MASTER, MANAGER, OPERATOR): consulta de leads, upload de documentos, agendamento de reuniões e criação de tarefas — com autenticação híbrida e canal gerenciado exclusivamente pelo backoffice interno.

## Background

### Problema

Corretores e gestores operam em mobilidade e precisam consultar leads, registrar ações e receber alertas sem abrir o CRM completo. Hoje o produto oferece notificações in-app, e-mail, web push e WhatsApp **por time** para conversar com **leads** — mas não há canal dedicado para o **usuário do produto** interagir com o Corretor Studio de forma conversacional e acionável.

### Estado atual relevante

| Área | Referência no código |
|------|----------------------|
| Leads, tarefas, agenda | `app/api/v1/leads/`, `app/api/v1/tasks/`, `app/api/v1/leads/[id]/schedule/` |
| Notificações in-app | `Notification`, `NotificationService`, `app/api/v1/notifications/` |
| Permissões por time | `app/api/v1/utils/teamAccess.ts` — `hasLeadAccess`, `hasLeadActivityAccess` |
| Feature slugs | `lib/features/feature-slugs.ts`, `FeatureAccessService` |
| WhatsApp de leads (por time) | `TeamWhatsAppConfig`, `WhatsAppConversation`, `app/[supabaseId]/whatsapp/` |
| Inbox WhatsApp produto (componentes reutilizáveis) | `WhatsAppInboxContainer`, `ConversationList`, `ConversationItem`, `MessagePanel`, `MessageBubble`, `formatWhatsAppMessageText` em `app/[supabaseId]/whatsapp/features/` |
| WhatsApp provisionado (backoffice) | `app/backoffice/(app)/whatsapp/`, `BackofficeWhatsAppInstanceUseCase` |
| Minha conta / Conexões | `app/[supabaseId]/account/page.tsx` — aba `connections` (Google Calendar) |
| Webhook de leads externos | `app/api/webhooks/studio/[teamId]/[token]/` (n8n já citado na UI de integrações) |
| E-mail transacional | Resend |
| Dev local Evolution (Docker) | `docker-compose.evolution.yml`, `.env.evolution.example`, scripts `evo:*`, `scripts/dev-local.ts` (`--skip-evo`) |
| Dev local N8N (Docker) | **A implementar** — espelhar padrão Evolution: `docker-compose.n8n.yml`, `.env.n8n.example`, scripts `n8n:*`, `dev-local.ts` (`--skip-n8n`) |

### Lacunas

- Sem modelo de sessão bot nem vínculo phone → `Profile`.
- Sem fluxo de verificação via barra de notificações + e-mail.
- Sem webhooks outbound do domínio para N8N.
- Sem API enxuta de contexto de lead para orquestração externa.
- `WhatsAppConversation` é domínio de **leads**, não de usuários do produto.

### Gatilho

Necessidade de um bot de plataforma (**Bethânia**) para conversas usuário ↔ Corretor Studio, com automação N8N (v1 sem LLM), controle de permissões por papel e gestão centralizada no backoffice.

### Separação crítica do WhatsApp existente

```mermaid
flowchart LR
  subgraph product [Produto por time]
    TeamWA[WhatsApp do time]
    LeadInbox[Inbox com leads]
    TeamWA --> LeadInbox
  end

  subgraph platform [Plataforma backoffice]
    Bethania[Bethania Canal Studio]
    N8N[N8N workflows]
    Bethania --> N8N
  end

  User[Corretor ou Gestor] -->|mensagens| Bethania
  N8N -->|APIs v1| CSAPI[Corretor Studio API]
  CSAPI --> LeadsDB[(Leads Tasks Schedule)]
```

**Não reutilizar** `WhatsAppConversation` para sessões da Bethânia — misturaria domínios, permissões e billing.

## Goals

### Primários (must-have)

1. **Bethânia** como assistente menu-driven (comandos + botões WhatsApp) entre usuário **verificado** e Corretor Studio.
2. **Autenticação híbrida** com log unificado em `BackofficeBotAuthChallenge`:
   - **Caminho A (canal):** e-mail no chat → código na barra de notificações + e-mail → validação no chat.
   - **Caminho B (OTP web):** Minha conta → Conexões → Vincular Bethânia → `VINCULAR {código}` no chat.
3. Consulta de leads no escopo do usuário (MASTER / MANAGER / OPERATOR).
4. Ações no lead: nota, anexo, agendar/remarcar/cancelar reunião, criar tarefa.
5. Notificações push acionáveis via N8N (reunião, tarefa, lead atribuído).
6. Gestão do canal no backoffice: status, logs, vinculações, auditoria de auth.
7. Auditoria em `LeadActivity` com origem `studio_bot` / identidade Bethânia.

### Secundários

8. Preferências de notificação da Bethânia por usuário.
9. Deep links do chat para telas do CRM web.
10. Digest matinal opt-in para MANAGER+ (`RESUMO`).

## Non-Goals

- LLM / NLU / interpretação de texto livre em v1.
- Bethânia respondendo **clientes finais** (leads) — permanece no módulo WhatsApp por time.
- Transferência de lead, edição cadastral ampla, chat entre usuários.
- UI de **gestão** do bot no produto — apenas backoffice interno; touchpoints de produto limitados a Conexões + notificações.
- **Envio manual de mensagens** pelo backoffice em v1 — inbox backoffice é read-only; outbound automatizado via N8N.
- OTP gerado manualmente no backoffice.
- Multi-canal além do primário em v1 (arquitetura extensível; implementar um canal).
- Alterar copy ou fluxo da landing page.

## Design

### Technical Approach

Seguir arquitetura canônica (`agents.md`):

```text
Webhook / Route -> UseCase -> [Service] -> Repository -> Prisma
```

**Componentes:**

| Componente | Responsabilidade |
|------------|------------------|
| **Canal plataforma** | Número único gerido no backoffice (WhatsApp Business via Evolution, alinhado ao stack) |
| **N8N** | State machine, menus, retries, rate limit, templates HSM |
| **Webhook inbound** | `app/api/webhooks/backoffice/studio-bot/` — HMAC, idempotency |
| **Bot API (produto)** | `app/api/v1/bot/*` — auth, contexto, ações (phone link) |
| **Bot API (backoffice)** | `app/api/v1/backoffice/bot/*` — canal, auditoria, admin |
| **BotPolicyService** | Espelha `getTeamAccess` + `hasLeadAccess` / `hasLeadActivityAccess` |
| **Event dispatcher** | `BackofficeBotEventOutbox` → webhooks N8N |
| **Backoffice UI** | `app/backoffice/(app)/studio-bot/` |

```mermaid
sequenceDiagram
  participant U as Usuario
  participant CH as Canal_Plataforma
  participant N8N as N8N
  participant WH as Webhook_CS
  participant API as API_v1
  participant UC as UseCase

  U->>CH: mensagem inbound
  CH->>N8N: evento normalizado
  N8N->>WH: POST phone + payload
  WH->>API: resolve sessao + permissao
  API->>UC: acao de negocio
  UC-->>API: Output
  API-->>N8N: resposta estruturada
  N8N-->>CH: mensagem formatada
  CH-->>U: resposta

  Note over API,N8N: Eventos outbound
  API->>N8N: webhook evento
  N8N->>CH: push notification
```

Toda mutação revalida permissões no backend — **nunca confiar só no N8N**.

### Desenvolvimento local — N8N (Docker)

Espelha o padrão já estabelecido pela **Evolution API** no repositório (`docker-compose.evolution.yml`, `evo:*`, `scripts/dev-local.ts`). O N8N roda em stack Docker **isolada** do Supabase do app (55322). A Evolution usa Supabase remoto dedicado (`supabase-evolution/`) — compose só API + Redis.

#### Topologia local

```mermaid
flowchart LR
  subgraph host [Host Windows ou Mac]
    App[Next.js :3000]
    Evo[Evolution :8080]
    N8N[N8N :5678]
  end

  WA[WhatsApp] --> Evo
  Evo -->|webhook inbound| N8N
  N8N -->|POST /api/webhooks/backoffice/studio-bot/*| App
  App -->|eventos outbound| N8N
  N8N -->|send message| Evo
  Evo --> WA
```

- Comunicação entre containers e o host via `host.docker.internal` (mesmo padrão de `EVO_WEBHOOK_PUBLIC_URL`).
- Em dev local, a Bethânia usa a **Evolution existente** com instância dedicada `bethania` — separada das instâncias WhatsApp de leads por time.

#### Arquivos propostos (Fase 1)

| Arquivo | Propósito |
|---------|-----------|
| `docker-compose.n8n.yml` | Serviço `n8n` + `n8n-postgres` dedicado |
| `.env.n8n.example` | Credenciais, `N8N_ENCRYPTION_KEY`, timezone, URLs de webhook |
| `.env.n8n` | Gitignored; bootstrap de `.env.n8n.example` no primeiro `bun dev` |

Referência de implementação Evolution: [`docker-compose.evolution.yml`](../docker-compose.evolution.yml), [`.env.evolution.example`](../.env.evolution.example).

#### Especificação do Compose

| Item | Valor |
|------|-------|
| Imagem | `docker.io/n8nio/n8n:latest` (fixar tag em produção) |
| Porta host | `127.0.0.1:5678:5678` |
| Volume | `n8n_data` — workflows e credenciais |
| Postgres | `n8n-postgres` — `postgres:15-alpine`, credenciais fixas `n8n` / `n8n` (sem colidir com Supabase ou Evolution) |
| `extra_hosts` | `host.docker.internal:host-gateway` |
| Healthcheck | `GET http://127.0.0.1:5678/healthz` |
| Rede | `n8n-net` (bridge isolada) |

Exemplo esquemático do serviço `n8n` (documentação — implementar em Fase 1):

```yaml
services:
  n8n:
    image: docker.io/n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    depends_on:
      n8n-postgres:
        condition: service_healthy
    ports:
      - "127.0.0.1:5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - n8n-net
    env_file:
      - .env.n8n
    extra_hosts:
      - "host.docker.internal:host-gateway"
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1:5678/healthz || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 30s
```

#### Scripts Bun (espelhar `evo:*`)

```json
"n8n:up": "docker compose -f docker-compose.n8n.yml --env-file .env.n8n up -d",
"n8n:down": "docker compose -f docker-compose.n8n.yml --env-file .env.n8n down",
"n8n:reset": "docker compose -f docker-compose.n8n.yml --env-file .env.n8n down -v && docker compose -f docker-compose.n8n.yml --env-file .env.n8n up -d",
"n8n:logs": "docker compose -f docker-compose.n8n.yml --env-file .env.n8n logs -f n8n"
```

#### Integração `bun run dev`

Espelhar [`scripts/dev-local.ts`](../scripts/dev-local.ts):

| Comportamento | Detalhe |
|---------------|---------|
| Auto-start | Se N8N não responde em `:5678`, executa `bun run n8n:up` e aguarda healthcheck |
| Bootstrap | `bootstrapN8nEnv()` — copia `.env.n8n.example` → `.env.n8n` se ausente |
| Flag | `--skip-n8n` — não sobe nem valida N8N (como `--skip-evo`) |
| Overrides | `getLocalN8nOverrides()` injeta `N8N_BASE_URL` e secrets no processo Next.js |
| Ordem preflight | Supabase → Evolution → **N8N** → Next.js |

#### Variáveis de ambiente (N8N + Bethânia)

| Variável | Dev local | Produção |
|----------|-----------|----------|
| `N8N_BASE_URL` | `http://127.0.0.1:5678` | URL do serviço N8N |
| `N8N_WEBHOOK_BASE_URL` | `http://host.docker.internal:5678` | URL que Evolution e outros containers usam para chamar N8N |
| `BACKOFFICE_N8N_OUTBOUND_URL` | `http://127.0.0.1:5678/webhook/bethania-outbound` | Webhook CS → N8N (eventos outbound) |
| `BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET` | chave local compartilhada (HMAC) | Secret produção |
| `N8N_BETHANIA_INBOUND_PATH` | `/webhook/bethania-inbound` | Path do workflow inbound |
| `EVO_BETHANIA_INSTANCE` | `bethania` | Nome da instância Evolution da Bethânia |
| `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER` | número de teste | Número oficial |

`bun run dev` lê secrets de `.env.n8n` quando `N8N_BASE_URL` aponta para localhost — mesmo padrão de `EVO_API_KEY` ← `AUTHENTICATION_API_KEY` em `.env.evolution`.

Documentar também em `.env.example` (Fase 1), na mesma seção das vars Evolution.

#### Primeiro uso (checklist dev)

1. Docker Desktop em execução.
2. `cp .env.n8n.example .env.n8n` (ou deixar o `bun dev` criar automaticamente).
3. `bun run dev` — sobe Supabase + Evolution + N8N.
4. UI N8N: `http://127.0.0.1:5678` — criar usuário admin no primeiro acesso.
5. Importar workflows base (Fase 2) a partir de `n8n/workflows/`.
6. Na Evolution: instância `bethania` com webhook apontando para `{N8N_WEBHOOK_BASE_URL}{N8N_BETHANIA_INBOUND_PATH}`.
7. No backoffice (quando UI existir): `BackofficeBotChannel.n8nInboundUrl` e secrets alinhados.

Comandos úteis isolados:

```bash
bun run n8n:up      # sobe stack
bun run n8n:logs    # acompanha logs
bun run n8n:down    # para stack
bun run n8n:reset   # recria volumes (postgres desatualizado)
bun run dev -- --skip-n8n   # dev sem Bethânia/N8N
```

#### Troubleshooting

| Sintoma | Ação |
|---------|------|
| N8N não sobe | `bun run n8n:logs` |
| Container Postgres em crash-loop | `bun run n8n:reset` e reiniciar `bun dev` |
| Webhook N8N não alcança o app | Conferir `host.docker.internal:3000` e firewall |
| Evolution não alcança N8N | Conferir `N8N_WEBHOOK_BASE_URL` em `.env.n8n` |
| Dev sem Bethânia | `bun run dev -- --skip-n8n` |

### Autenticação híbrida

Ambos os caminhos convergem em `BackofficeBotAuthChallenge` + `POST /api/v1/bot/auth/verify-code`. Campo `source`: `channel_email` | `web_otp`.

```mermaid
flowchart TB
  subgraph pathA [Caminho A Canal]
    A1[Usuario manda Oi]
    A2[Bethania pede email]
    A3[request-code]
    A4[Notification + email]
    A5[Usuario cola codigo]
  end

  subgraph pathB [Caminho B OTP Web]
    B1[Minha conta Conexoes]
    B2[link/initiate]
    B3[Codigo na tela]
    B4[VINCULAR no chat]
  end

  A5 --> Verify[verify-code]
  B4 --> Verify
  Verify --> Link[BackofficeBotUserLink]
  Link --> Menu[Menu principal]
```

#### Caminho A — Fluxo no canal

```mermaid
sequenceDiagram
  participant U as Usuario
  participant B as Bethania_N8N
  participant API as API_CS
  participant Notif as Barra_Notificacoes
  participant Email as Resend

  U->>B: primeiro contato
  B->>U: saudacao + pedir email
  U->>B: informa email
  B->>API: POST /bot/auth/request-code
  API->>Notif: BETHANIA_AUTH_CODE
  API->>Email: codigo
  B->>U: informe o codigo aqui
  U->>B: repassa codigo
  B->>API: POST /bot/auth/verify-code
  API-->>B: profileId + teamId
  B->>U: menu principal
```

**Quando usar:** usuário descobre a Bethânia pelo WhatsApp; abre o app só para ler o código na barra de notificações.

**Copy de saudação:**

> Olá! Eu sou a **Bethânia**, assistente do Corretor Studio. Antes de continuarmos, preciso confirmar sua identidade. Qual é o e-mail que você usa para acessar a plataforma?

#### Caminho B — OTP web

```mermaid
sequenceDiagram
  participant Web as App_logado
  participant API as API_CS
  participant B as Bethania_N8N

  Web->>API: POST /bot/link/initiate
  API->>Web: exibe OTP na tela
  Web->>B: VINCULAR 123456
  B->>API: POST /bot/auth/verify-code
  API-->>B: phone vinculado
  B->>Web: confirmacao no chat
```

**Passos:**

1. Usuário logado em **Minha conta → Conexões** (`/{supabaseId}/account`, tab `connections`).
2. Card **Vincular Bethânia** (padrão visual Google Calendar em `account/page.tsx`).
3. `POST /api/v1/bot/link/initiate` — headers `x-supabase-user-id` + `x-team-id`; `profileId` da sessão; código 6 dígitos TTL 10 min; `source: web_otp`.
4. UI exibe: *Envie `VINCULAR 123456` para a Bethânia* + deep link WhatsApp.
5. Usuário envia `VINCULAR 123456` ou `123456` no chat.
6. `verify-code` associa phone ao profile.

**Copy orientação (chat):**

> Para vincular seu número, acesse **Minha conta → Conexões → Vincular Bethânia** e envie: `VINCULAR` + código de 6 dígitos.

#### Regras compartilhadas

1. Phone sem vínculo → N8N chama `GET /api/v1/bot/auth/status`.
2. Mensagem com `VINCULAR {code}` ou 6 dígitos → tentar verify (caminho B).
3. Caso contrário → caminho A (saudação + e-mail).
4. Sessão N8N: `profileId`, `teamId`, `flowStack`, `currentLeadId` (TTL 30 min).
5. Vínculo revogado → reautenticação por qualquer caminho.
6. Máx. 5 tentativas de verify por challenge; máx. 3 gerações de código por profile/hora.

### Data Model

Isolamento backoffice conforme `agents.md` — tabelas prefixadas `Backoffice*`.

```mermaid
erDiagram
    Profile ||--o{ BackofficeBotUserLink : has
    Profile ||--o{ BackofficeBotAuthChallenge : requests
    BackofficeBotUserLink ||--o{ BackofficeBotSession : has
    BackofficeBotUserLink ||--o{ BackofficeBotMessage : exchanges
    BackofficeBotAuthChallenge ||--o| BackofficeBotUserLink : verifies
    BackofficeBotChannel ||--o{ BackofficeBotMessage : routes
```

#### `BackofficeBotChannel`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `displayName` | Text | Nome exibido no WhatsApp (default `Bethânia`) |
| `avatarUrl` | Text? | URL pública da foto de perfil (storage) |
| `avatarStoragePath` | Text? | Path no bucket para upload/replace |
| `aboutText` | Text? | Status/about WhatsApp (máx. 139 caracteres) |
| `phoneNumber` | Text? | E.164 — read-only no backoffice após connect |
| `lastProfileSyncAt` | Timestamptz? | Última sync de perfil com Evolution / Cloud API |
| `channelType` | enum | `whatsapp` (v1) |
| `status` | enum | `pending`, `connected`, `disconnected`, `error` |
| `providerConfig` | Json | Credenciais Evolution / Cloud API |
| `webhookSecret` | Text | HMAC inbound |
| `n8nInboundUrl` | Text? | URL workflow N8N |
| `n8nOutboundSecret` | Text | HMAC outbound |
| `isActive` | Boolean | |
| `createdAt` / `updatedAt` | Timestamptz | |

**Gestão de identidade (backoffice):** `PATCH` salva no DB e dispara sync para o provedor (Evolution `updateProfile` ou equivalente Cloud API). Falha de sync → toast + badge "Perfil pendente sync" na UI.

#### `BackofficeBotAuthChallenge`

Auditoria unificada de verificação.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `source` | enum | `channel_email`, `web_otp` |
| `normalizedPhone` | Text? | E.164; preenchido no verify (B) ou no request (A) |
| `emailRequested` | Text? | Caminho A |
| `profileId` | UUID? | Pré-preenchido em `web_otp`; resolvido por e-mail em `channel_email` |
| `codeHash` | Text | bcrypt/argon2 — nunca plain-text |
| `status` | enum | `pending`, `verified`, `expired`, `failed` |
| `attemptCount` | Int | Default 0 |
| `expiresAt` | Timestamptz | TTL 10 min |
| `verifiedAt` | Timestamptz? | |
| `ipMetadata` | Json? | Auditoria opcional |
| `createdAt` / `updatedAt` | Timestamptz | |

Índices: `(normalizedPhone, status)`, `(profileId, createdAt DESC)`.

#### `BackofficeBotUserLink`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `profileId` | UUID | FK → Profile |
| `normalizedPhone` | Text | E.164, unique ativo |
| `linkedAt` | Timestamptz | |
| `linkedBy` | enum | `channel_email`, `web_otp` |
| `authChallengeId` | UUID | FK → challenge |
| `isActive` | Boolean | |
| `lastInteractionAt` | Timestamptz? | |
| `revokedAt` | Timestamptz? | |

Unique: `@@unique([normalizedPhone])` onde `isActive = true` (partial index).

#### `BackofficeBotSession`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `userLinkId` | UUID | FK |
| `teamId` | UUID | Time ativo na sessão |
| `currentLeadId` | UUID? | Contexto pegajoso |
| `flowId` | Text? | Ex.: `lead-context`, `meeting-reschedule` |
| `flowStep` | Text? | |
| `flowStack` | Json | Pilha de menus |
| `expiresAt` | Timestamptz | TTL 30 min |

#### `BackofficeBotMessage`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `userLinkId` | UUID? | Null durante auth |
| `direction` | enum | `inbound`, `outbound` |
| `channelMessageId` | Text? | Idempotency |
| `flowId` | Text? | |
| `errorCode` | Text? | |
| `payload` | Json | Conteúdo normalizado (ver schema abaixo) |
| `createdAt` | Timestamptz | |

**Schema `payload` normalizado** (obrigatório no webhook inbound para reuso de bolhas WhatsApp):

```typescript
{
  messageType: "text" | "image" | "document" | "audio" | "video" | "sticker" | "location";
  contentText?: string | null;
  mediaUrl?: string | null;
  caption?: string | null;
  mediaFileName?: string | null;
  linkPreview?: { title?: string; description?: string; imageUrl?: string; url?: string } | null;
  pushName?: string | null; // nome WhatsApp do remetente inbound
}
```

Mapeamento para renderização no backoffice (adaptador `mapBotMessageToBubble`):

| Campo payload | Campo bolha (`MessagingMessage`) |
|---------------|----------------------------------|
| `messageType` | `messageType` |
| `contentText` | `contentText` |
| `mediaUrl` / `caption` | idem |
| `direction` outbound | `senderDisplayName` = `BackofficeBotChannel.displayName` |
| `direction` inbound | `senderDisplayName` = `Profile.fullName` ou `pushName` |

#### `BackofficeBotNotificationPreference`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `profileId` | UUID | FK |
| `type` | Text | Ex.: `meeting_reminder_30m` |
| `enabled` | Boolean | |
| `quietHours` | Json? | v1.1 |

Unique: `@@unique([profileId, type])`.

#### `BackofficeBotEventOutbox`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `eventType` | Text | Ex.: `meeting.reminder_30m` |
| `profileId` | UUID | Destinatário |
| `payload` | Json | `leadCode`, `deepLink`, `actionButtons` |
| `status` | enum | `pending`, `sent`, `failed` |
| `idempotencyKey` | Text | Unique |
| `createdAt` / `sentAt` | Timestamptz | |

#### Alterações em modelos existentes

**`NotificationType`** — adicionar:

```prisma
BETHANIA_AUTH_CODE
```

Copy na notificação (código só no corpo renderizado, não em `metadata`):

- **Canal:** "Seu código de verificação da Bethânia: **{code}**. Válido por 10 minutos. Informe na conversa com a Bethânia."
- **Web:** "Seu código: **{code}**. Envie `VINCULAR {code}` para a Bethânia no WhatsApp."

`metadata: { challengeId, source, expiresAt }`.

**`ActivityType`** — adicionar `studio_bot` (migration futura) ou usar `note` com `payload.source = "bethania"` até migration.

**`LeadActivity.payload` (ações via bot):**

```typescript
{
  source: "bethania";
  botName: "Bethânia";
  action: string;
  flowId: string;
  messageId?: string;
}
```

#### Migration strategy

1. `bun run db:migrate:new studio-bot-foundation` — tabelas `BackofficeBot*` (SQL idempotente).
2. `bun run db:migrate:new studio-bot-notification-type` — enum `BETHANIA_AUTH_CODE`.
3. `bun run db:migrate:new seed-studio-bot-feature` — feature slug `studio-bot` em `backoffice_features` + seed `prisma/seed-backoffice-products.ts`.
4. `bun run db:migrate:new studio-bot-activity-type` — `ActivityType.studio_bot` (quando implementar fase 3).
5. `bun run db:migrate:new studio-bot-channel-profile` — campos `avatarUrl`, `avatarStoragePath`, `aboutText`, `phoneNumber`, `lastProfileSyncAt` em `BackofficeBotChannel`.

### API

#### Webhooks (N8N → CS)

| Método | Path | Auth | Propósito |
|--------|------|------|-----------|
| POST | `/api/webhooks/backoffice/studio-bot/inbound` | HMAC `x-studio-bot-signature` | Mensagem recebida |
| POST | `/api/webhooks/backoffice/studio-bot/action` | HMAC | Executar ação resolvida pelo N8N |

Header idempotency: `x-idempotency-key`.

#### Autenticação híbrida

| Método | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/v1/bot/auth/request-code` | N8N HMAC | `{ email, normalizedPhone }` | `{ challengeId, expiresAt }` |
| POST | `/api/v1/bot/link/initiate` | Supabase session | — | `{ challengeId, code, expiresAt }` |
| POST | `/api/v1/bot/auth/verify-code` | N8N HMAC | `{ normalizedPhone, code }` | `{ profileId, teamId, userLinkId }` |
| GET | `/api/v1/bot/auth/status` | N8N HMAC | `?phone=` | `{ linked, profileId?, pendingChallenge? }` |
| GET | `/api/v1/bot/link/status` | Supabase session | — | `{ linked, normalizedPhone?, linkedAt? }` |
| DELETE | `/api/v1/bot/link` | Supabase session | — | revoga vínculo |

**Anti-enumeration (caminho A):** resposta genérica se e-mail não existir; não criar Notification.

#### Sessão e ações (phone link ativo)

| Método | Path | Propósito |
|--------|------|-----------|
| GET | `/api/v1/bot/context` | Menu filtrado por papel + sessão |
| POST | `/api/v1/bot/actions/{action}` | Facade: `list_leads`, `lead_detail`, `add_note`, etc. |
| GET/PUT | `/api/v1/bot/notification-preferences` | Preferências push Bethânia |

`POST /api/v1/bot/actions/{action}` delega para APIs existentes:

| action | API existente |
|--------|---------------|
| `list_leads` | `GET /api/v1/leads` |
| `lead_detail` | `GET /api/v1/leads/{id}/details` |
| `agenda_today` | `GET /api/v1/dashboard/schedules` |
| `list_tasks` | `GET /api/v1/tasks` |
| `add_note` | `POST /api/v1/leads/{id}/activities` (`type: note`) |
| `upload_attachment` | `POST /api/v1/leads/{id}/attachments` |
| `schedule_meeting` | `POST/PUT /api/v1/leads/{id}/schedule` |
| `cancel_meeting` | `POST /api/v1/leads/{id}/schedule/cancel` |
| `create_task` | `POST /api/v1/leads/{id}/activities` (`type: task`) |

Headers internos (service-to-service): `x-bot-user-link-id`, `x-supabase-user-id`, `x-team-id`.

#### Backoffice

| Método | Path | Propósito |
|--------|------|-----------|
| GET/POST/PATCH | `/api/v1/backoffice/bot/channel` | Config canal Bethânia |
| PATCH | `/api/v1/backoffice/bot/channel/profile` | `displayName`, `aboutText` |
| POST | `/api/v1/backoffice/bot/channel/avatar` | Multipart upload → storage → `avatarUrl` + sync provider |
| POST | `/api/v1/backoffice/bot/channel/reconnect` | QR / reconnect (padrão backoffice WhatsApp) |
| POST | `/api/v1/backoffice/bot/channel/sync-profile` | Reenviar perfil ao provedor |
| GET | `/api/v1/backoffice/bot/conversations` | Threads agregadas por `userLinkId` + resumo `Profile` |
| GET | `/api/v1/backoffice/bot/conversations/{userLinkId}/messages` | Mensagens paginadas (`?before=`, cursor) |
| GET | `/api/v1/backoffice/bot/user-links` | Vinculações |
| GET | `/api/v1/backoffice/bot/auth-challenges` | Auditoria auth |
| GET | `/api/v1/backoffice/bot/messages` | Log mensagens (flat, auditoria) |
| POST | `/api/v1/backoffice/bot/test-ping` | Health check N8N |
| DELETE | `/api/v1/backoffice/bot/user-links/{id}` | Revogar vínculo |

Query params em `conversations`: `search` (nome/e-mail/phone), `dateFrom`, `dateTo`, `page`, `pageSize`.

Resposta de mensagens inclui `flowId` e `errorCode` em metadados para auditoria (badge opcional na bolha).

Auth: `getBackofficeAccess()`.

#### Eventos outbound (CS → N8N)

| eventType | Audiência | Ações sugeridas |
|-----------|-----------|-----------------|
| `meeting.reminder_30m` | assignedTo + closerId | Ver lead, Confirmar, Remarcar |
| `meeting.reminder_5m` | assignedTo + closerId | Abrir link, Confirmar |
| `task.due_today` | assignee | Ver tarefa, Concluir, Adiar |
| `task.overdue` | assignee + manager | Ver tarefa |
| `lead.assigned` | new assignee | Ver lead, Menu |
| `lead.status_changed` | assignedTo | Ver lead (batch 15 min) |
| `daily.digest` | MANAGER+ opt-in | Itens numerados |

Payload padrão:

```typescript
{
  eventType: string;
  profileId: string;
  normalizedPhone: string;
  leadId?: string;
  leadCode?: string;
  leadName?: string;
  message: string;
  actionButtons: Array<{ id: string; label: string; payload: object }>;
  deepLink: string;
}
```

**Env vars (app):**

| Variável | Uso |
|----------|-----|
| `BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET` | HMAC webhooks N8N ↔ CS |
| `BACKOFFICE_N8N_OUTBOUND_URL` | CS → N8N (eventos outbound) |
| `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER` | Número canal Bethânia |
| `N8N_BASE_URL` | App → N8N (dev: `http://127.0.0.1:5678`) |
| `N8N_WEBHOOK_BASE_URL` | Containers → N8N (dev: `http://host.docker.internal:5678`) |
| `N8N_BETHANIA_INBOUND_PATH` | Path workflow inbound (default `/webhook/bethania-inbound`) |
| `EVO_BETHANIA_INSTANCE` | Instância Evolution dedicada (default `bethania`) |

Ver seção [Desenvolvimento local — N8N (Docker)](#desenvolvimento-local--n8n-docker) e `.env.n8n.example` (Fase 1).

### UI/UX

#### Paradigma conversacional

- **State-machine menu-driven** — sem LLM.
- Comandos globais: `MENU`, `AJUDA`, `CANCELAR`, `VOLTAR`, `TIME`, `RESUMO`, `SILENCIAR`.
- Input: botões WhatsApp (máx. 3), listas (máx. 10), resposta numérica, texto estruturado, upload mídia.
- Sessão TTL 30 min; contexto pegajoso de `leadId` após push.
- Máx. 4 toques até confirmação em fluxos de escrita.

#### Menu principal (usuário verificado)

```
Olá, {firstName}! Time: {teamName}
O que deseja fazer?

1 — Meus leads
2 — Agenda de hoje
3 — Minhas tarefas
4 — Buscar lead (MANAGER+)
5 — Resumo do time (MANAGER+)
```

#### Contexto de lead

```
Lead {leadCode} — {leadName}
Status: {statusLabel}
Próxima reunião: {meetingOrDash}

1 — Ver detalhes
2 — Adicionar nota
3 — Reunião
4 — Nova tarefa
5 — Enviar documento
6 — Voltar
```

#### Jornadas principais

| ID | Jornada | Ator |
|----|---------|------|
| J1-A | Canal → e-mail → código → validação | Qualquer |
| J1-B | Conexões → OTP → VINCULAR → validação | Logado |
| J2 | Push acionável → subfluxo sem redigitar lead | OPERATOR+ |
| J3 | Consultar lead (lista / busca / código) | Escopo por papel |
| J4 | Upload documento ao lead | hasLeadActivityAccess |
| J5 | Agendar / remarcar / cancelar reunião | Escopo schedule |
| J6 | Criar tarefa com confirmação | Escopo lead |
| J7 | Digest matinal `RESUMO` | MANAGER+ |

#### Matriz de permissões

Espelha `teamAccess.ts`. Bot pré-filtra menus; backend **sempre** revalida.

| Ação | MASTER | MANAGER | OPERATOR |
|------|--------|---------|----------|
| `view_lead_list` | Todos da conta | Time; todos se `canViewAllTeams` | Atribuídos ou SDR com `hasLeadAccess` |
| `view_lead_detail` | Idem | Idem | Idem; campos sensíveis redacted v1.1 |
| `add_note` | Sim | Sim | `hasLeadActivityAccess` |
| `upload_attachment` | Sim | Sim | `hasLeadActivityAccess` + lead acessível |
| `schedule_meeting` | Sim | Sim | `assignedTo` ou `closerId` self |
| `cancel_meeting` | Idem schedule | Idem | Idem |
| `create_task` | Qualquer lead; atribuir a qualquer | Leads do escopo; atribuir ao time | Lead acessível; **só a si** em v1 |
| `view_team_digest` | Sim | Sim | Não |
| `transfer_lead` | Sim | `canTransferAccountLeads` | Não — só web |

**Negação padronizada:**

> Você não tem permissão para esta ação no lead {leadCode}.

#### Touchpoints produto

| Superfície | Conteúdo |
|------------|----------|
| **Minha conta → Conexões** | Card `BethaniaConnectionCard.tsx` — status, gerar OTP, deep link, revogar |
| **Barra de notificações** | `BETHANIA_AUTH_CODE` com destaque |
| **LeadActivity** | Badge "via Bethânia" |
| **Deep links** | `/{supabaseId}/crm/leads/{leadId}`, `?tab=tasks` |

#### Touchpoints backoffice

Rota base: `app/backoffice/(app)/studio-bot/` — ver seção [Backoffice — Manutenção da Bethânia](#backoffice--manutenção-da-bethânia).

| Tela | Conteúdo resumido |
|------|-------------------|
| Overview | Status canal, contadores, test ping N8N |
| Conversas | Inbox read-only — mensagens trocadas por vínculo |
| Canal e perfil | Conexão, avatar, nome, about da Bethânia |
| Vinculações | Lista + revogar |
| Verificações | `BackofficeBotAuthChallenge` read-only |

Design: superfície backoffice, Poppins, tokens semânticos, shadcn (`corretor-studio-design`).

#### Notificações push vs pull

| Tipo | Canal | Prioridade |
|------|-------|------------|
| Reunião 30 min | Push | Alta |
| Reunião 5 min | Push | Crítica |
| Tarefa hoje | Push | Média |
| Tarefa atrasada | Push | Alta |
| Lead atribuído | Push | Média |
| Status alterado | Push agrupado 15 min | Baixa |
| Digest diário | Pull opt-in 08:00 | Média |

Rate limit: 12 push/hora/usuário; overflow → digest único.

#### Copy pt-BR

- Frases curtas; uma ideia por mensagem.
- Lead sempre com `#L-0042`.
- Datas: `Ter, 01/07 às 14:30` (fuso do `Profile.timezone`).
- Tom profissional, "você", sem culpar o usuário em erros.
- Emojis funcionais com moderação: ⏰ 📎 ✅ ⚠️ (máx. 1 por mensagem).

#### Recuperação de erros

| Código | Mensagem usuário | Recuperação |
|--------|------------------|-------------|
| `AUTH_NOT_LINKED` | Número não vinculado | Orientar J1-A ou J1-B |
| `AUTH_EXPIRED_OTP` | Código expirado | Gerar novo |
| `LEAD_NOT_FOUND` | Lead não encontrado | Buscar de novo / Menu |
| `PERMISSION_DENIED` | Sem permissão | Voltar |
| `API_TIMEOUT` | Instabilidade momentânea | Tentar novamente / Menu |
| `UPLOAD_TOO_LARGE` | Máx. 16 MB | Reenviar comprimido |
| `INVALID_DATE` | Use DD/MM/AAAA HH:MM | Lista de slots |
| `MEETING_CONFLICT` | Horário indisponível | Slots alternativos |
| `SESSION_EXPIRED` | Sessão expirou | Menu (preserva leadId <2h) |
| `OUTSIDE_WHATSAPP_WINDOW` | Aguarde próxima mensagem | Template HSM |
| `PHONE_ALREADY_LINKED` | Número em outra conta | Revogar em Conexões |

Toda tela de erro inclui `MENU` ou `CANCELAR`. Após 3 falhas `API_TIMEOUT` → link web escape hatch.

## Backoffice — Manutenção da Bethânia

Módulo interno para operação do canal da Bethânia: visualizar conversas e mensagens trocadas, gerenciar identidade do bot (avatar, nome exibido, about) e auditar vinculações — **sem** expor gestão no produto.

### Escopo e princípios

- **Somente backoffice** — autorização via `getBackofficeAccess()`; produto não gerencia o bot.
- **Isolamento de módulo** (`agents.md`): rotas `app/api/v1/backoffice/bot/*`, services `app/api/services/backofficeBot/`, use cases `app/api/useCases/backofficeBot/`.
- **Inbox read-only em v1** — operador visualiza mensagens; envio manual fica fora de escopo (N8N é autor de outbound automatizado).
- **Reuso visual, não acoplamento de domínio** — backoffice **não** importa `WhatsAppInboxContext` nem use cases de leads; usa adaptadores DTO → tipos de bolha.

### Arquitetura de UI

```text
app/backoffice/(app)/studio-bot/
  page.tsx                    # Overview: status canal + atalhos
  conversas/
    page.tsx                  # Inbox read-only
    loading.tsx
  canal/
    page.tsx                  # Perfil + conexão + N8N health
    loading.tsx
  vinculacoes/page.tsx
  verificacoes/page.tsx
  features/
    context/                  # BackofficeStudioBot*Types, Hook, Context
    services/                 # IBackofficeStudioBotService + impl
    container/                # Containers por tela
    components/               # Wrappers backoffice-only
    utils/
      mapBotMessageToBubble.ts
      mapUserLinkToConversation.ts
```

Nav: item **Bethânia** em `app/backoffice/components/BackofficeSidebar.tsx` → `/backoffice/studio-bot`.

Padrão operacional de referência: `app/backoffice/(app)/whatsapp/` (tabela + sheet + badges).

### Telas e comportamento

```mermaid
flowchart LR
  subgraph studioBot [studio-bot backoffice]
    Overview[Overview]
    Conversas[Conversas read-only]
    Canal[Canal e perfil]
    Vinculacoes[Vinculacoes]
    Verificacoes[Verificacoes auth]
  end
  Overview --> Conversas
  Overview --> Canal
  Overview --> Vinculacoes
  Overview --> Verificacoes
  Conversas --> MessagePanel[MessagePanel sem composer]
  Canal --> ProfileForm[Avatar nome about]
```

| Tela | Conteúdo | Padrão visual |
|------|----------|---------------|
| **Overview** | Card status canal (espelhar `ConnectionCard` simplificado em `app/[supabaseId]/whatsapp/configuracoes/`), contadores (vínculos ativos, msgs 24h), botão test ping N8N | Cards + badges backoffice |
| **Conversas** | Inbox master-detail: thread = `BackofficeBotUserLink` + `Profile` (nome, avatar do corretor) | Layout `WhatsAppInboxContainer` |
| **Canal e perfil** | Status Evolution, reconnect, identidade Bethânia (upload avatar, `displayName`, `aboutText`), URLs N8N | Form/sheet estilo `BackofficeWhatsAppInstanceSheet` |
| **Vinculações** | Tabela paginada + revogar | Padrão `BackofficeWhatsAppInstancesTable` |
| **Verificações** | Tabela read-only `BackofficeBotAuthChallenge` com filtro por `source` | Tabela backoffice padrão |

**Thread de conversa:** agregar `BackofficeBotMessage` por `userLinkId`; preview = última mensagem; avatar/nome do **usuário vinculado** vêm de `Profile` (`profileIconUrl`, `fullName`); bolhas outbound da Bethânia usam avatar/nome do **canal** (`BackofficeBotChannel`).

**Perfil do corretor:** exibido somente leitura na thread — edição permanece em Minha conta do produto.

### Reuso de componentes WhatsApp do produto

| Componente produto | Uso na Bethânia (backoffice) |
|--------------------|------------------------------|
| `WhatsAppInboxContainer` | Layout master-detail (lista + painel) |
| `ConversationList` | Lista de threads |
| `ConversationItem` | Item com avatar, preview, horário |
| `MessagePanel` | Cabeçalho + scroll (**sem** `MessageComposer` em v1) |
| `MessageBubble` | Bolhas inbound/outbound |
| `MessageBubbleSkeleton` / `InboxSkeleton` | Estados de loading |
| `formatWhatsAppMessageText` | Formatação de texto |

| Componente backoffice WhatsApp | Uso na Bethânia |
|-------------------------------|-----------------|
| `BackofficeWhatsAppInstanceStatusBadge` | Modelo para `BackofficeBotChannelStatusBadge` |
| `BackofficeWhatsAppInstanceSheet` | Modelo para sheet de canal/perfil |
| `BackofficeWhatsAppInstancesTable` | Modelo para tabela de vinculações |

#### Estratégia de implementação

**A. Extração recomendada** — mover componentes presentacionais sem `useWhatsAppInboxContext` para `components/messaging/`:

- `MessagingConversationList`, `MessagingConversationItem`, `MessagingMessageBubble`, skeletons
- Props tipadas (`MessagingConversation`, `MessagingMessage`) — superset mínimo de `WhatsAppInboxTypes.ts`

Produto e backoffice importam da pasta compartilhada; inbox do produto mantém context próprio.

**B. Adaptadores backoffice (obrigatório)** — em `features/utils/`:

```typescript
mapUserLinkToConversation(link, profile, lastMessage) → MessagingConversation
mapBotMessageToBubble(msg: BackofficeBotMessage, channel, profile?) → MessagingMessage
```

**Componentes backoffice-only:**

- `BackofficeBotChannelStatusBadge`
- `BackofficeBotProfileForm` — upload avatar + nome + about
- Containers com `BackofficeStudioBotContext` (sem `TeamContext`)

### Fluxo de dados (inbox)

```mermaid
sequenceDiagram
  participant UI as BackofficeConversasUI
  participant API as backoffice_bot_API
  participant UC as ListBotMessagesUseCase
  participant DB as BackofficeBotMessage

  UI->>API: GET conversations
  API->>UC: getBackofficeAccess
  UC->>DB: aggregate by userLinkId
  DB-->>UI: threads + profile snapshot
  UI->>API: GET messages userLinkId
  API-->>UI: BackofficeBotMessage[]
  UI->>UI: mapBotMessageToBubble
  UI->>UI: MessageBubble render
```

## Edge Cases & Error Handling

- E-mail não cadastrado (A) → resposta genérica; sem Notification.
- OTP web expirado → botão "Gerar novo código" invalida challenge anterior.
- Phone vinculado a outro profile → `PHONE_ALREADY_LINKED`.
- Código incorreto → `attemptCount++`; 5 falhas → `failed`.
- Dois challenges pendentes → invalidar o mais antigo ao gerar novo.
- Usuário em múltiplos times → comando `TIME`.
- Upload fora de tipos permitidos (PDF, JPG, PNG).
- Conta inativa / assinatura expirada → bloquear ações; MASTER vê link billing.
- Retry N8N com mesma `idempotency-key` → resposta cached, sem duplicata.
- Fora janela 24h WhatsApp → template HSM pré-aprovado.

## Security & Privacy

- HMAC-SHA256 em webhooks N8N ↔ CS.
- Código armazenado como hash; plain-text só em Notification + e-mail + tela OTP.
- Rate limits: 3 gerações/hora/profile; 5 verify/challenge; 12 push/hora.
- Anti-enumeration de e-mail no caminho A.
- PII mínima no WhatsApp; detalhes longos via deep link web.
- Log de `PERMISSION_DENIED` para auditoria.
- Tabelas `Backoffice*` sem RLS produto — acesso via `getBackofficeAccess()`.
- Revogação de vínculo exige sessão Supabase do próprio profile.

## Testing Strategy

### Unit

- `BotPolicyService` — matriz MASTER / MANAGER / OPERATOR.
- Normalização phone E.164 e parsing `VINCULAR {code}`.
- Expiração e invalidação de challenges.

### Integration

- Caminho A: `request-code` → Notification + e-mail → `verify-code`.
- Caminho B: `link/initiate` (session) → `verify-code` (N8N).
- HMAC rejeição e idempotency.
- Cada `bot/actions/{action}` → API existente com Output.

### E2E N8N

- `bethania-verification-channel`
- `bethania-verification-web`
- `lead-context`, `meeting-reschedule`, `task-create`
- Push acionável com contexto pegajoso

### Manual

- Matriz de negação por role.
- Revogação e re-vinculação.
- Janela 24h / HSM.

## Success Criteria

- **Caminho A:** código em notificações + e-mail em ≤30s após e-mail válido.
- **Caminho B:** OTP na web em ≤2s; vínculo após `VINCULAR` no chat.
- Verificação completa em ≤5 interações.
- Lead atribuído consultável em ≤3 interações pós-auth.
- Push reunião 30 min com botão "Remarcar" funcional.
- Upload PDF → `LeadAttachment` + activity auditável.
- OPERATOR sem permissão → mensagem padronizada, nunca 500.
- Backoffice: últimas 100 mensagens por thread + status canal visíveis.
- Backoffice: identidade Bethânia editável (avatar, `displayName`, `aboutText`) com sync ao provedor.
- Zero chamadas LLM; 100% fluxos determinísticos N8N.

## Implementation Phases

### Auditoria de implementação — 2026-07-17

Itens confirmados no repositório: fundação `BackofficeBot*`, autenticação híbrida,
webhooks HMAC/idempotentes, `BotPolicyService`, outbox/dispatcher, workflows N8N,
touchpoint de conta e backoffice read-only. O checklist histórico abaixo permanece
como plano de rollout; não deve ser lido como evidência de ausência desses itens.

Gap confirmado para ativação operacional: aprovar os templates HSM no provedor e
configurar os secrets/número dedicados por ambiente. Fora da janela de 24h, o app
agora suprime eventos sem template aprovado antes de entregá-los ao N8N.

### Fase 0 — Fundação documental

- [x] `specs/studio-bot-n8n.md`
- [x] Diagramas mermaid
- [x] Cópia Obsidian em `docs/obsidian/`
- [ ] Feature slug `studio-bot` — migration + seed (fase 1)

### Fase 1 — Infraestrutura e autenticação híbrida (backend)

- [ ] `docker-compose.n8n.yml` + `.env.n8n.example`
- [ ] Scripts `n8n:up`, `n8n:down`, `n8n:reset`, `n8n:logs`
- [ ] Integração `scripts/dev-local.ts` (`--skip-n8n`, bootstrap, overrides)
- [ ] Documentar vars N8N/Bethânia em `.env.example`
- [ ] Migration `BackofficeBot*` + `BackofficeBotAuthChallenge` com `source`
- [ ] Enum `NotificationType.BETHANIA_AUTH_CODE` + template e-mail Resend
- [ ] `POST /api/v1/bot/auth/request-code`
- [ ] `POST /api/v1/bot/link/initiate` + `GET /api/v1/bot/link/status` + `DELETE /api/v1/bot/link`
- [ ] `POST /api/v1/bot/auth/verify-code` + `GET /api/v1/bot/auth/status`
- [ ] Webhook inbound + HMAC + idempotency
- [ ] `BotPolicyService`
- [ ] Postman + `lib/env/validation.ts`

### Fase 2 — N8N core flows (read)

- [ ] Pasta `n8n/workflows/` com exports JSON versionados
- [ ] `n8n/README.md` — import de workflows + URLs de webhook
- [ ] Workflow roteador auth (`VINCULAR` vs primeiro contato)
- [ ] Workflow verificação caminho A
- [ ] Workflow verificação caminho B
- [ ] UI: `BethaniaConnectionCard` em Minha conta → Conexões
- [ ] Workflow menu principal
- [ ] Workflows listar/buscar leads, agenda, tarefas
- [ ] `GET /api/v1/bot/context`

### Fase 3 — N8N mutation flows (write)

- [ ] Nota em lead
- [ ] Upload anexo (mídia → storage → API)
- [ ] Agendar / remarcar / cancelar reunião
- [ ] Criar tarefa com confirmação
- [ ] `ActivityType.studio_bot` + payload Bethânia

### Fase 4 — Notificações outbound

- [ ] `BackofficeBotEventOutbox` + dispatcher
- [ ] Hooks em schedule, task, assignment
- [ ] Workflows N8N push com botões
- [ ] Preferências de notificação (API + UI)

### Fase 5 — Backoffice admin UI

- [ ] Nav item Bethânia em `BackofficeSidebar` + scaffold `app/backoffice/(app)/studio-bot/` (overview, conversas, canal, vinculacoes, verificacoes)
- [ ] Extrair ou referenciar componentes em `components/messaging/` (ConversationList, MessageBubble, skeletons)
- [ ] Inbox read-only com adaptadores `mapBotMessageToBubble` / `mapUserLinkToConversation`
- [ ] Form perfil Bethânia (`BackofficeBotProfileForm`: avatar, `displayName`, `aboutText`) + sync provider
- [ ] APIs `conversations`, `conversations/{userLinkId}/messages`, `channel/profile`, `channel/avatar`, `channel/reconnect`, `channel/sync-profile`
- [ ] Migration campos perfil em `BackofficeBotChannel` (`studio-bot-channel-profile`)
- [ ] Status canal + reconnect + test ping N8N
- [ ] Vinculações + revogar; log verificações auth
- [ ] Postman backoffice bot endpoints

### Fase 6 — Hardening

- [ ] Rate limits + digest overflow
- [ ] Templates HSM (janela 24h)
- [ ] Observabilidade (`flowId`, `step`, `errorCode`)
- [ ] `governance:check` + testes integração

## Open Questions

- [ ] Caminho do vault Obsidian pessoal para sync além de `docs/obsidian/` no repo
- [x] Provedor exato do canal em **produção**: Evolution API em v1 (alinhado ao stack); WhatsApp Cloud API como v1.1
- [x] Hosting N8N em **dev local** — Docker Compose dedicado (`docker-compose.n8n.yml`), scripts `n8n:*`, auto-start em `bun run dev` (resolvido na SPEC)
- [ ] Hosting N8N em **produção**: self-hosted vs cloud e URL base
- [ ] Templates HSM pré-aprovados na v1
- [ ] OPERATOR atribuir tarefa a colega em v1? (recomendação: não — só a si)
- [x] Feature slug `studio-bot`: incluso no plano base; acesso backoffice MASTER-only para gestão do canal
- [ ] Número WhatsApp da Bethânia em produção: dedicado vs infraestrutura Evolution compartilhada (dev local: instância Evolution `bethania` na stack existente)
- [x] Extrair `components/messaging/` na mesma PR da UI backoffice ou PR prévia de refactor? — **PR prévia** (refactor presentacional antes da Fase 5 UI)
- [x] Bucket/storage para avatar da Bethânia: bucket dedicado `backoffice-bot` (isolamento backoffice; env `SUPABASE_BACKOFFICE_BOT_BUCKET`)

## Decisions Log

> **Q:** Qual o nome do bot?
> **A:** **Bethânia** — identidade fixa em copy, backoffice e auditoria.

> **Q:** Como o usuário se autentica?
> **A:** Híbrido v1: (A) canal — e-mail → código em notificações + e-mail → validação no chat; (B) OTP web — Minha conta → Conexões → Vincular Bethânia → `VINCULAR {código}` no chat. Mesma `BackofficeBotAuthChallenge` e mesmo `verify-code`.

> **Q:** Onde fica o OTP web?
> **A:** **Minha conta → Conexões** (`/{supabaseId}/account`, aba `connections`), card ao lado de Google Calendar.

> **Q:** OTP web substitui o fluxo do canal?
> **A:** Não — coexistem. Canal para mobile-first; web OTP para quem já está no app/desktop.

> **Q:** Bethânia usa o WhatsApp de leads do time?
> **A:** Não — canal de plataforma separado, gerido no backoffice. WhatsApp por time permanece para leads.

> **Q:** LLM em v1?
> **A:** Não — apenas automação N8N com menus e comandos fixos.

> **Q:** Como rodar N8N em desenvolvimento local?
> **A:** Docker Compose dedicado (`docker-compose.n8n.yml`), `.env.n8n.example`, scripts `n8n:*`, auto-start em `bun run dev` com `--skip-n8n`, espelhando o padrão Evolution. Topologia: WhatsApp → Evolution → N8N → Lead Flow API.

> **Q:** O backoffice pode enviar mensagens manualmente em v1?
> **A:** Não — inbox backoffice é **read-only**. Reuso visual dos componentes WhatsApp via adaptadores DTO; sem importar `WhatsAppInboxContext` nem use cases de leads.

> **Q:** Quem edita avatar e nome exibidos na conversa?
> **A:** Identidade **editável** é da Bethânia (`BackofficeBotChannel`: avatar, `displayName`, `aboutText`). Perfil do corretor (`Profile`) é **somente leitura** na thread — edição em Minha conta do produto.

---

# Evolução v2 — IA, telemetria e operação assistida

Esta seção substitui o non-goal “LLM / NLU / interpretação de texto livre” somente **após a Fase 0 desta evolução estar concluída**. Os menus, comandos, autenticação, permissões, idempotência e ações determinísticas das fases anteriores continuam obrigatórios e são o fallback permanente.

## Objetivo v2

Permitir que a Bethânia entenda linguagem natural, conduza esclarecimentos curtos e responda de modo fluido, sem conceder autonomia sobre CRM. A IA interpreta e redige; o backend continua sendo a única autoridade para autenticação, acesso a dados e mutações.

Exemplos:

- “Quais reuniões tenho hoje?” → `agenda_today`.
- “Procura a Ana Paula do plano empresarial” → `search_lead`.
- “Crie uma tarefa para ligar para ela amanhã” → proposta de `create_task`, confirmação explícita e execução pelo backend.
- “Como vinculo meu calendário?” → resposta apenas com conteúdo publicado na base de conhecimento.

## Decisões obrigatórias

| Tema | Decisão |
|---|---|
| Provedor inicial | Groq Cloud, API OpenAI-compatible |
| Modelo primário | `openai/gpt-oss-20b` |
| Fallback | `llama-3.1-8b-instant` |
| Local da inferência | Backend Next.js, nunca N8N |
| Saída | JSON Schema estrito no primário; Zod obrigatório em qualquer provider |
| Escritas | proposta persistida + confirmação `CONFIRMAR` + nova validação de política |
| Dados | contexto mínimo; não enviar segredo, token, e-mail, telefone, CNPJ, valores ou histórico integral |
| Privacidade | Zero Data Retention ativado no Groq antes do tráfego real |
| Telemetria | persistida desde a primeira chamada, inclusive erros e fallback |
| Fallback operacional | menu e fluxos v1 continuam quando IA, quota ou provider falharem |

O modelo primário é escolhido porque suporta Structured Outputs estritos. Limites e disponibilidade de modelos são variáveis externas e devem ser revalidados no console da Groq antes de cada promoção de ambiente. Referências: [Groq rate limits](https://console.groq.com/docs/rate-limits), [Structured Outputs](https://console.groq.com/docs/structured-outputs) e [Data Controls](https://console.groq.com/docs/your-data).

**Não usar Gemini API no plano gratuito com mensagens reais de CRM.** Os termos desse plano autorizam uso do conteúdo para melhoria de produtos; portanto, ele não atende ao requisito de minimização de dados desta feature.

## Arquitetura v2

```mermaid
sequenceDiagram
  participant U as Usuário
  participant N as Evolution/N8N
  participant W as Webhook Bethânia
  participant D as Roteador determinístico
  participant A as IA no backend
  participant P as Política/Ações
  participant M as Telemetria IA

  U->>N: mensagem WhatsApp
  N->>W: payload normalizado + idempotency key
  W->>D: autentica, sanitiza e resolve sessão
  D->>D: tenta comandos e fluxo atual
  alt não resolvido e elegível
    D->>A: intenção fechada + contexto mínimo
    A->>M: interaction/attempt/tokens/latência
    A-->>D: JSON validado
  end
  D->>P: valida allowlist, dados e permissões
  P-->>D: resultado estruturado
  D->>N: resposta
  N-->>U: mensagem
```

### Ordem obrigatória de roteamento

1. Validar HMAC, idempotência, telefone e vínculo.
2. Processar autenticação, `VINCULAR`, `MENU`, `AJUDA`, `VOLTAR` e `CANCELAR` sem IA.
3. Processar sessão e subfluxos determinísticos existentes.
4. Se há proposta pendente, aceitar somente `CONFIRMAR` ou `CANCELAR`.
5. Apenas então classificar texto elegível com IA.
6. Validar a saída com Zod, allowlist e entidades reais no backend.
7. Executar leitura ou criar proposta de escrita; nunca escrever diretamente a partir da saída do modelo.
8. Persistir telemetria em `finally`, inclusive timeout, `429`, JSON inválido e circuit breaker.

N8N preserva a normalização e entrega do canal. Ele não recebe chave do provider, não escolhe permissões e não chama ações com base em texto gerado.

## Data model v2

Todas as entidades são isoladas no módulo de backoffice e usam o prefixo `BackofficeBotAi`. A única relação externa permitida é `Profile`; `teamIdSnapshot` é UUID sem FK apenas para análise histórica.

### Enums Prisma

```prisma
enum BackofficeBotAiProvider { groq ollama @@map("backoffice_bot_ai_provider") }

enum BackofficeBotAiCapability {
  intent_classification response_composition clarification knowledge_answer
  transcription summarization evaluation embedding
  @@map("backoffice_bot_ai_capability")
}

enum BackofficeBotAiInteractionStatus {
  shadowed resolved clarification_needed proposal_created confirmed executed
  cancelled rejected fallback failed
  @@map("backoffice_bot_ai_interaction_status")
}

enum BackofficeBotAiAttemptStatus {
  success validation_error rate_limited timeout provider_error circuit_open skipped
  @@map("backoffice_bot_ai_attempt_status")
}

enum BackofficeBotAiActionProposalStatus {
  pending confirmed executed cancelled expired rejected failed
  @@map("backoffice_bot_ai_action_proposal_status")
}

enum BackofficeBotAiFeedbackType {
  helpful unhelpful corrected confirmed cancelled
  @@map("backoffice_bot_ai_feedback_type")
}
```

### Tabelas

| Entidade | Campos obrigatórios | Finalidade |
|---|---|---|
| `BackofficeBotAiConfiguration` | `isEnabled`, `shadowMode`, `rolloutPercentage`, provider/model primário e fallback, thresholds, limites, timeout, retenção, `updatedByProfileId` | singleton, kill switch e operação |
| `BackofficeBotAiInteraction` | `inboundMessageId` unique, `userLinkId`, `profileId`, `sessionId`, `teamIdSnapshot`, capacidade, status, intenção, confiança, versão de prompt, flags de shadow/fallback, hashes, códigos | uma decisão lógica por mensagem elegível |
| `BackofficeBotAiInferenceAttempt` | interaction, sequence, provider, model, capability, status, tokens, custo, latência, HTTP status, erro seguro, versão de schema | uma chamada externa, retry ou fallback |
| `BackofficeBotAiActionProposal` | interaction, usuário, ação, resumo, parâmetros cifrados, expiração, mensagem de confirmação unique, idempotency key unique, resultado | escrita assistida, auditável e idempotente |
| `BackofficeBotAiFeedback` | interaction, tipo, intenção/entidades corrigidas, origem, autor | sinais para qualidade e avaliações |
| `BackofficeBotAiDailyUsage` | dia UTC, provider, modelo, capability, contadores, tokens, custo, P50/P95, usuários únicos, erros e fallback | dashboard eficiente e retenção longa |

`BackofficeBotAiInferenceAttempt` deve registrar `inputTokens`, `outputTokens`, `totalTokens`, `cachedInputTokens`, `reasoningTokens`, `audioInputSeconds`, `estimatedCostUsd`, `providerReportedCostUsd`, `billingMode`, `latencyMs`, `timeToFirstTokenMs`, `providerRequestId`, `finishReason`, `requestSchemaVersion` e `responseSchemaVersion` quando disponíveis.

Índices mínimos: `createdAt DESC`, `(provider, model, createdAt DESC)`, `(status, createdAt DESC)`, `(interactionId, sequence)`, `(profileId, createdAt DESC)` e `(userLinkId, createdAt DESC)`.

`BackofficeBotMessage` recebe a relação inversa de interactions. `BackofficeBotUserLink` e `Profile` recebem somente as relações de IA necessárias para auditoria. Não criar FK para `Lead`, `Team`, `Task`, `LeadsSchedule` ou `LeadActivity`.

### Segurança de dados

- Não armazenar prompt, resposta crua, telefone, e-mail, código OTP, base64 ou segredo nas tabelas de IA.
- Usar `inputHash` e `outputHash` para auditoria. A conversa existente continua sendo a fonte do texto, sujeita à sua política atual.
- `paramsCiphertext` da proposal usa a chave de integração existente e um `encryptionKeyVersion`; `paramsSummary` contém somente informação redigida para a UI.
- Apagar parâmetros cifrados 30 dias após a proposal ser fechada; interactions e attempts ficam 365 dias; rollups agregados ficam indefinidamente.
- Aplicar scrub antes de `console.error`/Sentry: `phone`, `email`, `code`, `authorization`, `apiKey`, `fileBase64`, `prompt` e `response`.

### Migration e RLS

1. Atualizar `prisma/schema.prisma` e gerar `bun run db:migrate:from-prisma -- studio-bot-ai-telemetry`.
2. Gerar `bun run db:migrate:new studio-bot-ai-rls-rollup` para RLS, grants, função/índices manuais e retenção.
3. Habilitar RLS em todas as tabelas `backoffice_bot_ai_*`, revogar acesso de `anon` e `authenticated` e não criar policy pública.
4. Declarar grants explicitamente: projetos Supabase atuais podem não expor tabelas novas ao Data API automaticamente.
5. Validar localmente com `bun run db:migrate:reset:local`; não aplicar ao remoto sem autorização explícita.

## Contrato de intenção

Na primeira ativação, somente as intenções de leitura abaixo são permitidas:

```text
show_menu | list_leads | agenda_today | list_tasks | search_lead | team_digest | open_lead | unknown
```

Fase de escrita: `add_note`, `create_task`, `schedule_meeting`, `cancel_meeting` e `upload_attachment`.

```ts
const BethaniaIntentSchema = z.object({
  intent: z.enum([
    "show_menu", "list_leads", "agenda_today", "list_tasks", "search_lead",
    "team_digest", "open_lead", "add_note", "create_task", "schedule_meeting",
    "cancel_meeting", "upload_attachment", "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  entities: z.object({
    searchQuery: z.string().max(160).optional(),
    leadReference: z.string().max(80).optional(),
    noteBody: z.string().max(2000).optional(),
    taskTitle: z.string().max(180).optional(),
    dateExpression: z.string().max(80).optional(),
    isoDate: z.string().date().optional(),
    time: z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/).optional(),
  }).strict(),
  needsClarification: z.boolean(),
  clarificationField: z.enum(["lead", "date", "time", "task_title", "note", "none"]),
}).strict()
```

O modelo não recebe ferramentas nem executa funções. O backend recebe JSON, valida o schema, valida a entidade no banco, revalida `BotPolicyService` e só então chama os use cases atuais. `isoDate` e horário sempre passam pelo parser e timezone da plataforma; não são confiados por terem vindo da IA.

Prompts ficam versionados em `lib/studio-bot/ai/prompts/`; cada interaction salva `promptKey` e `promptVersion`, mas não o prompt completo. O contexto permitido é mensagem sanitizada, passo de sessão, data/hora local e lista fechada de capacidades. Histórico máximo: três interações redigidas na Fase 2.

## Serviços, UseCases, rotas e UI

```text
app/api/services/backofficeBot/ai/
  IBethaniaAiProvider.ts
  GroqBethaniaAiProvider.ts
  BethaniaAiGatewayService.ts
  BethaniaAiTelemetryService.ts
  BethaniaAiIntentService.ts
  BethaniaAiResponseService.ts                 # fase 2
  BethaniaAiProposalService.ts                 # fase 3
  BethaniaAiKnowledgeService.ts                # fase 4
  OllamaBethaniaEmbeddingProvider.ts           # fase 5
  BethaniaAiEvaluationService.ts               # fase 6

app/api/useCases/backofficeBotAi/
  IBackofficeBotAiMetricsUseCase.ts
  BackofficeBotAiMetricsUseCase.ts
  IBackofficeBotAiConfigurationUseCase.ts
  BackofficeBotAiConfigurationUseCase.ts
  IBackofficeBotAiRollupUseCase.ts
  BackofficeBotAiRollupUseCase.ts

app/api/infra/data/repositories/backofficeBotAi/
  IBackofficeBotAiRepository.ts
  BackofficeBotAiRepository.ts

app/api/v1/backoffice/bot/ai/
  metrics/route.ts
  metrics/timeseries/route.ts
  usage/route.ts
  users/route.ts
  interactions/[id]/route.ts
  configuration/route.ts
  provider/test/route.ts
  export/route.ts
```

`BackofficeBotInboundWebhookUseCase` chama o roteador de IA somente depois da máquina de estados atual. O roteador não importa Prisma, route ou N8N. A persistência fica no repository dedicado.

Endpoints obrigatórios:

| Endpoint | Acesso | Resultado |
|---|---|---|
| `GET /api/v1/backoffice/bot/ai/metrics` | backoffice | cards, funil e métricas do período |
| `GET /api/v1/backoffice/bot/ai/metrics/timeseries` | backoffice | série diária por dimensão |
| `GET /api/v1/backoffice/bot/ai/usage` | backoffice | attempts paginados e filtráveis |
| `GET /api/v1/backoffice/bot/ai/users` | backoffice | usuários agregados por uso/tokens |
| `GET /api/v1/backoffice/bot/ai/interactions/:id` | backoffice | decisão, attempts, proposal e feedback, sem conteúdo cru |
| `GET/PATCH /api/v1/backoffice/bot/ai/configuration` | leitura/full access | rollout, limites e modelos |
| `POST /api/v1/backoffice/bot/ai/provider/test` | full access | teste sintético sem PII |
| `GET /api/v1/backoffice/bot/ai/export` | full access | CSV auditável, máximo 31 dias |
| `GET /api/v1/notifications/cron/studio-bot-ai-rollup` | cron secret | rollup, retenção e alertas |

As rotas usam `getBackofficeAccess()` e `Output`. Operadores podem consultar métricas e auditoria; configuração, exportação e teste requerem `fullAccess`. Validar filtros com Zod: `from`, `to`, `timezone`, `provider`, `model`, `capability`, `status`, `intent`, `profileId`, `userLinkId`, `page` e `pageSize`; limitar detalhe a 365 dias e página a 100.

Nova tela: `app/backoffice/(app)/studio-bot/ia/`, com `features/context`, `features/services`, `features/container` e componentes locais. Abas: **Visão geral**, **Uso**, **Usuários**, **Qualidade**, **Auditoria** e **Configuração**. A visão geral mostra mensagens elegíveis, calls, resoluções, fallback, erro, P50/P95, tokens e custo. Usuários mostra nome, e-mail, vínculo, chamadas, tokens, custo, sucesso e último uso. A auditoria oferece detalhe em Sheet redigido. Configuração mostra kill switch, shadow mode, rollout, modelos, limites e teste do provider.

Antes de construir UI, seguir `corretor-studio-design`, shadcn e `design-system-guard`; usar Cards, Tabs, Table, Select, DatePicker, Sheet, Badge, Skeleton e Recharts com tokens do design system.

## Configuração externa

### Groq

1. Criar organização/projeto separados para dev, preview e produção.
2. Ativar **Zero Data Retention** em Data Controls antes de criar a chave de produção.
3. Criar uma chave por ambiente; nunca reutilizar chave pessoal.
4. Guardar chave apenas em Vercel Environment Variables e `.env.local`; N8N não recebe chave.
5. Registrar owner, ambiente e data de rotação no inventário de segredos.
6. Validar com `POST /api/v1/backoffice/bot/ai/provider/test` usando payload sintético antes de habilitar rollout.

### Ambiente

```dotenv
# Servidor; nunca NEXT_PUBLIC_
BACKOFFICE_BETHANIA_AI_ENABLED=false
BACKOFFICE_BETHANIA_AI_PROVIDER=groq
BACKOFFICE_BETHANIA_AI_MODEL=openai/gpt-oss-20b
BACKOFFICE_BETHANIA_AI_FALLBACK_MODEL=llama-3.1-8b-instant
BACKOFFICE_GROQ_API_KEY=
BACKOFFICE_BETHANIA_AI_BASE_URL=https://api.groq.com/openai/v1
BACKOFFICE_BETHANIA_AI_TIMEOUT_MS=8000
BACKOFFICE_BETHANIA_AI_MAX_OUTPUT_TOKENS=350
BACKOFFICE_BETHANIA_AI_MAX_INPUT_CHARACTERS=2400
BACKOFFICE_BETHANIA_AI_CONFIDENCE_THRESHOLD=0.78
BACKOFFICE_BETHANIA_AI_DAILY_REQUEST_LIMIT=900
BACKOFFICE_BETHANIA_AI_PER_USER_DAILY_REQUEST_LIMIT=60
BACKOFFICE_BETHANIA_AI_RETENTION_DAYS=365
BACKOFFICE_BETHANIA_AI_ROLLUP_CRON_SECRET=

# Fase 5: apenas rede privada/VPS
BACKOFFICE_BETHANIA_OLLAMA_BASE_URL=http://ollama:11434
BACKOFFICE_BETHANIA_EMBEDDING_MODEL=qwen3-embedding:0.6b
```

Adicionar em `.env.example` e `lib/env/validation.ts`. A chave Groq é obrigatória somente se a IA estiver habilitada e o provider selecionado for Groq. Alertar no Sentry para erro recorrente, P95 acima de 8 s, circuit breaker aberto e 80%/95% de quota diária.

## Fases de implementação v2

### Fase 0 — Fundação, telemetria e controle operacional

**Obrigatória antes de qualquer tráfego de usuário.**

- Criar enums/modelos, migrations, RLS, grants explícitos, repository e cron de rollup/retenção.
- Implementar configuração singleton, kill switch, shadow mode, rollout hash estável, rate limit e circuit breaker.
- Implementar gateway Groq, mas permitir somente teste sintético; nenhuma mensagem real é encaminhada.
- Implementar `BethaniaAiTelemetryService`, endpoints, Postman e tela de métricas com estado “IA não ativada”.
- Cada teste persiste interaction e attempt com usuário nulo de sistema, provider, modelo, status, tokens, custo e latência.

Aceite: `isEnabled=false` impede rede externa; configuração/exportação por operator retornam 403; dashboard filtra e detalha sem conteúdo cru; quota/chave inválida não causam 500.

### Fase 1 — NLU em sombra e leituras naturais

- Implementar schema, prompt versionado, `BethaniaAiIntentService` e fallback.
- Rodar em shadow mode: classifica e mede, mas não altera resposta.
- Montar conjunto de 200 frases anonimizadas e comparar intenção esperada.
- Promover 0% → 5% → 25% → 50% → 100%, usando hash de `userLinkId`.
- Habilitar somente `show_menu`, leads, agenda, tarefas, busca, digest, abrir lead e `unknown`.

Promoção: ≥92% de intenção correta, ≥99% JSON válido, fallback <5% por sete dias, zero ação fora da allowlist e nenhum PII em log de erro.

### Fase 2 — Conversa e esclarecimento

- `BethaniaAiResponseService` redige somente a partir de resultados já retornados pelo backend.
- Uma pergunta de esclarecimento por vez: lead, data, horário, título ou nota.
- Histórico máximo de três interações redigidas; globais sempre vencem IA.
- Adicionar feedback WhatsApp `ÚTIL`/`NÃO ÚTIL` em `BackofficeBotAiFeedback`.

Aceite: `MENU`, `CANCELAR` e feedback negativo encerram o subfluxo; nenhuma resposta contém dado que o backend não retornou.

### Fase 3 — Escritas com confirmação forte

- Implementar `BackofficeBotAiActionProposal` e `BethaniaAiProposalService`.
- Converter intenção em DTO validado, cifrar parâmetros e gerar mensagem de confirmação com lead/ação/dados.
- Aceitar exclusivamente `CONFIRMAR`/`CANCELAR`; expirar em 10 min.
- Ao confirmar, revalidar vínculo, permissão, lead, disponibilidade e idempotência antes de chamar o use case atual.
- Métricas de proposal, confirmação, cancelamento, execução e falha entram na aba Qualidade.

Aceite: zero escrita sem confirmação; confirmação repetida não duplica operação; mudança de permissão entre proposal e confirmação bloqueia a execução.

### Fase 4 — Base de conhecimento confiável

- Criar diretório versionado `docs/bethania-knowledge/` com Markdown publicado e frontmatter `title`, `slug`, `audience`, `updatedAt`, `deepLink`.
- Criar `BackofficeBotAiKnowledgeDocument` e `BackofficeBotAiKnowledgeChunk`, `tsvector` e GIN em migration manual.
- Criar comando Bun de ingestão idempotente que lê somente este diretório, divide chunks e atualiza por hash.
- Busca lexical Postgres primeiro; IA recebe no máximo cinco chunks e obrigatoriamente cita `deepLink`.
- Sem evidência, responder que não encontrou e apontar suporte; não inventar procedimento.

Aceite: conteúdo fora do diretório não é indexado; cada resposta tem fonte ou fallback seguro; alteração reindexa somente o documento alterado.

### Fase 5 — Busca semântica e áudio

- Subir Ollama em VPS privada/Tailscale; nunca publicar a porta 11434.
- Instalar `qwen3-embedding:0.6b`, habilitar `pgvector`, `vector(1024)` e HNSW.
- Implementar busca híbrida FTS + similaridade, com fallback integral para FTS quando Ollama falhar.
- Adicionar transcrição de áudio com `whisper-large-v3-turbo` da Groq; registrar segundos de áudio e aplicar o mesmo roteador/idempotência.

Aceite: embeddings não saem da rede privada; falha do Ollama não bloqueia bot; áudio não duplica ação.

### Fase 6 — Qualidade contínua e operação proativa

- Dataset anonimizado em `tests/fixtures/studio-bot-ai/` e `BethaniaAiEvaluationService` em CI manual/cron.
- Avaliar intenção, entidades, schema, latência, tokens e regressão de prompt/modelo.
- A/B por `promptVersion`/modelo até 10%, sticky por vínculo, com dashboard comparativo.
- Resumos e notificações proativas somente para preferências existentes e dados retornados por backend.
- Personalização limitada a timezone, papel, time ativo e concisão; nunca inferir atributo sensível.

Aceite: promoção exige relatório e aprovação `fullAccess`; dataset não contém e-mail, telefone, CNPJ, nota nem anexo real.

## Testes, rollout e rollback

Unitários: schemas, redator, rollout, quota, circuit breaker, normalização de usage, `429`, timeout, JSON inválido, fallback, cifra/decifra, expiração/idempotência da proposal e prompt injection.

Integração: webhook → classificação → telemetria; matriz MASTER/MANAGER/OPERATOR; endpoints de métricas/paginação/autorização; cron idempotente; confirmação revalidando permissões.

E2E/manual: 200 frases anonimizadas, provider indisponível, quota excedida, chave inválida, proposal repetida, dashboard, exportação e vínculo com conversa.

Validação em cada fase:

```bash
bun run typecheck
bun run lint
bun run governance:check
bun run lint:pt-br
bun run design:check # quando houver UI
bun test lib/studio-bot app/api/services/backofficeBot app/api/useCases/backofficeBot
```

Atualizar `postman/Lead-Flow-API-Collection.json` a cada endpoint.

Metas iniciais: intenção correta ≥92%, JSON válido ≥99%, P95 ≤8 s, fallback <5%, resolução de leituras sem menu ≥75% após 30 dias, zero escrita sem confirmação, zero execução duplicada e 100% dos attempts com modelo/status/tokens quando o provider os retornar.

Rollback, nesta ordem: `isEnabled=false`; `shadowMode=true`; `rolloutPercentage=0`; desabilitar modelo/fallback pela configuração; remover chave do ambiente em incidente de privacidade. Nenhum rollback depende de remover migration ou desligar os fluxos determinísticos v1.
