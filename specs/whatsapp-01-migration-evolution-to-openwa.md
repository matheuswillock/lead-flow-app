# Spec 01 — Migração Evolution API → OpenWA (whatsapp-web.js)

Substitui o motor WhatsApp atual (**Evolution API + Baileys**) pelo **OpenWA Gateway** — serviço self-hosted construído sobre **whatsapp-web.js + Puppeteer/Chromium** — sem downtime perceptível para o usuário final, sem notificação de reconexão, e com sessions descartadas de forma silenciosa.

---

## 1. Problema

### 1.1 Por que trocar o motor?

O Evolution API usa **Baileys** internamente — uma implementação reverse-engineered do protocolo WebSocket mobile do WhatsApp. Os problemas observados em produção são consequência direta disso:

- **Sessões silenciosas**: a conexão cai sem emitir evento de disconnect; o sistema pensa que está conectado mas não envia nem recebe
- **Loops de QR**: após reconexão, o Evolution retorna um QR code que o WhatsApp recusa
- **Ausência de HMAC real**: o "token" de validação de webhook é apenas um segmento de URL, não uma assinatura criptográfica
- **Risco de ban**: o protocolo Baileys impersona o cliente WhatsApp mobile — o Meta detecta e bane contas sem aviso

### 1.2 Por que whatsapp-web.js?

**whatsapp-web.js** automatiza o **WhatsApp Web oficial** via Puppeteer + Chromium headless. O WhatsApp reconhece a sessão como um navegador Chrome legítimo porque, de fato, é um navegador Chrome. Consequências:

| Aspecto | Baileys (Evolution atual) | whatsapp-web.js (OpenWA novo) |
|---------|--------------------------|-------------------------------|
| Autenticação | Protocolo mobile reverso | Sessão de navegador oficial |
| Risco de ban | Alto | Baixo (mesmo UA do Chrome) |
| Estabilidade de sessão | Baixa (desconexões silenciosas) | Alta (reconhece eventos de rede) |
| Session persistence | Arquivo local | RemoteAuth → Supabase |
| Restart recovery | Re-scan obrigatório | Sem re-scan (sessão persistida) |
| RAM por instância | ~80MB | ~512–700MB (Chrome process) |
| Boot time | Segundos | 15–30s (boot Chrome) |

**Trade-off aceito**: consumo de memória maior. Justifica-se porque elimina o principal problema de negócio (instabilidade de sessão).

### 1.3 Por que NÃO notificar os times para reconectar?

Sessões Baileys (Evolution) e sessões whatsapp-web.js têm formatos incompatíveis — não é possível migrar credenciais entre eles. Uma re-conexão via QR é inevitável. As opções eram:

**A) Notificação proativa** (e-mail + in-app): mais risco de confusão, times assustados com "seu WhatsApp vai cair", suporte sobrecarregado.

**B) Drop silencioso + banner no produto**: a sessão cai quando o Evolution é desligado na VPS. Na próxima vez que o time abrir o módulo WhatsApp, vê o status "Desconectado" com o QR code disponível. Experiência de reconexão já existente no produto, zero engenharia nova no frontend, zero e-mail em massa.

**Decisão: opção B.** A interface já exibe estado desconectado + QR code. O time reconecta naturalmente. Times que não acessam a plataforma continuam sem WhatsApp — isso é aceitável porque estavam sem WhatsApp funcional de qualquer forma (Evolution em loop silencioso).

---

## 2. Escopo

### Incluído nesta spec

- Serviço **OpenWA Gateway** na VPS (Node.js + whatsapp-web.js + Express REST API)
- `RemoteAuth` com **Supabase** como session store (schema `openwa`)
- Interface `IWhatsAppProvider` como boundary formal (já existe, formalizar contrato)
- `OpenWaApiService` — cliente HTTP que o Corretor Studio usa para chamar o Gateway
- `OpenWaWhatsAppProvider` — adapter implementando `IWhatsAppProvider`
- `WhatsAppEngineFactory.forTeam(teamId)` — seleciona engine por time
- Novo webhook inbound `webhooks/whatsapp/openwa/[teamToken]/route.ts` com HMAC-SHA256
- Desacoplamento dos 3 UseCases que importam `evolutionWhatsAppProvider` diretamente
- `docker-compose.vps.yml` atualizado (OpenWA + Chromium, sem Evolution)
- Schema isolado `openwa` no Supabase principal
- Remoção de toda camada `evo/` após migração validada
- Enum `WhatsAppEngine` em `TeamWhatsappConfig`

### Excluído

- UI de configuração WhatsApp (já existe para Evolution — reusar, ajustar estado)
- RBAC de conversas
- Bethânia/N8N — Spec 02
- Meta Cloud API — Spec 03

---

## 3. Arquitetura

### 3.1 Visão geral

```
┌──────────────────────────────────────────────────────────────┐
│                      VPS Hostinger                           │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  OpenWA Gateway (Node.js + whatsapp-web.js)         │    │
│  │  Porta 3333 (interno, não exposto externamente)     │    │
│  │                                                     │    │
│  │  Por instância WhatsApp:                           │    │
│  │    └── Chromium process (~600MB RAM)               │    │
│  │    └── RemoteAuth ──→ Supabase schema openwa        │    │
│  │                                                     │    │
│  │  REST API:                                          │    │
│  │    POST /session/start/:instance                   │    │
│  │    GET  /session/status/:instance                  │    │
│  │    DELETE /session/delete/:instance                │    │
│  │    POST /client/sendMessage/:instance              │    │
│  │    POST /client/sendMedia/:instance                │    │
│  │    POST /client/markChatSeen/:instance             │    │
│  │                                                     │    │
│  │  Webhook push:                                      │    │
│  │    → POST NEXT_PUBLIC_APP_URL/webhooks/openwa/      │    │
│  │      whatsapp/{teamToken}                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌───────────────────────┐   ┌───────────────────────────┐  │
│  │  N8N (Bethânia)       │   │  Evolution API (REMOVER)  │  │
│  │  (intacto nesta spec) │   │  após migração validada   │  │
│  └───────────────────────┘   └───────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   Corretor Studio (Vercel)                   │
│                                                              │
│  Route → UseCase → IWhatsAppProvider → OpenWaApiService      │
│                           ↑                                  │
│                  WhatsAppEngineFactory.forTeam()             │
│                  (lê team_whatsapp_configs.engine)           │
│                                                              │
│  Inbound: /api/webhooks/whatsapp/openwa/[teamToken]         │
│           verifica HMAC-SHA256 → processa evento             │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Adapter pattern

```
IWhatsAppProvider (interface em app/api/services/whatsapp/provider/)
  ├── OpenWaWhatsAppProvider  ← esta spec (padrão para todos os times)
  └── MetaCloudProvider       ← Spec 03 (migração futura por time)

WhatsAppEngineFactory.forTeam(teamId): Promise<IWhatsAppProvider>
  → lê TeamWhatsappConfig.engine (OPENWA | META)
  → default: OPENWA
  → import dinâmico do provider (tree-shaking, não carrega Meta em prod-OpenWA)
```

### 3.3 Banco de dados OpenWA (Supabase principal isolado)

**Por que Supabase principal e não projeto separado?**
- Projeto Evolution separado (`kzwzgkfgynfwodjmfdli`) custava um segundo projeto pago
- Schema isolado no projeto principal elimina custo e centraliza backups
- Role `openwa_app` com acesso **somente ao schema `openwa`** — sem acesso a `public`, `auth`, `storage`

**Por que porta 5432 (DIRECT_URL) e não 6543 (pooler)?**
- whatsapp-web.js mantém sessões de longa duração (horas a dias)
- O PgBouncer em modo transaction (`port 6543`) encerra a conexão após cada statement
- Com DIRECT_URL, a role `openwa_app` mantém conexão persistente estável

```sql
-- Migration: bun run db:migrate:new setup-openwa-schema
-- Executar no Supabase SQL Editor do projeto principal (autorização manual)

CREATE SCHEMA IF NOT EXISTS openwa;

CREATE ROLE openwa_app WITH LOGIN PASSWORD '<secret-gerado>';

-- Acesso apenas ao schema openwa
GRANT USAGE  ON SCHEMA openwa TO openwa_app;
GRANT ALL    ON ALL TABLES    IN SCHEMA openwa TO openwa_app;
GRANT ALL    ON ALL SEQUENCES IN SCHEMA openwa TO openwa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA openwa
  GRANT ALL ON TABLES    TO openwa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA openwa
  GRANT ALL ON SEQUENCES TO openwa_app;

-- Sem acesso a schemas da aplicação
REVOKE ALL ON SCHEMA public FROM openwa_app;
REVOKE ALL ON SCHEMA auth   FROM openwa_app;
```

`DATABASE_URL` do OpenWA Gateway:
```
postgresql://openwa_app:<secret>@db.wcnxwdcoambpfwxwubka.supabase.co:5432/postgres?schema=openwa
```

---

## 4. OpenWA Gateway — Serviço VPS

### 4.1 O que é

Um serviço **Node.js** rodando na VPS que:
1. Gerencia múltiplas instâncias whatsapp-web.js (uma por time conectado)
2. Expõe REST API autenticada por `apikey` header
3. Usa `RemoteAuth` para persistir sessão de cada instância no Supabase
4. Faz push de eventos (mensagens, status, QR) para o Corretor Studio via webhook HMAC-SHA256

### 4.2 Por que não usar um projeto open-source existente?

Projetos como `wwebjs-api` e `@open-wa/wa-automate` existem mas têm dependências desatualizadas, overhead de features não usadas, e schemas de webhook incompatíveis com o Corretor Studio. Construir um serviço enxuto com ~300 linhas de código e controle total é mais seguro.

### 4.3 Estrutura do Gateway (VPS — repositório separado ou `deploy/openwa-gateway/`)

```
deploy/openwa-gateway/
  src/
    index.ts                  # entry: Express app + inicialização de sessões ativas
    config.ts                 # env vars com zod
    auth.middleware.ts         # validação do header apikey
    sessions/
      SessionManager.ts        # Map<instanceName, Client> — singleton
      SupabaseRemoteAuth.ts    # implementação RemoteAuth para Supabase
      session.routes.ts        # POST /session/start, GET /session/status, DELETE /session/delete
    client/
      client.routes.ts         # POST /sendMessage, POST /sendMedia, POST /markChatSeen
    webhook/
      WebhookDispatcher.ts     # faz POST com HMAC-SHA256 para o Corretor Studio
    types.ts                   # tipos compartilhados
  package.json
  tsconfig.json
  Dockerfile
  .env.example
```

### 4.4 `SupabaseRemoteAuth.ts` — Por que e como

O whatsapp-web.js tem a classe `RemoteAuth` que aceita uma implementação de `Store`. O Store precisa de 4 métodos: `save`, `extract`, `delete`, `sessionExists`. Vamos implementar usando Supabase Storage (bucket `openwa-sessions`) para armazenar os arquivos de sessão do Chromium.

```typescript
// deploy/openwa-gateway/src/sessions/SupabaseRemoteAuth.ts
// Por que: RemoteAuth sobrevive a restarts do container sem re-scan de QR.
// Como: salva o diretório .wwebjs_auth/<instanceName> como ZIP no Supabase Storage.
// Onde: Supabase bucket "openwa-sessions" (privado, service role key)

import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as archiver from "archiver";
import * as unzipper from "unzipper";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "openwa-sessions";

export class SupabaseRemoteAuthStore {
  async sessionExists({ session }: { session: string }): Promise<boolean> {
    const { data } = await supabase.storage
      .from(BUCKET)
      .list("", { search: `${session}.zip` });
    return (data ?? []).length > 0;
  }

  async save({ session }: { session: string }): Promise<void> {
    // Comprime o diretório de sessão do wwebjs_auth em ZIP
    const sessionDir = path.join(".wwebjs_auth", session);
    const zipBuffer   = await compressDir(sessionDir);
    await supabase.storage
      .from(BUCKET)
      .upload(`${session}.zip`, zipBuffer, { upsert: true, contentType: "application/zip" });
  }

  async extract({ session, path: destPath }: { session: string; path: string }): Promise<void> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(`${session}.zip`);
    if (error || !data) return;
    const buffer = Buffer.from(await data.arrayBuffer());
    await extractZip(buffer, destPath);
  }

  async delete({ session }: { session: string }): Promise<void> {
    await supabase.storage.from(BUCKET).remove([`${session}.zip`]);
  }
}
```

### 4.5 `SessionManager.ts` — gerenciamento de instâncias

```typescript
// deploy/openwa-gateway/src/sessions/SessionManager.ts
// Por que: centraliza o ciclo de vida de cada Client wwebjs por instância.
// Onde: singleton importado pelas routes.

import { Client, LocalAuth, RemoteAuth, Events } from "whatsapp-web.js";
import { SupabaseRemoteAuthStore } from "./SupabaseRemoteAuth";
import { WebhookDispatcher } from "../webhook/WebhookDispatcher";

type InstanceState =
  | { status: "INITIALIZING" }
  | { status: "QR_READY"; qr: string }
  | { status: "CONNECTED" }
  | { status: "DISCONNECTED" };

class SessionManager {
  private clients  = new Map<string, Client>();
  private states   = new Map<string, InstanceState>();
  private webhooks = new Map<string, string>(); // instanceName → webhookUrl

  async startSession(instanceName: string, webhookUrl: string): Promise<void> {
    if (this.clients.has(instanceName)) return; // idempotente

    this.webhooks.set(instanceName, webhookUrl);
    this.states.set(instanceName, { status: "INITIALIZING" });

    const store  = new SupabaseRemoteAuthStore();
    const client = new Client({
      authStrategy: new RemoteAuth({
        store,
        session: instanceName,
        backupSyncIntervalMs: 300_000, // salva sessão a cada 5min
      }),
      puppeteer: {
        headless: true,
        executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",  // evita crash em VPS com pouca /dev/shm
          "--disable-gpu",
          "--single-process",
        ],
      },
    });

    // Eventos → atualizar estado + push webhook
    client.on(Events.QR_RECEIVED, (qr) => {
      this.states.set(instanceName, { status: "QR_READY", qr });
      WebhookDispatcher.send(webhookUrl, instanceName, "qr", { qr });
    });

    client.on(Events.READY, () => {
      this.states.set(instanceName, { status: "CONNECTED" });
      WebhookDispatcher.send(webhookUrl, instanceName, "ready", {});
    });

    client.on(Events.DISCONNECTED, (reason) => {
      this.states.set(instanceName, { status: "DISCONNECTED" });
      WebhookDispatcher.send(webhookUrl, instanceName, "disconnected", { reason });
    });

    client.on(Events.MESSAGE_RECEIVED, (msg) => {
      WebhookDispatcher.send(webhookUrl, instanceName, "message", serializeMessage(msg));
    });

    client.on(Events.MESSAGE_ACK, (msg, ack) => {
      WebhookDispatcher.send(webhookUrl, instanceName, "message_ack", { id: msg.id._serialized, ack });
    });

    this.clients.set(instanceName, client);
    await client.initialize(); // não bloqueia — eventos emitidos de forma assíncrona
  }

  getStatus(instanceName: string): InstanceState {
    return this.states.get(instanceName) ?? { status: "DISCONNECTED" };
  }

  async deleteSession(instanceName: string): Promise<void> {
    const client = this.clients.get(instanceName);
    if (client) {
      await client.destroy();
      this.clients.delete(instanceName);
    }
    this.states.delete(instanceName);
    this.webhooks.delete(instanceName);
    // RemoteAuth limpa o ZIP do Supabase automaticamente via client.logout()
  }

  async sendText(instanceName: string, to: string, text: string): Promise<string> {
    const client = this.clients.get(instanceName);
    if (!client) throw new Error(`Instância ${instanceName} não encontrada`);
    const chatId = to.includes("@c.us") ? to : `${to}@c.us`;
    const msg    = await client.sendMessage(chatId, text);
    return msg.id._serialized;
  }

  async sendMedia(instanceName: string, to: string, media: MediaPayload): Promise<string> {
    const { MessageMedia } = await import("whatsapp-web.js");
    const chatId  = to.includes("@c.us") ? to : `${to}@c.us`;
    const wwebMedia = new MessageMedia(media.mimetype, media.base64, media.filename);
    const msg = await client.sendMessage(chatId, wwebMedia, { caption: media.caption });
    return msg.id._serialized;
  }

  async markChatSeen(instanceName: string, chatId: string): Promise<void> {
    const client = this.clients.get(instanceName);
    if (!client) return;
    const chat = await client.getChatById(chatId.includes("@c.us") ? chatId : `${chatId}@c.us`);
    await chat.sendSeen();
  }
}

export const sessionManager = new SessionManager();
```

### 4.6 `WebhookDispatcher.ts` — HMAC-SHA256 no push

```typescript
// deploy/openwa-gateway/src/webhook/WebhookDispatcher.ts
// Por que: garante que só o OpenWA Gateway pode forjar eventos no Corretor Studio.
// Como: HMAC-SHA256 do body com OPENWA_WEBHOOK_SECRET no header x-openwa-signature.

import { createHmac } from "node:crypto";
import { config } from "../config";

export class WebhookDispatcher {
  static async send(
    webhookUrl: string,
    instance: string,
    event: string,
    data: unknown
  ): Promise<void> {
    const body      = JSON.stringify({ instance, event, data, timestamp: Date.now() });
    const signature = createHmac("sha256", config.webhookSecret)
      .update(body)
      .digest("hex");

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-openwa-signature": `sha256=${signature}`,
        },
        body,
      });
    } catch (err) {
      // Log mas não lança — falha no webhook não pode derrubar a sessão
      console.error(`[WebhookDispatcher] failed to send ${event} to ${webhookUrl}`, err);
    }
  }
}
```

### 4.7 REST API Routes

```typescript
// deploy/openwa-gateway/src/sessions/session.routes.ts

router.post("/session/start/:instance", authMiddleware, async (req, res) => {
  const { instance } = req.params;
  const { webhookUrl } = req.body;
  // webhookUrl: https://app.corretorstudio.com.br/api/webhooks/whatsapp/openwa/{teamToken}
  if (!webhookUrl) return res.status(400).json({ error: "webhookUrl required" });
  await sessionManager.startSession(instance, webhookUrl);
  res.json({ status: "starting", instance });
});

router.get("/session/status/:instance", authMiddleware, (req, res) => {
  const state = sessionManager.getStatus(req.params.instance);
  res.json(state);
});

router.delete("/session/delete/:instance", authMiddleware, async (req, res) => {
  await sessionManager.deleteSession(req.params.instance);
  res.json({ deleted: true });
});

// deploy/openwa-gateway/src/client/client.routes.ts

router.post("/client/sendMessage/:instance", authMiddleware, async (req, res) => {
  const { to, text } = req.body;
  const messageId = await sessionManager.sendText(req.params.instance, to, text);
  res.json({ messageId });
});

router.post("/client/sendMedia/:instance", authMiddleware, async (req, res) => {
  const messageId = await sessionManager.sendMedia(req.params.instance, req.body.to, req.body);
  res.json({ messageId });
});

router.post("/client/markChatSeen/:instance", authMiddleware, async (req, res) => {
  await sessionManager.markChatSeen(req.params.instance, req.body.chatId);
  res.json({ ok: true });
});
```

### 4.8 Dockerfile do Gateway

```dockerfile
# deploy/openwa-gateway/Dockerfile
# Por que não Alpine: wwebjs requer Chromium com suporte a shared libs glibc
FROM node:22-slim

# Chromium e dependências mínimas para Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/

EXPOSE 3333
CMD ["node", "dist/index.js"]
```

### 4.9 docker-compose.vps.yml — diff completo

```yaml
# REMOVER completamente:
  evolution_api:
    ...
  evolution_redis:
    ...

# ADICIONAR:
  openwa:
    build:
      context: ./deploy/openwa-gateway
      dockerfile: Dockerfile
    image: openwa-gateway:latest
    restart: unless-stopped
    env_file: .env.openwa
    volumes:
      - openwa_sessions_tmp:/app/.wwebjs_tmp  # tmp para boot antes de RemoteAuth salvar
    networks:
      - studio-bot-net
    expose:
      - "3333"
    deploy:
      resources:
        limits:
          # 700MB por instância ativa + 200MB overhead do Node.js
          # Calcular: N_instancias × 700 + 200
          # Para 20 instâncias: 14.2GB — escalar VPS conforme crescimento
          memory: 4G   # início conservador, escalar conforme base cresce
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://127.0.0.1:3333/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

# REMOVER volumes:
  evolution_instances:
  evolution_redis:

# ADICIONAR volumes:
  openwa_sessions_tmp:
```

---

## 5. Corretor Studio — Camada Backend

### 5.1 Estrutura de arquivos a criar

```
app/api/
  webhooks/
    whatsapp/
      openwa/
        [teamToken]/
          route.ts              # POST: recebe eventos do Gateway com HMAC

  services/
    whatsapp/
      openwa/
        IOpenWaApiService.ts    # interface do cliente HTTP
        OpenWaApiService.ts     # implementação: chama Gateway REST

      provider/
        OpenWaWhatsAppProvider.ts   # adapter: IWhatsAppProvider → IOpenWaApiService

  useCases/
    whatsapp/
      MarkConversationReadUseCase.ts        # desacoplar de evolutionWhatsAppProvider
      ProcessWhatsAppMediaIngestUseCase.ts  # idem
      MessageActionUseCase.ts              # idem

lib/
  whatsapp/
    openwa-hmac.ts              # verifyOpenWaHmac
    WhatsAppEngineFactory.ts    # forTeam(teamId) → IWhatsAppProvider
```

### 5.2 `lib/whatsapp/openwa-hmac.ts`

```typescript
// Por que: garante integridade do payload — apenas o Gateway com o secret correto
//          pode forjar o header x-openwa-signature.
// Como: HMAC-SHA256 do rawBody com OPENWA_WEBHOOK_SECRET.
// Onde: importado pelo route handler do webhook inbound.

import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyOpenWaHmac(
  secret: string,
  rawBody: Buffer,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided  = signatureHeader.replace(/^sha256=/, "");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false; // provided pode não ser hex válido
  }
}
```

### 5.3 `IOpenWaApiService.ts` — contrato do cliente

```typescript
// app/api/services/whatsapp/openwa/IOpenWaApiService.ts
// Por que: garante que OpenWaApiService é testável via mock/stub.
// Onde: importado por OpenWaWhatsAppProvider.

export interface IOpenWaApiService {
  startSession(instanceName: string, webhookUrl: string): Promise<void>;
  getSessionStatus(instanceName: string): Promise<OpenWaSessionStatus>;
  deleteSession(instanceName: string): Promise<void>;
  sendText(instanceName: string, to: string, text: string): Promise<OpenWaSentMessage>;
  sendMedia(instanceName: string, params: OpenWaMediaParams): Promise<OpenWaSentMessage>;
  markChatSeen(instanceName: string, chatId: string): Promise<void>;
}

export type OpenWaSessionStatus =
  | { status: "INITIALIZING" }
  | { status: "QR_READY"; qr: string }
  | { status: "CONNECTED" }
  | { status: "DISCONNECTED" };

export interface OpenWaSentMessage {
  messageId: string;
}

export interface OpenWaMediaParams {
  to: string;
  base64: string;
  mimetype: string;
  filename?: string;
  caption?: string;
}
```

### 5.4 `OpenWaApiService.ts` — cliente HTTP

```typescript
// app/api/services/whatsapp/openwa/OpenWaApiService.ts
// Por que: isola toda lógica de chamada HTTP ao Gateway em um único lugar.
//          UseCases nunca chamam fetch diretamente.
// Onde: injetado em OpenWaWhatsAppProvider via construtor.
// Como: singleton (instanciado uma vez na inicialização do módulo).

import type { IOpenWaApiService, OpenWaSessionStatus, OpenWaSentMessage, OpenWaMediaParams } from "./IOpenWaApiService";
import { getValidatedEnv } from "@/lib/env/validation";

export class OpenWaApiService implements IOpenWaApiService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    const env    = getValidatedEnv();
    this.baseUrl = env.OPENWA_API_URL.replace(/\/$/, "");
    this.apiKey  = env.OPENWA_API_KEY;
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      apikey: this.apiKey,
    };
  }

  private async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[OpenWaApiService] ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async startSession(instanceName: string, webhookUrl: string): Promise<void> {
    await this.request(`/session/start/${instanceName}`, "POST", { webhookUrl });
  }

  async getSessionStatus(instanceName: string): Promise<OpenWaSessionStatus> {
    return this.request(`/session/status/${instanceName}`, "GET");
  }

  async deleteSession(instanceName: string): Promise<void> {
    await this.request(`/session/delete/${instanceName}`, "DELETE");
  }

  async sendText(instanceName: string, to: string, text: string): Promise<OpenWaSentMessage> {
    return this.request(`/client/sendMessage/${instanceName}`, "POST", { to, text });
  }

  async sendMedia(instanceName: string, params: OpenWaMediaParams): Promise<OpenWaSentMessage> {
    return this.request(`/client/sendMedia/${instanceName}`, "POST", params);
  }

  async markChatSeen(instanceName: string, chatId: string): Promise<void> {
    await this.request(`/client/markChatSeen/${instanceName}`, "POST", { chatId });
  }
}

export const openWaApiService = new OpenWaApiService();
```

### 5.5 `OpenWaWhatsAppProvider.ts` — adapter

```typescript
// app/api/services/whatsapp/provider/OpenWaWhatsAppProvider.ts
// Por que: traduz o contrato de domínio IWhatsAppProvider para as chamadas
//          específicas do OpenWA Gateway. UseCases só conhecem IWhatsAppProvider.
// Como: construtor recebe IOpenWaApiService (injetável em testes).
// Onde: instanciado como singleton; importado apenas pela factory.

import type { IWhatsAppProvider } from "./IWhatsAppProvider";
import type { IOpenWaApiService } from "../openwa/IOpenWaApiService";
import { openWaApiService } from "../openwa/OpenWaApiService";
import { getFullUrl } from "@/lib/utils/url";

export class OpenWaWhatsAppProvider implements IWhatsAppProvider {
  constructor(private readonly openwa: IOpenWaApiService = openWaApiService) {}

  // Por que buildWebhookUrl usa getFullUrl: evita hardcode de domínio.
  // teamToken = team_whatsapp_configs.webhookSecret (já existe no schema)
  private buildWebhookUrl(teamToken: string): string {
    return getFullUrl(`/api/webhooks/whatsapp/openwa/${teamToken}`);
  }

  async adoptOrCreateInstance(params: {
    instanceName: string;
    teamToken: string;
  }): Promise<void> {
    const webhookUrl = this.buildWebhookUrl(params.teamToken);
    await this.openwa.startSession(params.instanceName, webhookUrl);
  }

  async getInstanceStatus(instanceName: string) {
    const status = await this.openwa.getSessionStatus(instanceName);
    return {
      connected: status.status === "CONNECTED",
      qrCode:    status.status === "QR_READY" ? status.qr : undefined,
      rawStatus: status.status,
    };
  }

  async disconnectInstance(instanceName: string): Promise<void> {
    await this.openwa.deleteSession(instanceName);
  }

  async sendTextMessage(params: {
    instanceName: string;
    to: string;
    text: string;
  }): Promise<{ messageId: string }> {
    const result = await this.openwa.sendText(params.instanceName, params.to, params.text);
    return { messageId: result.messageId };
  }

  async sendMediaMessage(params: {
    instanceName: string;
    to: string;
    base64: string;
    mimetype: string;
    filename?: string;
    caption?: string;
  }): Promise<{ messageId: string }> {
    const result = await this.openwa.sendMedia(params.instanceName, {
      to:       params.to,
      base64:   params.base64,
      mimetype: params.mimetype,
      filename: params.filename,
      caption:  params.caption,
    });
    return { messageId: result.messageId };
  }

  async markMessagesAsRead(params: {
    instanceName: string;
    chatId: string;
  }): Promise<void> {
    await this.openwa.markChatSeen(params.instanceName, params.chatId);
  }

  // getBase64FromMediaMessage: o wwebjs entrega o media como base64 no evento de webhook
  // Não há endpoint de download separado — o base64 já vem no payload do evento
  async getBase64FromMediaMessage(_params: unknown): Promise<string> {
    throw new Error("Media base64 já incluído no payload do webhook — use o campo data.body");
  }
}

export const openWaWhatsAppProvider = new OpenWaWhatsAppProvider();
```

### 5.6 `WhatsAppEngineFactory.ts`

```typescript
// lib/whatsapp/WhatsAppEngineFactory.ts
// Por que: desacopla UseCases do provider concreto. Permite que times migrem
//          para Meta (Spec 03) sem mudar nenhum UseCase.
// Como: import dinâmico — o provider Meta não é carregado se todos os times usam OpenWA.
// Onde: chamado por UseCases antes de qualquer operação que precise do provider.

import { prisma } from "@/app/api/infra/data/prisma";
import type { IWhatsAppProvider } from "@/app/api/services/whatsapp/provider/IWhatsAppProvider";

export const WhatsAppEngineFactory = {
  async forTeam(teamId: string): Promise<IWhatsAppProvider> {
    const config = await prisma.teamWhatsappConfig.findUnique({
      where:  { teamId },
      select: { engine: true },
    });

    if (config?.engine === "META") {
      const { metaCloudProvider } = await import(
        "@/app/api/services/whatsapp/provider/MetaCloudProvider"
      );
      return metaCloudProvider;
    }

    // Default: OPENWA (inclui times sem config cadastrada)
    const { openWaWhatsAppProvider } = await import(
      "@/app/api/services/whatsapp/provider/OpenWaWhatsAppProvider"
    );
    return openWaWhatsAppProvider;
  },
};
```

### 5.7 Webhook inbound — `openwa/[teamToken]/route.ts`

```typescript
// app/api/webhooks/whatsapp/openwa/[teamToken]/route.ts
// Por que: rota separada da Evolution para permitir coexistência durante rollout.
//          A rota Evolution permanece ativa por 7 dias após desligamento do container.
// Como: valida HMAC antes de processar qualquer dado do payload.
// Onde: URL configurada por OpenWaWhatsAppProvider.buildWebhookUrl() no startSession.

import { type NextRequest, NextResponse } from "next/server";
import { verifyOpenWaHmac } from "@/lib/whatsapp/openwa-hmac";
import { getValidatedEnv } from "@/lib/env/validation";
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository";
import { processWhatsAppWebhookOutboxUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsAppWebhookOutboxUseCase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamToken: string }> }
) {
  const { teamToken } = await params;

  // 1. Buscar config pelo token (webhookSecret no banco)
  const config = await whatsAppRepository.findConfigByWebhookSecret(teamToken);
  if (!config) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Ler body como Buffer antes de qualquer parse (HMAC precisa do raw body)
  const rawBody   = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-openwa-signature");

  // 3. Verificar HMAC — rejeitar sem processar se inválido
  const env = getValidatedEnv();
  if (!verifyOpenWaHmac(env.OPENWA_WEBHOOK_SECRET, rawBody, signature)) {
    console.error(`[OpenWaWebhookRoute][POST] HMAC inválido — teamToken: ${teamToken}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4. Parse e persistência
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 5. Processar via UseCase existente (mesmo fluxo da Evolution)
  await processWhatsAppWebhookOutboxUseCase.execute({
    teamId:  config.teamId,
    payload,
    engine:  "OPENWA",
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
```

### 5.8 Desacoplar os 3 UseCases

**Situação atual (acoplamento direto):**
```typescript
// ANTES — import concreto, impossível de trocar de engine
import { evolutionWhatsAppProvider } from "../services/whatsapp/provider/EvolutionWhatsAppProvider";
```

**Situação alvo (injeção via factory):**
```typescript
// DEPOIS — padrão aplicado nos 3 UseCases:
// MarkConversationReadUseCase, ProcessWhatsAppMediaIngestUseCase, MessageActionUseCase

import type { IWhatsAppProvider } from "../services/whatsapp/provider/IWhatsAppProvider";
import { WhatsAppEngineFactory } from "@/lib/whatsapp/WhatsAppEngineFactory";

export class MarkConversationReadUseCase {
  // Por que provider no construtor: testável com stub, não precisa de factory em teste.
  // Por que factory no execute: resolve o provider correto por teamId em runtime.
  constructor(private readonly providerOverride?: IWhatsAppProvider) {}

  async execute(ctx: TeamContext, params: MarkReadParams): Promise<Output> {
    const provider = this.providerOverride ?? await WhatsAppEngineFactory.forTeam(ctx.teamId);
    await provider.markMessagesAsRead({
      instanceName: params.instanceName,
      chatId:       params.chatId,
    });
    return new Output(true, ["Marcado como lido"], [], null);
  }
}

// Mesmo padrão para ProcessWhatsAppMediaIngestUseCase e MessageActionUseCase
```

---

## 6. Schema — alterações Prisma

```prisma
// prisma/schema.prisma

enum WhatsAppEngine {
  OPENWA
  META
}

model TeamWhatsappConfig {
  // ... campos existentes
  engine           WhatsAppEngine @default(OPENWA)
  // webhookSecret já existe — usado como teamToken na URL do webhook
}
```

Migration: `bun run db:migrate:from-prisma -- add-whatsapp-engine-enum`

---

## 7. Env vars

### Remover de `lib/env/validation.ts` e `.env.example`

```
EVO_API_BASE_URL
EVO_API_KEY
```

### Adicionar em `lib/env/validation.ts`

```typescript
OPENWA_API_URL:        z.string().url()
                         .describe("URL base do OpenWA Gateway na VPS (ex: http://openwa:3333)"),
OPENWA_API_KEY:        z.string().min(1)
                         .describe("Chave de autenticação do OpenWA Gateway (header apikey)"),
OPENWA_WEBHOOK_SECRET: z.string().min(32)
                         .describe("HMAC secret compartilhado com o Gateway para validar inbound webhook"),
```

### `.env.openwa` na VPS (novo arquivo)

```bash
PORT=3333
OPENWA_API_KEY=<gerar com openssl rand -hex 32>
OPENWA_WEBHOOK_SECRET=<mesmo valor de OPENWA_WEBHOOK_SECRET no Vercel>
SUPABASE_URL=https://wcnxwdcoambpfwxwubka.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
CHROMIUM_PATH=/usr/bin/chromium
NODE_ENV=production
```

---

## 8. Estratégia de migração das sessões ativas

### 8.1 Decisão: drop silencioso

As sessões Baileys (Evolution) e sessões whatsapp-web.js têm formatos incompatíveis — não existe migração de credenciais. Um re-scan de QR code é inevitável.

**Por que não notificar proativamente:**
- Times em loop silencioso do Evolution já estão sem WhatsApp funcional
- E-mail em massa gera confusão e tickets de suporte desnecessários
- A UI já exibe o estado "Desconectado" com o QR code — a experiência de reconexão já existe
- Times reconectam naturalmente quando abrem o módulo WhatsApp

**O que acontece:**
1. Evolution container desligado na VPS → sessões Baileys caem
2. Time abre WhatsApp no Corretor Studio → vê "Desconectado"
3. Clica em "Reconectar" → chamada `POST /api/v1/whatsapp/settings/reconnect`
4. Backend chama `OpenWaWhatsAppProvider.adoptOrCreateInstance()` → Gateway inicia sessão
5. QR code exibido → time escaneia → `CONNECTED`

### 8.2 Plano de execução (sequencial, sem janela de manutenção)

```
Passo 1: Deploy OpenWA Gateway na VPS (Evolution ainda rodando em paralelo)
  → testar com 1 time piloto (novo cadastro de sessão no OpenWA)
  → validar QR scan, envio, recebimento, mark-read

Passo 2: Deploy Corretor Studio com nova rota /openwa/ e provider
  → rota /evolution/ permanece ativa (recebe mensagens em trânsito)
  → nova rota /openwa/ ativa para times que já reconectaram

Passo 3: Após smoke test do piloto (48h sem incidentes)
  → parar container evolution_api na VPS
  → todas as sessões Evolution caem simultaneamente

Passo 4: Monitorar dashboard de reconexões
  → times reconectam organicamente nos próximos 1–5 dias úteis

Passo 5: 7 dias após parar Evolution
  → deletar rota /api/webhooks/whatsapp/evolution/ do codebase
  → remover camada evo/ (Fase E)
  → deletar projeto Supabase Evolution (kzwzgkfgynfwodjmfdli) após export de backup
```

---

## 9. Remoção da camada Evolution (Fase E — após migração validada)

Executar somente quando `COUNT(team_whatsapp_configs WHERE engine = 'OPENWA') = total_times` e Evolution container parado há ≥ 7 dias:

| Grupo | Arquivos/Pastas | Ação |
|-------|----------------|------|
| Cliente REST | `app/api/services/whatsapp/evo/` (pasta inteira) | Deletar |
| Provider | `app/api/services/whatsapp/provider/EvolutionWhatsAppProvider.ts` + `.test.ts` | Deletar |
| Webhook | `app/api/webhooks/whatsapp/evolution/` (pasta inteira) | Deletar |
| Assinatura | `lib/whatsapp/webhook-signature.ts` | Deletar |
| Auth header | `lib/whatsapp/webhook-header-auth.ts` | Verificar uso, deletar se exclusivo |
| Scripts | `scripts/resync-whatsapp-webhook-headers.ts` | Deletar |
| Env example | `.env.evolution.example` | Deletar |
| Env vars | `EVO_*` em `lib/env/validation.ts`, `.env.example`, `scripts/vps-compose.ts` | Remover |
| Supabase Evolution | Projeto `kzwzgkfgynfwodjmfdli` | Pausar → export → deletar após 30 dias |

---

## 10. Testes

| Arquivo | O que testa | Por quê |
|---------|------------|---------|
| `lib/whatsapp/openwa-hmac.test.ts` | `verifyOpenWaHmac` — válido, inválido, ausente, hex malformado | Boundary de segurança crítico |
| `openwa/OpenWaApiService.test.ts` | Todos os métodos com mock do `fetch` | Garante contrato com o Gateway |
| `provider/OpenWaWhatsAppProvider.test.ts` | Adapter com stub `IOpenWaApiService` | Desacopla teste de rede |
| `useCases/MarkConversationReadUseCase.test.ts` | Usa stub de `IWhatsAppProvider` | Valida desacoplamento |
| `webhooks/openwa/[teamToken]/route.test.ts` | HMAC válido processa; HMAC inválido retorna 401 | Rota de entrada de dados externos |

---

## 11. Checklist de PR

- [ ] `bun run typecheck` sem erros
- [ ] `bun run lint` sem erros
- [ ] `bun run governance:check` sem violações
- [ ] `bun run lint:pt-br` sem erros
- [ ] Migration `add-whatsapp-engine-enum` gerada e validada com `bun run db:migrate:reset:local`
- [ ] `openwa-hmac.ts` com testes de timing-safe comparação
- [ ] `OpenWaWhatsAppProvider` implementa todos os métodos de `IWhatsAppProvider`
- [ ] 3 UseCases desacoplados do import direto de Evolution
- [ ] Rota `/openwa/[teamToken]` retorna 401 para HMAC inválido
- [ ] Gateway buildado e rodando em Docker com Chromium
- [ ] Smoke test manual: QR scan → envio de texto → recebimento → mark-read
- [ ] `postman/Lead-Flow-API-Collection.json` atualizado (rotas de sessão OpenWA)
- [ ] `.env.example` sem referências EVO, com OPENWA vars documentadas
- [ ] `docker-compose.vps.yml` com openwa, sem evolution

---

## 12. Wireframes de Telas

Todos os wireframes seguem os padrões exatos do projeto: `Card/CardHeader/CardContent`,
`Badge`, `Button size="sm"`, `Separator`, `Alert`, `Skeleton`, `Table`, `Sheet`, `Tabs`.
Ícones: `lucide-react`. Tokens semânticos: `bg-primary`, `text-muted-foreground`, etc.

Legenda:
```
┌─ ─┐ └─ ─┘  Card / Sheet / container
│            borda vertical
━━━          Separator
[Button]     botão primário    [outline]  botão outline    [ghost]  botão ghost
[▾ Select]   select/dropdown
[░░░░]       Skeleton (loading)
●  ○         ícone preenchido / vazio (lucide)
⚠            AlertTriangle (Alert)
📶  ⊘        ícones de status de conexão
```

---

### 12.1 PRODUTO — `app/[supabaseId]/whatsapp/configuracoes/`

#### Layout geral da página

```
/[supabaseId]/whatsapp/configuracoes
─────────────────────────────────────────────────────────────────────────────
 Configurações do WhatsApp                         [📖 Como configurar ▸]
 Gerencie a conexão e as configurações do canal WhatsApp do seu time.
─────────────────────────────────────────────────────────────────────────────

 ┌── ConnectionCard ──────────────────────────────────────────────────────┐
 │  [estado varia — ver seções 12.1.A a 12.1.E abaixo]                   │
 └────────────────────────────────────────────────────────────────────────┘

 ┌── OpsSloCard ──────────────────────────────────────────────────────────┐
 │  [🕐]  SLA de Atendimento   [badge: Configurado]                       │
 │        Configure os tempos de resposta esperados do seu time.          │
 └────────────────────────────────────────────────────────────────────────┘

 ┌── TagManagerCard ──────────────────────────────────────────────────────┐
 │  [🏷]  Gerenciador de Tags                                             │
 │        Gerencie as tags usadas para classificar conversas.             │
 └────────────────────────────────────────────────────────────────────────┘
```

---

#### 12.1.A — ConnectionCard: SEM CONFIGURAÇÃO (primeira conexão)

> Exibido quando `config === null`. Gestor pode conectar, operador vê aviso.

```
 ┌── Card ────────────────────────────────────────────────────────────────┐
 │ CardHeader                                                             │
 │  ┌──────┐  WhatsApp Business   [outline: Não configurado]             │
 │  │ 💬   │  Conecte um número WhatsApp Business para enviar e          │
 │  └──────┘  receber mensagens com seus leads.                          │
 ├────────────────────────────────────────────────────────────────────────┤
 │ CardContent                                                            │
 │                                                                        │
 │            ┌──────────────────────────────────────────────┐           │
 │            │             ╭──────────────╮                 │           │
 │            │             │  ⚡  (muted) │  rounded-full   │           │
 │            │             ╰──────────────╯                 │           │
 │            │                                              │           │
 │            │         Conecte seu WhatsApp                 │           │
 │            │   Configure a integração para enviar         │           │
 │            │   mensagens e acompanhar seus leads          │           │
 │            │   diretamente pelo WhatsApp.                 │           │
 │            │                                              │           │
 │            │       [ ⚡  Conectar WhatsApp ]              │           │
 │            │                                              │           │
 │            └──────────────────────────────────────────────┘           │
 │                                                                        │
 │  ← se role = OPERATOR (sem permissão):                                 │
 │    "Apenas gestores podem configurar a integração do WhatsApp."        │
 └────────────────────────────────────────────────────────────────────────┘

 Componentes: Card, Button (default), ícone PlugZap (muted background)
 Arquivo:     ConnectionCard.tsx → bloco `!config`
 Ação:        connect() → POST /api/v1/whatsapp/settings/connect
```

---

#### 12.1.B — ConnectionCard: INITIALIZING (novo estado — boot Chrome)

> Estado novo introduzido pelo OpenWA (whatsapp-web.js leva 15–30s para iniciar
> o Chromium). `config.status === 'INITIALIZING'`.

```
 ┌── Card ────────────────────────────────────────────────────────────────┐
 │ CardHeader                                                             │
 │  ┌──────┐  WhatsApp Business   [secondary: Iniciando]   [⟳ spin]     │
 │  │ 💬   │  Conecte um número WhatsApp Business...                     │
 │  └──────┘                                                              │
 ├────────────────────────────────────────────────────────────────────────┤
 │ CardContent                                                            │
 │                                                                        │
 │  ⊘  Número não conectado                                               │
 │     Última sincronização: Nunca                                        │
 │                                                                        │
 │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
 │                                                                        │
 │  ┌─ Alert ────────────────────────────────────────────────────────┐   │
 │  │ ⚠  Iniciando motor WhatsApp. Isso pode levar até 30 segundos. │   │
 │  │    O QR Code aparecerá automaticamente quando estiver pronto.  │   │
 │  └────────────────────────────────────────────────────────────────┘   │
 │                                                                        │
 │  ┌────────────────────────────────────────────────────────────────┐   │
 │  │                                                                │   │
 │  │          [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  Skeleton 192×192    │   │
 │  │                                                                │   │
 │  │              Gerando QR Code...                                │   │
 │  └────────────────────────────────────────────────────────────────┘   │
 │                                                                        │
 │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
 │                                                                        │
 │  [ ⟳ Reconectando... ]  (disabled, isReconnecting=true)               │
 └────────────────────────────────────────────────────────────────────────┘

 Componentes: Badge(secondary), Alert(AlertTriangle), Skeleton, Button(disabled)
 Arquivo:     ConnectionCard.tsx → novo bloco `status === 'INITIALIZING'`
 Nota:        polling automático via useEffect a cada 5s enquanto INITIALIZING
              Para: quando status mudar para QR_READY ou CONNECTED
```

---

#### 12.1.C — ConnectionCard: QR_READY (escanear QR)

> `config.status === 'QR_READY'` e `config.qrCodeImageUrl` presente.

```
 ┌── Card ────────────────────────────────────────────────────────────────┐
 │ CardHeader                                                             │
 │  ┌──────┐  WhatsApp Business  [secondary: Aguardando QR]              │
 │  │ 💬   │  Conecte um número WhatsApp Business...                     │
 │  └──────┘                                                              │
 ├────────────────────────────────────────────────────────────────────────┤
 │ CardContent                                                            │
 │                                                                        │
 │  ⊘  Número não conectado                                               │
 │     Última sincronização: Nunca                                        │
 │                                                                        │
 │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
 │                                                                        │
 │          [▦] Escaneie o QR Code                                        │
 │                                                                        │
 │          ┌─────────────────────┐                                       │
 │          │ █░█ ░░█ ░░█░░ ██░░ │                                       │
 │          │ ░░░ █░█ ░█░░░ ░░█░ │                                       │
 │          │ ███ ░░░ ░░░░█ █░░█ │  192 × 192 px                         │
 │          │ ░░█ █░░ ░█░░░ ░░█░ │  border + rounded-lg                  │
 │          │ █░█ ░░█ ░░█░░ ██░░ │  bg-background                        │
 │          └─────────────────────┘                                       │
 │                                                                        │
 │   No celular: WhatsApp → Aparelhos conectados → Conectar aparelho.    │
 │   Escaneie em até 60 segundos. Se falhar, clique em Atualizar QR.     │
 │                                                                        │
 │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
 │                                                                        │
 │  [ ⟳ Atualizar QR Code ]                                              │
 └────────────────────────────────────────────────────────────────────────┘

 Componentes: Badge(secondary), img QR, Button(default size="sm")
 Arquivo:     ConnectionCard.tsx → bloco `showQrCode`
 Ação:        reconnect() → POST /api/v1/whatsapp/settings/reconnect
              (gera nova sessão no OpenWA Gateway e busca novo QR)
```

---

#### 12.1.D — ConnectionCard: CONNECTED (normal, motor OpenWA)

> `config.status === 'CONNECTED'`. Remove o Alert "Evolution API" existente.
> Adiciona badge de engine OPENWA ao lado do status.

```
 ┌── Card ────────────────────────────────────────────────────────────────┐
 │ CardHeader                                                             │
 │  ┌──────┐  WhatsApp Business                                          │
 │  │ 💬   │  [default: Conectado]  [outline: OpenWA]                   │
 │  └──────┘  Conecte um número WhatsApp Business...                     │
 ├────────────────────────────────────────────────────────────────────────┤
 │ CardContent                                                            │
 │                                                                        │
 │  📶  +55 11 99999-9999                                                 │
 │      Última sincronização: 01/08/2026 09:32                           │
 │                                                                        │
 │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
 │                                                                        │
 │  Uso do período — agosto/2026             [default: Dentro do limite] │
 │  ┌────────────────────────────────────────────────────────────────┐   │
 │  │████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  (42%)        │   │
 │  └────────────────────────────────────────────────────────────────┘   │
 │  420 mensagens enviadas                            limite: 1.000      │
 │                                                                        │
 │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
 │                                                                        │
 │  [outline ⟳ Sincronizar contatos]  [destructive 🗑 Zerar conversas]   │
 │  [destructive ⊘ Desconectar]                                          │
 │                                                                        │
 └────────────────────────────────────────────────────────────────────────┘

 Componentes: Badge(default) + Badge(outline "OpenWA"), progress bar (div h-2),
              Button(outline sm), Button(destructive sm), AlertDialog para confirm
 Arquivo:     ConnectionCard.tsx
 Alteração:   remover bloco `config.provider === 'EVOLUTION'` (Alert deprecado)
              adicionar `{config.engine && <Badge variant="outline">{config.engine}</Badge>}`
```

---

#### 12.1.E — ConnectionCard: DISCONNECTED pós-drop (sem QR ainda)

> Ocorre logo após o Evolution ser desligado na VPS. Sessão caiu, OpenWA não
> foi iniciado ainda para este time. `config.status === 'DISCONNECTED'`,
> `config.qrCodeImageUrl === null`.

```
 ┌── Card ────────────────────────────────────────────────────────────────┐
 │ CardHeader                                                             │
 │  ┌──────┐  WhatsApp Business   [secondary: Desconectado]              │
 │  │ 💬   │  Conecte um número WhatsApp Business...                     │
 │  └──────┘                                                              │
 ├────────────────────────────────────────────────────────────────────────┤
 │ CardContent                                                            │
 │                                                                        │
 │  ⊘  +55 11 99999-9999                                                  │
 │     Última sincronização: 28/07/2026 16:14                            │
 │                                                                        │
 │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
 │                                                                        │
 │  ┌─ Alert ────────────────────────────────────────────────────────┐   │
 │  │ ⚠  Conexão encerrada. Clique em Reconectar para gerar um novo  │   │
 │  │    QR Code e vincular o WhatsApp novamente.                     │   │
 │  └────────────────────────────────────────────────────────────────┘   │
 │                                                                        │
 │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
 │                                                                        │
 │  [ ⟳ Reconectar ]                                                     │
 └────────────────────────────────────────────────────────────────────────┘

 Componentes: Badge(secondary), Alert, Button(default size="sm")
 Arquivo:     ConnectionCard.tsx → bloco `isAwaitingQrAfterDisconnect`
 Ação:        reconnect() → POST /api/v1/whatsapp/settings/reconnect
              → OpenWA Gateway startSession → status muda para INITIALIZING → QR_READY
 Nota:        Não há nenhum banner global, e-mail ou notificação push.
              O time descobre o estado ao abrir esta página naturalmente.
```

---

### 12.2 BACKOFFICE — `app/backoffice/(app)/whatsapp/`

#### 12.2.A — Container principal (Tabs: Instâncias | Atualizações | Migração)

> Adicionar tab "Migração" ao `TabsList` existente. Tab antecipa painel da Spec 03.

```
/backoffice/whatsapp
─────────────────────────────────────────────────────────────────────────────
 WhatsApp                                      [ + Provisionar instância ]
 Gerencie as instâncias WhatsApp dos clientes Corretor Studio.
─────────────────────────────────────────────────────────────────────────────

 ┌──────────────────────────────────────────────────────────────────────┐
 │  [Instâncias]  [Atualizações]  [Migração]    ← nova tab              │
 └──────────────────────────────────────────────────────────────────────┘

 ┌── Filtros ──────────────────────────────────────────────────────────┐
 │  🔍 [ Buscar por master, time, telefone ou instância...      ]      │
 │     [▾ Todos os status          ]  [▾ Todos os motores  ]  ← novo   │
 └─────────────────────────────────────────────────────────────────────┘

 [tabela — ver 12.2.B]

 ─────────────────────────────────────────────────────────────────────
 34 instâncias   [▾ 20 ]  por página     |«  <  1 / 2  >  »|
 ─────────────────────────────────────────────────────────────────────

 Arquivo:     BackofficeWhatsAppInstancesContainer.tsx
 Alteração:   adicionar TabsTrigger "Migração" + TabsContent com
              <BackofficeWhatsAppMigrationContainer /> (nova)
              adicionar Select de filtro de engine (OPENWA | META | all)
```

---

#### 12.2.B — Tabela de Instâncias (coluna "Motor" adicionada)

> Nova coluna `Motor` entre `Status` e `Limite mensal`. Badge outline com engine.

```
 ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │  Master               Time            Telefone       Status               Motor    Limite   Últ.con. │
 ├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │  João Silva           Imob Alfa       (11) 9999-9999  [●  Conectado  ]    [OpenWA]   2.000  01/08    │
 │  joao@alfa.com.br                                                                                    │
 ├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │  Maria Costa          Imob Beta       (21) 8888-8888  [○  Aguard. QR ]    [OpenWA]   1.000  28/07    │
 │  maria@beta.com.br                                                                                   │
 ├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │  Pedro Gomes          Imob Gamma      (31) 7777-7777  [✕  Desconect. ]    [OpenWA]   1.000  25/07    │
 │  pedro@gamma.com.br                                                                                  │
 ├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │  Ana Lima             Imob Delta      —               [○  Pendente   ]    [OpenWA]     500  —        │
 │  ana@delta.com.br                                                                                    │
 └──────────────────────────────────────────────────────────────────────────────────────────────────── ┘
                                                                                          [⋯] por linha

 Badge de engine: Badge variant="outline" → "OpenWA" ou "Meta" (Spec 03)
 Arquivo:     BackofficeWhatsAppInstancesTable.tsx
 Alteração:   adicionar <TableHead>Motor</TableHead>
              adicionar <TableCell><Badge variant="outline">{instance.engine}</Badge></TableCell>
```

---

#### 12.2.C — Sheet de detalhe de instância (campo Engine adicionado)

> `BackofficeWhatsAppInstanceSheet` — adicionar linha "Motor" na seção de informações.

```
 ╔══════════════════════════════════════════╗
 ║ ←  Instância WhatsApp                   ║  ← SheetTitle
 ║    Detalhes e configurações              ║  ← SheetDescription
 ╠══════════════════════════════════════════╣
 ║                                          ║
 ║  Status                   [● Conectado]  ║  ← Badge por status
 ║                                          ║
 ║  Master:   João Silva (joao@alfa.com.br) ║
 ║  Time:     Imob Alfa                     ║
 ║  Motor:    OpenWA               ← novo   ║  ← texto simples ou Badge outline
 ║  Instância: imob-alfa-001                ║
 ║  Telefone: (11) 99999-9999               ║
 ║                                          ║
 ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
 ║                                          ║
 ║  Uso mensal                              ║
 ║  420 enviadas / 2.000 (21%)              ║
 ║  87 recebidas no período                 ║
 ║                                          ║
 ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
 ║                                          ║
 ║  Sincronização                           ║
 ║  Status: SYNCED                          ║
 ║  Última conexão:    01/08/2026 09:32     ║
 ║  Última desconexão: —                    ║
 ║  Último sync:       01/08/2026 09:33     ║
 ║                                          ║
 ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
 ║                                          ║
 ║  Webhook                                 ║
 ║  https://app.corretorstudio.com.br/      ║
 ║  api/webhooks/whatsapp/openwa/abc123...  ║  ← URL inclui /openwa/ (novo)
 ║                                          ║
 ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
 ║                                          ║
 ║  Limite mensal de mensagens              ║
 ║  ┌──────────────────────────┐            ║
 ║  │  2000                    │            ║
 ║  └──────────────────────────┘            ║
 ║  [☑] Cobrança habilitada                 ║
 ║                                          ║
 ╠══════════════════════════════════════════╣  ← SheetFooter (border-t)
 ║                                          ║
 ║  [outline ⟳ Reconectar]  [outline ⊘ Desconectar]  [outline ⟳ Sync]  ║
 ║                                          ║
 ║  [ Salvar alterações                  ]  ║
 ║                                          ║
 ╚══════════════════════════════════════════╝

 Arquivo:     BackofficeWhatsAppInstanceSheet.tsx
 Alteração:   adicionar linha Motor após Telefone:
              <span><span className="text-muted-foreground">Motor: </span>{selectedDetail.engine}</span>
              A URL do webhook muda de /evolution/ para /openwa/ (já reflete o novo route)
```

---

#### 12.2.D — Tab "Migração" (preview para Spec 03 — estrutura já presente)

> Nova tab `BackofficeWhatsAppMigrationContainer`. Exibe resumo de engine + status de
> migração por time. Dá visibilidade ao progresso da migração antes da Spec 03.

```
 ╔══════ Tab: Migração ═══════════════════════════════════════════════════╗
 ║                                                                        ║
 ║  Resumo de motores                                                     ║
 ║  ┌──────────────────────────────────────────────────────────────────┐ ║
 ║  │  [card]  OpenWA    34  times          [card]  Meta    0  times   │ ║
 ║  └──────────────────────────────────────────────────────────────────┘ ║
 ║                                                                        ║
 ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
 ║                                                                        ║
 ║  ┌──────────────────────────────────────────────────────────────────┐ ║
 ║  │  Time          Motor    Status migração       Iniciado em        │ ║
 ║  ├──────────────────────────────────────────────────────────────────┤ ║
 ║  │  Imob Alfa     OpenWA   [secondary: Ativo]    —                  │ ║
 ║  │  Imob Beta     OpenWA   [secondary: Ativo]    —                  │ ║
 ║  │  Imob Gamma    OpenWA   [secondary: Ativo]    —                  │ ║
 ║  └──────────────────────────────────────────────────────────────────┘ ║
 ║                                                                        ║
 ║  ┌─ Info ─────────────────────────────────────────────────────────┐   ║
 ║  │ ℹ  Migração para Meta Cloud API disponível após gate de        │   ║
 ║  │    entrada da Spec 03 (≥ 20 times pagantes + 30 dias estáveis). │   ║
 ║  └────────────────────────────────────────────────────────────────┘   ║
 ║                                                                        ║
 ╚════════════════════════════════════════════════════════════════════════╝

 Arquivo:     app/backoffice/(app)/whatsapp/features/container/
              BackofficeWhatsAppMigrationContainer.tsx  (novo)
 Rota API:    GET /api/v1/backoffice/whatsapp/migration-status
              (implementação completa na Spec 03)
```

---

#### 12.2.E — AlertDialog: Reconectar instância (pós-drop Evolution)

> Quando o operador backoffice clica em Reconectar no Sheet, o AlertDialog
> foi atualizado — remove a menção ao "Evolution" e descreve o comportamento real.

```
 ┌── AlertDialog ─────────────────────────────────────────────────────────┐
 │                                                                         │
 │  Reconectar instância?                                                  │
 │                                                                         │
 │  Uma nova sessão WhatsApp será iniciada via OpenWA Gateway.             │
 │  O cliente precisará escanear o QR Code novamente para reconectar.      │
 │  A sessão anterior será encerrada.                                      │
 │                                                                         │
 │                                  [ Cancelar ]  [ Reconectar ]          │
 │                                                                         │
 └─────────────────────────────────────────────────────────────────────────┘

 Arquivo:     BackofficeWhatsAppInstanceSheet.tsx → AlertDialogDescription
 Alteração:   atualizar texto removendo "Evolution" → mencionar "OpenWA Gateway"
```

---

### 12.3 Resumo de arquivos alterados por este wireframe

| Arquivo | Tipo de mudança |
|---------|----------------|
| `ConnectionCard.tsx` | Adicionar badge engine, novo estado INITIALIZING, remover Alert Evolution |
| `BackofficeWhatsAppInstancesContainer.tsx` | Adicionar tab Migração, Select de filtro por engine |
| `BackofficeWhatsAppInstancesTable.tsx` | Adicionar coluna Motor |
| `BackofficeWhatsAppInstanceSheet.tsx` | Adicionar linha Motor, atualizar texto do AlertDialog, URL webhook |
| `BackofficeWhatsAppMigrationContainer.tsx` | **Arquivo novo** — resumo de engines + tabela de status |
| `WhatsAppSettingsContainer.tsx` | Sem mudanças — layout permanece igual |
