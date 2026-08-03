# Spec 03 — Migração OpenWA → Meta Cloud API (por time)

Migra o motor WhatsApp de produto do **OpenWA** (companion device, risco de ban, custo fixo) para a **Meta Cloud API** (API oficial, sem risco de ban, cobrança por mensagem), permitindo que cada time migre individualmente com rollback possível até o ponto de não-retorno, sem downtime global.

---

## 1. Problema

### 1.1 Por que migrar do OpenWA (whatsapp-web.js) para a Meta Cloud API?

O OpenWA opera em modo companion device — o número continua vinculado ao celular do time, e o Chromium simula um segundo dispositivo conectado ao WhatsApp Web. Isso tem limitações estruturais:

| Limitação | Impacto |
|-----------|---------|
| Risco de ban por Meta | Qualquer update de política pode derrubar contas sem aviso |
| Celular precisa ficar ligado | Se o celular do operador desligar, a sessão cai |
| ~600MB RAM por instância | Escala linear com número de times — custo de VPS cresce |
| Sem suporte a templates oficiais | Não pode usar HSM para contatos fora da janela 24h |
| WhatsApp Business não-verificado | Sem selo verde, menor confiança dos leads |

A Meta Cloud API é a API oficial — o número fica registrado diretamente na plataforma da Meta, sem companion device. Benefícios:

- **Zero risco de ban** — uso totalmente oficial e documentado
- **Celular não necessário** — o número opera independentemente de qualquer dispositivo
- **Templates HSM aprovados** — contact fora da janela de 24h via templates aprovados
- **Escalabilidade** — sem overhead de Chromium; a Meta gerencia a infraestrutura
- **Selo verde** — conta Business verificada transmite confiança ao lead

### 1.2 Por que por time e não big-bang?

- Cada time precisa criar sua própria conta **WABA** (WhatsApp Business Account) e passar pela **Business Verification** da Meta — processo que pode levar 1–7 dias por time
- O número do time precisa ser **registrado na Meta**, o que **desconecta automaticamente** o celular do companion device — este é o ponto de não-retorno
- Times com base de contatos sensível à latência não podem ficar sem WhatsApp durante o processo
- Migração individual permite aprender com os primeiros times antes de aplicar para todos

### 1.3 Por que a Bethânia NÃO migra nesta spec?

A Bethânia é um número de plataforma (não por time), gerenciada pelo backoffice. Migrar a Bethânia para Meta exigiria uma WABA da empresa (não do time) e templates distintos. Isso é uma decisão de negócio separada, fora do escopo desta spec.

---

## 2. Gate de Entrada (pré-requisitos obrigatórios)

Esta spec só deve ser iniciada quando **todos** os gates estiverem satisfeitos:

| Gate | Como verificar |
|------|---------------|
| ≥ 20 times com add-on WhatsApp pagando | Dashboard backoffice `whatsapp/migration` |
| ≥ 30 dias consecutivos sem incidente crítico no OpenWA | Logs de erro do Gateway + Sentry |
| `IWhatsAppProvider` e `WhatsAppEngineFactory` funcionais (Spec 01) | `bun run typecheck` + smoke test |
| Ao menos 2 templates Meta aprovados | Meta Business Manager → Templates |
| Business Verification da empresa (Corretor Studio) aprovada | Meta Business Manager → Account Quality |

---

## 3. Escopo

### Incluído

- `MetaGraphApiService` — cliente REST para Graph API v20.0+
- `IMetaGraphApiService` — interface para testabilidade
- `MetaCloudProvider` implementando `IWhatsAppProvider` (mesmo adapter pattern da Spec 01)
- Guard de janela de 24h (backend + UI)
- Webhook Meta Cloud API: `GET` (challenge) + `POST` (recebimento com HMAC)
- State machine de migração em `TeamWhatsappConfig.migrationStatus`
- UseCase `StartMetaMigrationUseCase`
- UseCase `ActivateMetaEngineUseCase` (ponto de não-retorno)
- Rotas: `POST /migrate-to-meta`, `PATCH /waba-credentials`, `POST /activate-meta`
- Painel backoffice de status de migração por time
- Modelo `WhatsappUsageEvent` para billing de templates
- Onboarding in-app (checklist guiado de Business Verification)
- Guard de janela 24h na `MessageInputBar` (frontend)

### Excluído

- Bethânia via Meta (decisão futura)
- Desligamento da VPS (somente quando `COUNT(engine=OPENWA) = 0`)
- App-to-person (A2P) flows além dos 3 templates especificados

---

## 4. Arquitetura

### 4.1 Visão geral

```
┌─────────────────────────────────────────────────────────────────────┐
│  Meta Cloud API (infraestrutura Meta)                               │
│                                                                     │
│  • Número registrado diretamente na Meta                            │
│  • Sem companion device, sem celular vinculado                      │
│  • Envia eventos via webhook (HMAC-SHA256 com APP_SECRET)           │
│  • Recebe mensagens via Graph API v20.0                             │
└──────────────────────────┬────────────────────────────┬────────────┘
                           │ webhook POST                │ API calls
                           ↓                             ↓
┌──────────────────────────────────────────────────────────────────── ┐
│  Corretor Studio (Vercel)                                           │
│                                                                     │
│  Inbound:                                                           │
│    /api/webhooks/whatsapp/meta/[wabaToken]                          │
│      → verifyMetaHmac() → normalizar → ProcessWebhookOutboxUseCase  │
│                                                                     │
│  Outbound:                                                          │
│    UseCase → WhatsAppEngineFactory.forTeam()                        │
│      → MetaCloudProvider (se engine = META)                         │
│        → MetaGraphApiService.sendText / sendTemplate                │
│          → isWithin24hWindow? → texto livre : HSM template          │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 State machine de migração

```
team_whatsapp_configs.migrationStatus

OPENWA_ACTIVE
  ↓ Admin clica "Iniciar migração" → POST /api/v1/whatsapp/settings/migrate-to-meta
MIGRATION_PENDING
  ↓ Admin submete Business Verification no Meta
BV_PENDING
  ↓ Meta aprova (1–7 dias) → polling ou webhook de BV
BV_APPROVED
  ↓ Admin registra WABA ID, Phone Number ID, Access Token
  ↓ PATCH /api/v1/whatsapp/settings/waba-credentials
WABA_SETUP
  ↓ PONTO DE NÃO-RETORNO: registrar número desconecta companion device
  ↓ Admin confirma modal de não-retorno
  ↓ POST /api/v1/whatsapp/settings/activate-meta
META_ACTIVE ✅

Rollback:
  MIGRATION_PENDING → OPENWA_ACTIVE (admin cancela, sem consequências)
  BV_PENDING → OPENWA_ACTIVE (sem BV registrada, sem consequências)
  BV_APPROVED → OPENWA_ACTIVE (ainda não registrou número, sem consequências)
  WABA_SETUP → impossível (número já registrado na Meta)
```

### 4.3 Janela de 24h

```
Inbound (lead envia mensagem):
  → salvar whatsapp_conversations.lastInboundAt = now()

Outbound (corretor quer enviar):
  → MetaCloudProvider.sendTextMessage()
    → isWithin24hWindow(conversationId)
      → SIM (< 24h): sendText via Graph API → service message (grátis, cobrado como "service")
      → NÃO (≥ 24h): lançar WhatsAppWindowExpiredError
                      → frontend exibe seletor de templates
                      → usuário escolhe template → sendTemplate()
                      → WhatsappUsageEvent criado para billing
      → NUNCA: contato nunca respondeu → sendTemplate() obrigatório
```

---

## 5. Schema — alterações Prisma

```prisma
// prisma/schema.prisma

enum WhatsAppMigrationStatus {
  OPENWA_ACTIVE
  MIGRATION_PENDING
  BV_PENDING
  BV_APPROVED
  WABA_SETUP
  META_ACTIVE
}

model TeamWhatsappConfig {
  // ... campos existentes (Spec 01: engine WhatsAppEngine @default(OPENWA))

  migrationStatus      WhatsAppMigrationStatus @default(OPENWA_ACTIVE)
  migrationStartedAt   DateTime?
  migrationCompletedAt DateTime?

  // Credenciais Meta (preenchidas em WABA_SETUP)
  // Por que armazenar aqui: cada time tem sua própria WABA e token de sistema
  wabaId           String?  // ID da WhatsApp Business Account do time
  phoneNumberId    String?  // ID do número registrado na Meta
  // Por que não armazenar metaAccessToken diretamente:
  // tokens de sistema são longos e sensíveis — armazenar no Supabase Vault ou
  // criptografar em repouso antes de persistir (AES-256 com ENCRYPTION_KEY)
  metaAccessTokenEncrypted String? // token criptografado (AES-256)
  businessVerifiedAt DateTime?
}

model WhatsappUsageEvent {
  id           String   @id @default(uuid())
  teamId       String
  configId     String
  // Por que dois tipos: "template_sent" tem custo variável (billing Meta),
  // "service_message" é grátis dentro da janela 24h
  eventType    String   // "template_sent" | "service_message_sent"
  templateName String?
  metaCostBrl  Decimal? // custo Meta em BRL (para markup ao time)
  createdAt    DateTime @default(now())

  @@index([teamId, createdAt])
}

// Adicionar em whatsapp_conversations (se não existir):
model WhatsappConversation {
  // ... campos existentes
  lastInboundAt DateTime? // atualizado a cada mensagem recebida do lead
}
```

**Migrations:**
- `bun run db:migrate:from-prisma -- add-meta-migration-status-to-whatsapp-config`
- `bun run db:migrate:new create-whatsapp-usage-events`
- `bun run db:migrate:from-prisma -- add-last-inbound-at-to-whatsapp-conversation`

---

## 6. Implementação Backend

### 6.1 `IMetaGraphApiService.ts`

```typescript
// app/api/services/whatsapp/meta/IMetaGraphApiService.ts
// Por que: MetaCloudProvider testável com stub — sem chamadas reais à Graph API em teste.

export interface IMetaGraphApiService {
  sendText(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    text: string
  ): Promise<MetaSentMessageResponse>;

  sendTemplate(
    phoneNumberId: string,
    accessToken: string,
    params: MetaTemplateParams
  ): Promise<MetaSentMessageResponse>;

  markAsRead(
    phoneNumberId: string,
    accessToken: string,
    messageId: string
  ): Promise<void>;

  listTemplates(wabaId: string, accessToken: string): Promise<MetaTemplate[]>;
}

export interface MetaTemplateParams {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: MetaTemplateComponent[];
}

export interface MetaSentMessageResponse {
  messageId: string;
  status: string;
}
```

### 6.2 `MetaGraphApiService.ts`

```typescript
// app/api/services/whatsapp/meta/MetaGraphApiService.ts
// Por que: isola toda comunicação com a Graph API em um único service.
//          Facilita mock em testes e logging centralizado.
// Como: usa fetch nativo (Node 22 — sem dependência adicional).
// Onde: injetado em MetaCloudProvider.

const GRAPH_BASE = "https://graph.facebook.com/v20.0";

export class MetaGraphApiService implements IMetaGraphApiService {
  private async request<T>(
    url: string,
    method: string,
    accessToken: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Log com contexto suficiente para debug — sem logar o accessToken
      console.error(`[MetaGraphApiService] ${method} ${url} → ${res.status}`, err);
      throw new Error(
        `Meta API error ${res.status}: ${(err as Record<string, unknown>)?.error ?? "unknown"}`
      );
    }
    return res.json() as Promise<T>;
  }

  async sendText(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    text: string
  ): Promise<MetaSentMessageResponse> {
    const data = await this.request<{ messages: Array<{ id: string }> }>(
      `${GRAPH_BASE}/${phoneNumberId}/messages`,
      "POST",
      accessToken,
      {
        messaging_product: "whatsapp",
        recipient_type:    "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      }
    );
    return { messageId: data.messages[0].id, status: "sent" };
  }

  async sendTemplate(
    phoneNumberId: string,
    accessToken: string,
    params: MetaTemplateParams
  ): Promise<MetaSentMessageResponse> {
    const data = await this.request<{ messages: Array<{ id: string }> }>(
      `${GRAPH_BASE}/${phoneNumberId}/messages`,
      "POST",
      accessToken,
      {
        messaging_product: "whatsapp",
        to: params.to,
        type: "template",
        template: {
          name:       params.templateName,
          language:   { code: params.languageCode ?? "pt_BR" },
          components: params.components ?? [],
        },
      }
    );
    return { messageId: data.messages[0].id, status: "sent" };
  }

  async markAsRead(
    phoneNumberId: string,
    accessToken: string,
    messageId: string
  ): Promise<void> {
    await this.request(
      `${GRAPH_BASE}/${phoneNumberId}/messages`,
      "POST",
      accessToken,
      {
        messaging_product: "whatsapp",
        status:     "read",
        message_id: messageId,
      }
    );
  }

  async listTemplates(wabaId: string, accessToken: string): Promise<MetaTemplate[]> {
    const data = await this.request<{ data: MetaTemplate[] }>(
      `${GRAPH_BASE}/${wabaId}/message_templates?fields=name,status,category,language`,
      "GET",
      accessToken
    );
    return data.data.filter((t) => t.status === "APPROVED");
  }
}

export const metaGraphApiService = new MetaGraphApiService();
```

### 6.3 `MetaCloudProvider.ts`

```typescript
// app/api/services/whatsapp/provider/MetaCloudProvider.ts
// Por que: adapter do IWhatsAppProvider para Meta Cloud API.
//          UseCases não sabem se estão falando com OpenWA ou Meta.
// Como: resolve credenciais Meta do banco para cada teamId — cada time tem WABA própria.
// Onde: retornado por WhatsAppEngineFactory.forTeam() quando engine = META.

import type { IWhatsAppProvider } from "./IWhatsAppProvider";
import type { IMetaGraphApiService } from "../meta/IMetaGraphApiService";
import { metaGraphApiService } from "../meta/MetaGraphApiService";
import { prisma } from "@/app/api/infra/data/prisma";
import { decrypt } from "@/lib/crypto/aes";

export class WhatsAppWindowExpiredError extends Error {
  constructor() {
    super(
      "Fora da janela de 24h — use um template aprovado. " +
      "O lead deve ter enviado uma mensagem nas últimas 24 horas para receber texto livre."
    );
    this.name = "WhatsAppWindowExpiredError";
  }
}

export class MetaCloudProvider implements IWhatsAppProvider {
  constructor(private readonly meta: IMetaGraphApiService = metaGraphApiService) {}

  // Por que resolver config por teamId: cada time tem phoneNumberId e token distintos.
  // Por que decrypt: metaAccessTokenEncrypted é criptografado em repouso (ENCRYPTION_KEY).
  private async resolveConfig(teamId: string) {
    const cfg = await prisma.teamWhatsappConfig.findUnique({
      where:  { teamId },
      select: { phoneNumberId: true, metaAccessTokenEncrypted: true, wabaId: true },
    });
    if (!cfg?.phoneNumberId || !cfg.metaAccessTokenEncrypted) {
      throw new Error(
        `[MetaCloudProvider] Time ${teamId} sem configuração Meta ativa — ` +
        "verificar se migração foi concluída (engine = META e credenciais preenchidas)"
      );
    }
    return {
      phoneNumberId: cfg.phoneNumberId,
      accessToken:   decrypt(cfg.metaAccessTokenEncrypted),
      wabaId:        cfg.wabaId,
    };
  }

  // Por que verificar 24h no provider e não no UseCase:
  // A regra da janela é específica da Meta Cloud API — o OpenWAProvider não precisa dela.
  // Cada provider implementa suas próprias restrições sem poluir o UseCase.
  private async isWithin24hWindow(conversationId: string): Promise<boolean> {
    const conv = await prisma.whatsappConversation.findUnique({
      where:  { id: conversationId },
      select: { lastInboundAt: true },
    });
    if (!conv?.lastInboundAt) return false; // nunca houve inbound → fora da janela
    return Date.now() - conv.lastInboundAt.getTime() < 24 * 60 * 60 * 1000;
  }

  async sendTextMessage(params: {
    teamId:         string;
    conversationId: string;
    to:             string;
    text:           string;
  }): Promise<{ messageId: string }> {
    const withinWindow = await this.isWithin24hWindow(params.conversationId);
    if (!withinWindow) throw new WhatsAppWindowExpiredError();

    const config = await this.resolveConfig(params.teamId);
    const result = await this.meta.sendText(
      config.phoneNumberId,
      config.accessToken,
      params.to,
      params.text
    );
    return { messageId: result.messageId };
  }

  async sendTemplate(params: {
    teamId:       string;
    to:           string;
    templateName: string;
    components?:  unknown[];
    languageCode?: string;
  }): Promise<{ messageId: string }> {
    const config = await this.resolveConfig(params.teamId);
    const result = await this.meta.sendTemplate(config.phoneNumberId, config.accessToken, {
      to:           params.to,
      templateName: params.templateName,
      components:   params.components as MetaTemplateComponent[],
      languageCode: params.languageCode,
    });

    // Registrar uso para billing
    await prisma.whatsappUsageEvent.create({
      data: {
        teamId:       params.teamId,
        configId:     "", // buscar configId se necessário
        eventType:    "template_sent",
        templateName: params.templateName,
        // metaCostBrl: calcular com base na tabela de preços Meta
      },
    });

    return { messageId: result.messageId };
  }

  async markMessagesAsRead(params: {
    teamId:     string;
    instanceName: string; // ignorado para Meta (usa phoneNumberId da config)
    messageId:  string;
  }): Promise<void> {
    const config = await this.resolveConfig(params.teamId);
    await this.meta.markAsRead(config.phoneNumberId, config.accessToken, params.messageId);
  }

  // adoptOrCreateInstance, disconnectInstance, getInstanceStatus:
  // Não aplicáveis para Meta — autenticação é via Business Manager, sem QR code.
  // Retornam noop ou status estático para manter compatibilidade com IWhatsAppProvider.
  async adoptOrCreateInstance(_params: unknown): Promise<void> {
    // noop — Meta não usa sessão companion
  }

  async getInstanceStatus(_instanceName: string) {
    return { connected: true, qrCode: undefined, rawStatus: "META_MANAGED" };
  }

  async disconnectInstance(_instanceName: string): Promise<void> {
    // noop — desconexão Meta é feita via Business Manager
  }
}

export const metaCloudProvider = new MetaCloudProvider();
```

### 6.4 Verificação HMAC — `lib/whatsapp/meta-hmac.ts`

```typescript
// lib/whatsapp/meta-hmac.ts
// Por que: webhook Meta usa x-hub-signature-256 com APP_SECRET (diferente do OPENWA_WEBHOOK_SECRET).
//          Função separada para clareza — não misturar as duas implementações de HMAC.

import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaHmac(
  appSecret: string,
  rawBody: Buffer,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided  = signatureHeader.replace(/^sha256=/, "");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}
```

### 6.5 Webhook Meta — `app/api/webhooks/whatsapp/meta/[wabaToken]/route.ts`

```typescript
// app/api/webhooks/whatsapp/meta/[wabaToken]/route.ts
// Por que rota separada: Meta tem dois métodos distintos (GET para challenge, POST para eventos).
// Por que [wabaToken]: permite múltiplas WABAs registradas com tokens distintos.
// Como: GET valida challenge de verificação do webhook; POST valida HMAC e processa.

import { type NextRequest, NextResponse } from "next/server";
import { getValidatedEnv } from "@/lib/env/validation";
import { verifyMetaHmac } from "@/lib/whatsapp/meta-hmac";
import { processWhatsAppWebhookOutboxUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsAppWebhookOutboxUseCase";
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository";

// GET: Meta webhook verification challenge
// Por que: quando o webhook é registrado no Meta Business Manager, a Meta envia
//          um GET com hub.challenge que deve ser ecoado para confirmar o endpoint.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wabaToken: string }> }
) {
  const env       = getValidatedEnv();
  const mode      = request.nextUrl.searchParams.get("hub.mode");
  const token     = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    console.info(`[MetaWebhookRoute][GET] Challenge verificado`);
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: receber eventos da Meta (mensagens, status, leitura)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ wabaToken: string }> }
) {
  const { wabaToken } = await params;
  const env = getValidatedEnv();

  // 1. Ler raw body para HMAC (não pode usar request.json() antes)
  const rawBody   = Buffer.from(await request.arrayBuffer());
  const sigHeader = request.headers.get("x-hub-signature-256");

  // 2. Verificar HMAC com APP_SECRET (não com OPENWA_WEBHOOK_SECRET)
  if (!verifyMetaHmac(env.META_APP_SECRET, rawBody, sigHeader)) {
    console.error(`[MetaWebhookRoute][POST] HMAC inválido — wabaToken: ${wabaToken}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Parse
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 4. Identificar o time pelo wabaId no payload
  const wabaId = extractWabaId(payload);
  const config  = wabaId
    ? await whatsAppRepository.findConfigByWabaId(wabaId)
    : null;

  if (!config) {
    // Responder 200 para não causar retry da Meta, mas logar o erro
    console.error(`[MetaWebhookRoute][POST] WABA ID não encontrado: ${wabaId}`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // 5. Processar (mesmo UseCase do OpenWA — engine diferente, UseCase igual)
  await processWhatsAppWebhookOutboxUseCase.execute({
    teamId:  config.teamId,
    payload,
    engine:  "META",
  });

  // 6. Meta exige 200 em até 20s — responder imediatamente, processar em background se necessário
  return NextResponse.json({ received: true }, { status: 200 });
}

function extractWabaId(payload: unknown): string | null {
  try {
    const p = payload as Record<string, unknown>;
    const entry = (p.entry as Array<Record<string, unknown>>)?.[0];
    return (entry?.id as string) ?? null;
  } catch {
    return null;
  }
}
```

### 6.6 UseCases de migração

```typescript
// app/api/useCases/whatsapp/StartMetaMigrationUseCase.ts
// Por que: encapsula a transição de estado OPENWA_ACTIVE → MIGRATION_PENDING.
//          Valida que o time ainda não iniciou migração e cria notificação de acompanhamento.

export class StartMetaMigrationUseCase {
  async execute(ctx: TeamContext): Promise<Output> {
    const config = await this.repo.findByTeamId(ctx.teamId, {
      select: { migrationStatus: true },
    });

    if (config?.migrationStatus !== "OPENWA_ACTIVE") {
      return new Output(false, [], [
        "Migração já em andamento ou concluída — verificar status atual"
      ], null);
    }

    await this.repo.updateMigrationStatus(ctx.teamId, {
      migrationStatus:    "MIGRATION_PENDING",
      migrationStartedAt: new Date(),
    });

    await this.notificationService.createForTeam({
      teamId: ctx.teamId,
      title:  "Migração para WhatsApp Oficial iniciada",
      body:   "Complete a Business Verification no Meta Business Manager para continuar. " +
              "O processo pode levar de 1 a 7 dias úteis.",
      actionUrl: "/settings/whatsapp/migration",
    });

    return new Output(true, ["Migração iniciada com sucesso"], [], {
      migrationStatus: "MIGRATION_PENDING",
    });
  }
}
```

```typescript
// app/api/useCases/whatsapp/ActivateMetaEngineUseCase.ts
// Por que: ponto de não-retorno. Após esta execução, o número está registrado na Meta
//          e desvinculado do companion device (OpenWA). Requer dupla confirmação (frontend + backend).
// Como: atualiza engine para META, migrationStatus para META_ACTIVE,
//       fecha a sessão OpenWA do time no Gateway.

export class ActivateMetaEngineUseCase {
  async execute(ctx: TeamContext): Promise<Output> {
    const config = await this.repo.findByTeamId(ctx.teamId, {
      select: { migrationStatus: true, phoneNumberId: true, metaAccessTokenEncrypted: true },
    });

    if (config?.migrationStatus !== "WABA_SETUP") {
      return new Output(false, [], [
        "Não é possível ativar Meta: estado inválido. " +
        "Configure as credenciais WABA primeiro."
      ], null);
    }

    if (!config.phoneNumberId || !config.metaAccessTokenEncrypted) {
      return new Output(false, [], [
        "phoneNumberId e metaAccessToken são obrigatórios para ativar Meta"
      ], null);
    }

    // Atualizar engine e status — a partir daqui, factory retorna MetaCloudProvider
    await this.repo.updateEngineAndStatus(ctx.teamId, {
      engine:              "META",
      migrationStatus:     "META_ACTIVE",
      migrationCompletedAt: new Date(),
    });

    // Fechar sessão OpenWA do time (libera RAM do Chrome process na VPS)
    // Não lançar se falhar — a sessão OpenWA cai sozinha por inatividade
    try {
      const openwaProvider = openWaWhatsAppProvider;
      const instanceName   = await this.repo.getInstanceName(ctx.teamId);
      if (instanceName) {
        await openwaProvider.disconnectInstance(instanceName);
      }
    } catch (err) {
      console.error(`[ActivateMetaEngineUseCase] Erro ao fechar sessão OpenWA: ${err}`);
    }

    return new Output(true, ["Motor WhatsApp atualizado para API Oficial Meta"], [], {
      engine:          "META",
      migrationStatus: "META_ACTIVE",
    });
  }
}
```

---

## 7. Rotas API

```typescript
// app/api/v1/whatsapp/settings/migrate-to-meta/route.ts
export async function POST(request: NextRequest) {
  const access = await getTeamAccess(request);
  if (!access.isValid) return unauthorized();
  if (!["MASTER", "MANAGER"].includes(access.ctx.teamMember.role)) return forbidden();

  const result = await startMetaMigrationUseCase.execute(access.ctx);
  return result.isValid
    ? NextResponse.json(result.result, { status: 200 })
    : NextResponse.json({ errors: result.errorMessages }, { status: 400 });
}

// app/api/v1/whatsapp/settings/waba-credentials/route.ts
// Por que PATCH: atualização parcial — não modifica engine ainda
export async function PATCH(request: NextRequest) {
  const access = await getTeamAccess(request);
  if (!access.isValid) return unauthorized();
  if (access.ctx.teamMember.role !== "MASTER") return forbidden(); // só MASTER

  const body = await request.json();
  const { wabaId, phoneNumberId, accessToken } = body;

  const encrypted = encrypt(accessToken); // AES-256 com ENCRYPTION_KEY
  await whatsAppRepository.updateWabaCredentials(access.ctx.teamId, {
    wabaId,
    phoneNumberId,
    metaAccessTokenEncrypted: encrypted,
    migrationStatus: "WABA_SETUP",
  });

  return NextResponse.json({ ok: true });
}

// app/api/v1/whatsapp/settings/activate-meta/route.ts
// Por que POST e não PATCH: é uma ação, não uma atualização de recurso
export async function POST(request: NextRequest) {
  const access = await getTeamAccess(request);
  if (!access.isValid) return unauthorized();
  if (access.ctx.teamMember.role !== "MASTER") return forbidden();

  const result = await activateMetaEngineUseCase.execute(access.ctx);
  return result.isValid
    ? NextResponse.json(result.result, { status: 200 })
    : NextResponse.json({ errors: result.errorMessages }, { status: 400 });
}

// app/api/v1/whatsapp/templates/route.ts
// Lista templates aprovados no Meta para o time — usado pelo frontend
export async function GET(request: NextRequest) {
  const access = await getTeamAccess(request);
  if (!access.isValid) return unauthorized();

  const config = await whatsAppRepository.findByTeamId(access.ctx.teamId, {
    select: { wabaId: true, metaAccessTokenEncrypted: true },
  });
  if (!config?.wabaId) {
    return NextResponse.json({ templates: [] });
  }

  const accessToken = decrypt(config.metaAccessTokenEncrypted!);
  const templates   = await metaGraphApiService.listTemplates(config.wabaId, accessToken);
  return NextResponse.json({ templates });
}
```

---

## 8. Implementação Frontend

### 8.1 Guard de janela 24h — `MessageInputBar`

```typescript
// features/whatsapp/context/WhatsAppConversationContext.tsx (ou equivalente)

// Verificar se conversa está dentro da janela 24h
const isWithin24hWindow = useMemo(() => {
  if (!conversation?.lastInboundAt) return false;
  const diff = Date.now() - new Date(conversation.lastInboundAt).getTime();
  return diff < 24 * 60 * 60 * 1000;
}, [conversation?.lastInboundAt]);

const isMetaEngine = config?.engine === "META";
const requiresTemplate = isMetaEngine && !isWithin24hWindow;
```

```tsx
// features/whatsapp/components/MessageInputBar.tsx
// Quando fora da janela 24h no Meta, substituir input de texto por seletor de template

{requiresTemplate ? (
  <div className="flex flex-col gap-2 p-3 bg-warning/10 border border-warning rounded-md">
    <p className="text-sm text-warning-foreground">
      Última mensagem recebida há mais de 24h.
      Para iniciar uma conversa, selecione um template aprovado.
    </p>
    <TemplateSelector
      templates={approvedTemplates}
      onSelect={handleSendTemplate}
    />
  </div>
) : (
  <MessageInput
    value={messageText}
    onChange={setMessageText}
    onSend={handleSendText}
    disabled={isSending}
  />
)}
```

### 8.2 Checklist de Business Verification (in-app)

```tsx
// app/settings/whatsapp/migration/features/container/MigrationContainer.tsx

const MIGRATION_STEPS = [
  {
    id: "bm-account",
    label: "Conta Business Manager criada",
    helpUrl: "https://business.facebook.com",
    description: "Crie ou use uma conta existente do Meta Business Manager",
  },
  {
    id: "bv-submitted",
    label: "Business Verification submetida",
    description: "Envie os documentos da empresa no Meta Business Manager → Account Quality",
  },
  {
    id: "tos-accepted",
    label: "Termos do WhatsApp Business aceitos",
    description: "Aceite os termos em Meta Business Manager → WhatsApp Accounts",
  },
  {
    id: "waba-created",
    label: "WABA (WhatsApp Business Account) criada",
    description: "Crie a conta WABA e anote o WABA ID",
  },
] as const;
```

### 8.3 Modal de ponto de não-retorno

```tsx
// Exibir antes de POST /activate-meta
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Esta ação não pode ser desfeita</AlertDialogTitle>
      <AlertDialogDescription>
        Ao confirmar, o número <strong>{phoneNumber}</strong> será registrado na
        Meta Cloud API e desvinculado do dispositivo companion atual (WhatsApp Web).
        <br /><br />
        Após a confirmação, não será possível reverter para o modo anterior.
        Certifique-se de que as credenciais WABA estão corretas antes de prosseguir.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground"
        onClick={handleActivateMeta}
        disabled={isActivating}
      >
        {isActivating ? "Ativando..." : "Confirmar migração"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 9. Painel Backoffice — Status de Migração

```
app/backoffice/(app)/whatsapp/migration/
  page.tsx
  loading.tsx
  features/
    context/
      MigrationTypes.ts
      MigrationHook.ts
      MigrationContext.tsx
    services/
      IMigrationService.ts
      MigrationService.ts
    container/
      MigrationContainer.tsx
    components/
      MigrationStatusBadge.tsx
      TeamMigrationRow.tsx
```

```typescript
// app/api/v1/backoffice/whatsapp/migration-status/route.ts
// Por que backoffice route: dados sensíveis de todos os times — só backoffice acessa.

export async function GET(request: NextRequest) {
  const access = await getBackofficeAccess(request);
  if (!access.isValid) return unauthorized();

  const configs = await prisma.teamWhatsappConfig.findMany({
    select: {
      teamId:          true,
      engine:          true,
      migrationStatus: true,
      migrationStartedAt: true,
      migrationCompletedAt: true,
      team: { select: { name: true } },
    },
    orderBy: { migrationStartedAt: { sort: "desc", nulls: "last" } },
  });

  return NextResponse.json({ configs });
}
```

---

## 10. Templates obrigatórios

Os templates devem ser criados e aprovados no **Meta Business Manager** antes de ativar qualquer time. Aprovação pode levar 24–48h.

| Nome | Categoria | Corpo | Variáveis | Uso |
|------|-----------|-------|-----------|-----|
| `aviso_reuniao_utility` | UTILITY | `Olá {{1}}, aqui é {{2}}. Sua reunião está confirmada para {{3}} às {{4}}. Acesse: {{5}}` | nome lead, nome closer, data, hora, link | Aviso automático de reunião agendada |
| `primeiro_contato_marketing` | MARKETING | `Olá {{1}}, recebemos seu interesse. Podemos conversar?` | nome do lead | Primeiro contato outbound com lead frio |
| `confirmacao_reuniao_utility` | UTILITY | `Olá {{1}}, confirma presença na reunião? Responda SIM ou NÃO.` | nome lead | Confirmação de reunião agendada |

**Como criar**: Meta Business Manager → WhatsApp → Message Templates → Criar template.

**Como sincronizar status**: `GET /api/v1/whatsapp/templates` chama a Graph API e retorna apenas templates `status === "APPROVED"`.

---

## 11. Env vars

```typescript
// lib/env/validation.ts — adicionar

META_GRAPH_API_TOKEN:      z.string().min(1)
                             .describe("System User Token do Meta (gerado em Meta Business Manager → System Users)"),
META_WEBHOOK_VERIFY_TOKEN: z.string().min(16)
                             .describe("Token de verificação de webhook (definido ao registrar o webhook no Meta)"),
META_APP_SECRET:           z.string().min(32)
                             .describe("App Secret da Meta App (Meta Developers → App → Settings → Basic)"),
ENCRYPTION_KEY:            z.string().length(64)
                             .describe("Chave AES-256 hex (32 bytes = 64 chars hex) para criptografar metaAccessToken"),
```

---

## 12. Desligamento da VPS (pós-migração total)

O container OpenWA na VPS só pode ser removido quando:

```sql
-- Verificar antes de desligar:
SELECT COUNT(*) FROM team_whatsapp_configs WHERE engine = 'OPENWA';
-- Deve retornar 0

-- Verificar Bethânia:
-- A Bethânia tem instância própria no OpenWA (número de plataforma, não por time)
-- Se Bethânia ainda usa OpenWA → manter container para ela
-- Só remover container quando Bethânia também migrar (decisão futura)
```

**Sequência de desligamento:**
1. Confirmar `COUNT(engine='OPENWA') = 0` no backoffice
2. Confirmar que Bethânia está fora de escopo (ou também migrada)
3. Remover serviço `openwa` do `docker-compose.vps.yml`
4. Deletar bucket `openwa-sessions` do Supabase Storage (backup antes)
5. Revogar role `openwa_app` do Supabase (verificar dependências antes)
6. Arquivar schema `openwa`

---

## 13. Testes

| Arquivo | O que testa | Por quê |
|---------|------------|---------|
| `lib/whatsapp/meta-hmac.test.ts` | `verifyMetaHmac` — válido, inválido, ausente, hex malformado | Boundary de segurança crítico |
| `meta/MetaGraphApiService.test.ts` | `sendText`, `sendTemplate`, `markAsRead`, `listTemplates` com mock fetch | Garante contrato com Graph API |
| `provider/MetaCloudProvider.test.ts` | Janela 24h (dentro/fora), template obrigatório, resolveConfig sem credenciais | Core da lógica de negócio |
| `useCases/StartMetaMigrationUseCase.test.ts` | Happy path, já em migração, status inválido | Transição de estado |
| `useCases/ActivateMetaEngineUseCase.test.ts` | Happy path, estado inválido, sem credenciais | Ponto de não-retorno |
| `webhooks/meta/route.test.ts` | GET challenge, POST HMAC válido/inválido, WABA ID não encontrado | Rota de entrada externa |

---

## 14. Checklist de PR

- [ ] `bun run typecheck` sem erros
- [ ] `bun run lint` sem erros
- [ ] `bun run governance:check` sem violações
- [ ] `bun run lint:pt-br` sem erros
- [ ] `bun run design:check` sem violações (se houver mudanças de UI)
- [ ] `MetaCloudProvider` implementa todos os métodos de `IWhatsAppProvider`
- [ ] `WhatsAppEngineFactory.forTeam()` retorna `MetaCloudProvider` quando `engine = META`
- [ ] Webhook GET retorna challenge; POST rejeita HMAC inválido com 401
- [ ] Guard de janela 24h bloqueia `sendTextMessage` quando `isWithin24hWindow = false`
- [ ] Modal de ponto de não-retorno exibido antes de `activate-meta`
- [ ] 3 migrations geradas e validadas com `bun run db:migrate:reset:local`
- [ ] `metaAccessToken` criptografado em repouso (nunca persistir em plain text)
- [ ] Templates criados e aprovados no Meta antes de ativar qualquer time
- [ ] Painel backoffice lista status de migração por time
- [ ] `postman/Lead-Flow-API-Collection.json` atualizado: `migrate-to-meta`, `waba-credentials`, `activate-meta`, `templates`
- [ ] Smoke test com time piloto: enviar template → receber resposta → marcar como lido
