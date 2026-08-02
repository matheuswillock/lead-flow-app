# Spec 02 — Bethânia: Migração do Motor Evolution para OpenWA (whatsapp-web.js)

Migra a **Bethânia** (bot de plataforma do Corretor Studio) do Evolution API para o mesmo **OpenWA Gateway** da Spec 01, substituindo o cliente REST e o nó N8N de envio, mantendo toda a lógica conversacional intacta e respeitando o isolamento de módulo do backoffice.

---

## 1. Problema

### 1.1 Por que migrar a Bethânia separadamente?

A Spec 01 migra os times (produto). Mesmo após a Spec 01, o container Evolution permaneceria na VPS exclusivamente para servir a Bethânia — um número dedicado da plataforma (`OPENWA_BETHANIA_INSTANCE`). Isso:

- Impede desligar o container Evolution e eliminar seu custo e risco
- Mantém dependência dupla na VPS (OpenWA + Evolution)
- Adia o benefício de estabilidade da migração

A Bethânia é migrada nesta spec logo após a validação do smoke test da Spec 01.

### 1.2 Por que a Bethânia NÃO usa o mesmo `OpenWaApiService` do produto?

A regra de isolamento de módulo em `agents.md` é explícita: o módulo backoffice (`app/api/services/backofficeBot/`) **nunca importa** de módulos de produto (`app/api/services/whatsapp/`). Isso garante que o backoffice possa ser extraído para um microserviço futuro sem arrastar dependências de produto.

Portanto, a Bethânia terá seu próprio `BackofficeOpenWaApiService` — uma cópia deliberada e isolada do cliente, não um reuso.

### 1.3 O que NÃO muda

| Componente | Motivo para não mudar |
|-----------|----------------------|
| `BotPolicyService` | Lógica de negócio, independente do motor |
| `BackofficeBotAuthService` | Autenticação por e-mail/código, independente |
| `BackofficeBotInboundWebhookUseCase` | Processa payload normalizado, independente do motor |
| `StudioBotOutboxService` | Pipeline de outbox, independente |
| `StudioBotN8nDispatchService` | Envia para N8N via HTTP, independente |
| 9 dos 10 workflows N8N | Lógica conversacional pura, sem chamadas ao motor |
| Autenticação Bethânia (código → UserLink) | Fluxo de auth da plataforma |
| AI Bethânia (Groq, shadow mode, circuit breaker) | AI pipeline independente |
| HSM templates (`bethania_auth_code`, `bethania_meeting_reminder`) | Templates da Bethânia |

---

## 2. O que muda — mapa completo

| Área | Arquivo | Mudança |
|------|---------|---------|
| Cliente REST Evolution | `app/api/services/backofficeBot/evo/BackofficeEvoApiService.ts` | Criar equivalente OpenWA, depois deletar |
| Mapeamento de erros | `app/api/services/backofficeBot/evo/mapEvoChannelError.ts` | Criar equivalente OpenWA, depois deletar |
| Resolução de credentials | `lib/studio-bot/resolve-host-secrets.ts` | Adicionar `resolveOpenWaConfig()`, manter `resolveEvoApiConfig()` até deleção |
| Env keys VPS/N8N | `lib/studio-bot/host-env.ts` | Substituir EVO keys por OPENWA keys |
| Workflow de envio | `n8n/workflows/bethania-push-outbound.json` | Substituir nó "Evolution API" |
| Workflow de roteamento | `n8n/workflows/bethania-router.json` | Verificar compatibilidade (nenhuma mudança esperada) |
| Env exemplo N8N | `deploy/hostinger/.env.n8n.production.example` | Atualizar vars |
| Painel Ops backoffice | `app/backoffice/(app)/studio-bot/ops/` | Exibir status da instância Bethânia via OpenWA |

---

## 3. Arquitetura

### 3.1 Fluxo atual (Evolution)

```
Inbound:
  WhatsApp (Bethânia) → Evolution webhook push → bethania-router.json (N8N)
  → POST /api/webhooks/backoffice/studio-bot/inbound → BackofficeBotInboundWebhookUseCase

Outbound:
  Cron /api/v1/notifications/cron/studio-bot-outbox
  → StudioBotOutboxService → StudioBotN8nDispatchService
  → POST N8N bethania-push-outbound
  → [nó "Evolution API"] → EVO_API_BASE_URL/message/sendText/{instance}
  → Evolution → WhatsApp
```

### 3.2 Fluxo após migração (OpenWA)

```
Inbound:
  WhatsApp (Bethânia) → OpenWA Gateway webhook push → bethania-router.json (N8N)
  → POST /api/webhooks/backoffice/studio-bot/inbound → BackofficeBotInboundWebhookUseCase
  (payload whatsapp-web.js é compatível com a estrutura que o router espera)

Outbound:
  Cron /api/v1/notifications/cron/studio-bot-outbox
  → StudioBotOutboxService → StudioBotN8nDispatchService
  → POST N8N bethania-push-outbound
  → [nó "OpenWA API"] → OPENWA_API_URL/client/sendMessage/{instance}
  → OpenWA Gateway → whatsapp-web.js → WhatsApp
```

**A troca é cirúrgica**: apenas o nó de envio no workflow N8N e o cliente REST no backoffice mudam.

### 3.3 Isolamento de módulos (invariante)

```
┌─────────────────────────────────────────┐
│  Módulo Produto                         │
│  app/api/services/whatsapp/openwa/      │
│    OpenWaApiService.ts      ← produto   │
└─────────────────────────────────────────┘
        ×  (nunca importa entre módulos)
┌─────────────────────────────────────────┐
│  Módulo Backoffice                      │
│  app/api/services/backofficeBot/openwa/ │
│    BackofficeOpenWaApiService.ts ← bot  │
└─────────────────────────────────────────┘
```

Ambos chamam o mesmo OpenWA Gateway na VPS, mas via clientes HTTP independentes com suas próprias credenciais (mesma `OPENWA_API_KEY` ou keys separadas por segurança).

---

## 4. Implementação

### 4.1 `IBackofficeOpenWaApiService.ts` — interface do cliente

```typescript
// app/api/services/backofficeBot/openwa/IBackofficeOpenWaApiService.ts
// Por que: permite testar BackofficeBotOutboxService com stub sem subir o Gateway.
// Onde: importado por BackofficeOpenWaApiService e pelos testes do módulo.

export interface IBackofficeOpenWaApiService {
  sendText(instanceName: string, to: string, text: string): Promise<void>;
  getInstanceStatus(instanceName: string): Promise<BackofficeOpenWaStatus>;
  connectInstance(instanceName: string, webhookUrl: string): Promise<{ qrCode?: string }>;
  disconnectInstance(instanceName: string): Promise<void>;
}

export type BackofficeOpenWaStatus =
  | "INITIALIZING"
  | "QR_READY"
  | "CONNECTED"
  | "DISCONNECTED";
```

### 4.2 `BackofficeOpenWaApiService.ts` — cliente isolado

```typescript
// app/api/services/backofficeBot/openwa/BackofficeOpenWaApiService.ts
// Por que: cliente isolado no módulo backoffice — não importa nada de produto.
// Como: idêntico em estrutura ao OpenWaApiService do produto, mas instância separada.
//       Resolve credentials via resolveOpenWaConfig() para suportar configuração
//       dinâmica (Supabase) além de env vars diretas.
// Onde: instanciado como singleton, injetado em StudioBotOutboxService ou equivalente.

import type { IBackofficeOpenWaApiService, BackofficeOpenWaStatus } from "./IBackofficeOpenWaApiService";
import { resolveOpenWaConfig } from "@/lib/studio-bot/resolve-host-secrets";
import { mapOpenWaChannelError } from "./mapOpenWaChannelError";

export class BackofficeOpenWaApiService implements IBackofficeOpenWaApiService {
  private async getConfig() {
    return resolveOpenWaConfig();
  }

  private async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    const { baseUrl, apiKey } = await this.getConfig();
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      const errorMsg  = mapOpenWaChannelError(res.status, errorText);
      throw new Error(`[BackofficeOpenWaApiService] ${method} ${path} → ${errorMsg}`);
    }
    return res.json() as Promise<T>;
  }

  async sendText(instanceName: string, to: string, text: string): Promise<void> {
    await this.request(`/client/sendMessage/${instanceName}`, "POST", { to, text });
  }

  async getInstanceStatus(instanceName: string): Promise<BackofficeOpenWaStatus> {
    const data = await this.request<{ status: string }>(
      `/session/status/${instanceName}`,
      "GET"
    );
    return (data.status as BackofficeOpenWaStatus) ?? "DISCONNECTED";
  }

  async connectInstance(
    instanceName: string,
    webhookUrl: string
  ): Promise<{ qrCode?: string }> {
    const data = await this.request<{ status: string; qr?: string }>(
      `/session/start/${instanceName}`,
      "POST",
      { webhookUrl }
    );
    return { qrCode: data.qr };
  }

  async disconnectInstance(instanceName: string): Promise<void> {
    await this.request(`/session/delete/${instanceName}`, "DELETE");
  }
}

export const backofficeOpenWaApiService = new BackofficeOpenWaApiService();
```

### 4.3 `mapOpenWaChannelError.ts`

```typescript
// app/api/services/backofficeBot/openwa/mapOpenWaChannelError.ts
// Por que: centraliza mensagens de erro do Gateway para fácil manutenção e i18n.
// Onde: importado por BackofficeOpenWaApiService para enriquecer erros lançados.

export function mapOpenWaChannelError(status: number, body: unknown): string {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  switch (status) {
    case 400: return `Requisição inválida — número fora do formato E164 ou parâmetro ausente: ${bodyStr}`;
    case 401: return "API key inválida — verificar OPENWA_API_KEY na VPS e no Vercel";
    case 404: return "Instância não encontrada no Gateway — verificar OPENWA_BETHANIA_INSTANCE";
    case 429: return "Rate limit atingido — aguardar antes de tentar novamente";
    case 503: return "OpenWA Gateway indisponível — verificar container na VPS";
    default:
      if (status >= 500) return `Erro interno do OpenWA Gateway (${status}): ${bodyStr}`;
      return `Erro desconhecido (${status}): ${bodyStr}`;
  }
}
```

### 4.4 `resolve-host-secrets.ts` — adicionar `resolveOpenWaConfig()`

```typescript
// lib/studio-bot/resolve-host-secrets.ts — ADICIONAR esta função
// Por que: centraliza a resolução de credenciais do OpenWA para o módulo bot.
//          Tenta env vars primeiro (produção Vercel), fallback para BackofficeBotHostSettings
//          (painel Ops do backoffice) para suportar configuração dinâmica sem redeploy.
// Onde: chamado por BackofficeOpenWaApiService.getConfig().

export async function resolveOpenWaConfig(): Promise<{ baseUrl: string; apiKey: string }> {
  // Caminho 1: env vars diretas (Vercel prod / VPS dev)
  const baseUrl = process.env.OPENWA_API_URL?.trim();
  const apiKey  = process.env.OPENWA_API_KEY?.trim();

  if (baseUrl && apiKey) {
    return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
  }

  // Caminho 2: configuração persistida no Supabase via painel Ops
  // Por que fallback: permite trocar URL/key sem redeploy do Vercel
  const settings = await getHostSettings(); // função existente no arquivo
  if (!settings?.openwaApiUrl || !settings?.openwaApiKey) {
    throw new Error(
      "[resolveOpenWaConfig] OPENWA_API_URL e OPENWA_API_KEY não configurados " +
      "— defina nas env vars do Vercel ou no painel Ops do backoffice"
    );
  }

  return {
    baseUrl: settings.openwaApiUrl.replace(/\/$/, ""),
    apiKey:  settings.openwaApiKey,
  };
}
```

### 4.5 `host-env.ts` — atualizar keys

```typescript
// lib/studio-bot/host-env.ts
// Por que: N8N_HOST_ENV_KEYS define quais env vars do host são passadas para os
//          workflows N8N via API do N8N. Substituir EVO_ por OPENWA_ para que o
//          workflow bethania-push-outbound acesse as novas variáveis.

export const N8N_HOST_ENV_KEYS = [
  "LEAD_FLOW_API_BASE_URL",
  "N8N_WEBHOOK_BASE_URL",
  "BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET",
  "OPENWA_API_URL",            // era: EVO_API_BASE_URL
  "OPENWA_API_KEY",            // era: EVO_API_KEY
  "OPENWA_BETHANIA_INSTANCE",  // era: EVO_BETHANIA_INSTANCE
  "BACKOFFICE_BETHANIA_WHATSAPP_NUMBER",
  "N8N_BLOCK_ENV_ACCESS_IN_NODE",
  "NODE_FUNCTION_ALLOW_BUILTIN",
  "N8N_RUNNERS_ENABLED",
  "BETHANIA_SLACK_WEBHOOK_URL",
] as const;

// REMOVER completamente (não existe mais após esta spec):
// export const EVOLUTION_HOST_ENV_KEYS = [...]
```

---

## 5. N8N — Atualização dos Workflows

### 5.1 `bethania-push-outbound.json` — único nó a mudar

**Por que apenas este workflow muda:**
- `bethania-router.json`: roteia com base no campo `instance` do payload — o OpenWA envia a mesma estrutura de evento (campo `instance`, `event`, `data`). Compatível. Nenhuma alteração.
- Os outros 8 workflows (menu, agenda, leads, tasks, notas, auth, error-notifier): processam dados de negócio retornados pela API do Corretor Studio — não chamam o motor WhatsApp diretamente.

**Nó a substituir em `bethania-push-outbound.json`:**

```json
// REMOVER este nó:
{
  "name": "Evolution API",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "={{ $env.EVO_API_BASE_URL }}/message/sendText/{{ $env.EVO_BETHANIA_INSTANCE }}",
    ...
  }
}

// ADICIONAR este nó (mesmo tipo, URL atualizada):
{
  "name": "OpenWA API",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "parameters": {
    "method": "POST",
    "url": "={{ $env.OPENWA_API_URL }}/client/sendMessage/{{ $env.OPENWA_BETHANIA_INSTANCE }}",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "options": {},
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "={{ $env.OPENWA_API_KEY }}"
        }
      ]
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "to",
          "value": "={{ $json.normalizedPhone }}"
        },
        {
          "name": "text",
          "value": "={{ $json.message }}"
        }
      ]
    }
  }
}
```

**Por que `$json.normalizedPhone` e `$json.message`**: o nó anterior ao "OpenWA API" no workflow é um nó de normalização que já produz esses campos. Não mudar o mapeamento de dados — apenas a URL e autenticação.

### 5.2 `bethania-router.json` — verificação de compatibilidade

O OpenWA Gateway (whatsapp-web.js) emite eventos neste formato:

```json
{
  "instance": "bethania",
  "event": "message",
  "data": {
    "id": { "_serialized": "true_5511999999999@c.us_XXXX" },
    "from": "5511999999999@c.us",
    "to": "5511988888888@c.us",
    "body": "Olá",
    "timestamp": 1720000000,
    "type": "chat"
  },
  "timestamp": 1720000000
}
```

O Evolution emitia estrutura similar via Baileys. O nó `"Normalize And Sign"` do router extrai `data.from` e `data.body` — campos presentes no payload do whatsapp-web.js. **Compatível. Nenhuma alteração no router.**

**Confirmação obrigatória antes do go-live**: comparar payload real do OpenWA contra o esperado pelo router em ambiente de staging.

---

## 6. Env vars

### 6.1 Remover

```bash
# VPS: .env.n8n
EVO_API_BASE_URL
EVO_API_KEY
EVO_BETHANIA_INSTANCE

# Vercel / lib/env/validation.ts (se adicionadas na Spec 01):
# EVO_* já foram removidas na Spec 01
```

### 6.2 Adicionar (reusar da Spec 01, verificar presença)

```typescript
// lib/env/validation.ts — confirmar que já existem da Spec 01:
OPENWA_API_URL:           z.string().url(),
OPENWA_API_KEY:           z.string().min(1),
OPENWA_WEBHOOK_SECRET:    z.string().min(32),
```

### 6.3 Nova var para Bethânia

```typescript
// lib/env/validation.ts — adicionar se ainda não existir:
OPENWA_BETHANIA_INSTANCE: z.string().min(1)
                            .describe("Nome da instância da Bethânia no OpenWA Gateway"),
```

### 6.4 `.env.n8n.production.example` — atualizar

```bash
# REMOVER:
EVO_API_BASE_URL=http://evolution_api:8080
EVO_API_KEY=<AUTHENTICATION_API_KEY do container evolution>
EVO_BETHANIA_INSTANCE=bethania

# ADICIONAR:
OPENWA_API_URL=http://openwa:3333
OPENWA_API_KEY=<mesmo valor de OPENWA_API_KEY do Vercel>
OPENWA_BETHANIA_INSTANCE=bethania
```

---

## 7. Painel Ops — atualizar status da instância Bethânia

```
app/backoffice/(app)/studio-bot/ops/
```

O painel Ops atual exibe status da instância Bethânia chamando o endpoint de status do Evolution. Atualizar para chamar:

```typescript
// app/api/v1/backoffice/studio-bot/ops/instance-status/route.ts
// PATCH: trocar chamada de BackofficeEvoApiService.getInstanceStatus()
//        para BackofficeOpenWaApiService.getInstanceStatus()

const status = await backofficeOpenWaApiService.getInstanceStatus(
  process.env.OPENWA_BETHANIA_INSTANCE!
);
// Retornar: { status: "CONNECTED" | "QR_READY" | "DISCONNECTED" | "INITIALIZING" }
```

O frontend do painel já mapeia os estados de string para badges — confirmar que os novos valores (`INITIALIZING`, `QR_READY`, `CONNECTED`, `DISCONNECTED`) são tratados pelo componente de status.

---

## 8. Instância da Bethânia no OpenWA Gateway

### 8.1 Como registrar a instância Bethânia

A Bethânia tem um número dedicado da plataforma (diferente dos números dos times). A instância precisa ser iniciada manualmente uma vez:

```bash
# Via curl na VPS (autenticado com OPENWA_API_KEY):
curl -X POST http://localhost:3333/session/start/bethania \
  -H "apikey: <OPENWA_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://app.corretorstudio.com.br/api/webhooks/backoffice/studio-bot/inbound"}'

# Resposta: { "status": "starting", "instance": "bethania" }
# Próximo evento via webhook: qr → escanear com o número da Bethânia
```

### 8.2 Persistência via RemoteAuth

Após o primeiro scan, a sessão é salva no Supabase (bucket `openwa-sessions`). Restarts do container não exigem novo QR scan. A instância `bethania` reinicia automaticamente ao subir o container.

### 8.3 Inicialização automática (opcional)

O `SessionManager` pode ser configurado para iniciar instâncias persistidas automaticamente no boot:

```typescript
// deploy/openwa-gateway/src/index.ts
// Ao iniciar, verificar quais sessões existem no Supabase e reiniciá-las
const store = new SupabaseRemoteAuthStore();
const knownInstances = await store.listSessions(); // implementar listagem do bucket
for (const instanceName of knownInstances) {
  const webhookUrl = await getWebhookUrlFromDb(instanceName); // armazenar no schema openwa
  await sessionManager.startSession(instanceName, webhookUrl);
}
```

---

## 9. Remoção pós-migração

Após validar que a Bethânia envia e recebe mensagens via OpenWA sem erros por ≥ 48h:

| Arquivo | Ação |
|---------|------|
| `app/api/services/backofficeBot/evo/BackofficeEvoApiService.ts` | Deletar |
| `app/api/services/backofficeBot/evo/mapEvoChannelError.ts` | Deletar |
| `app/api/services/backofficeBot/evo/mapEvoChannelError.test.ts` | Deletar |
| `lib/studio-bot/resolve-host-secrets.ts` → `resolveEvoApiConfig()` | Remover função |
| `EVOLUTION_HOST_ENV_KEYS` (se ainda existir em `host-env.ts`) | Remover |
| Container Evolution na VPS | Parar (se Spec 01 também validada) |

---

## 10. Testes

| Arquivo | O que testa | Por quê |
|---------|------------|---------|
| `backofficeBot/openwa/BackofficeOpenWaApiService.test.ts` | `sendText`, `getInstanceStatus`, `connectInstance` com mock fetch | Garante isolamento — não importa de produto |
| `backofficeBot/openwa/mapOpenWaChannelError.test.ts` | Todos os status codes mapeados | Erros legíveis em prod são essenciais |
| `studio-bot/resolve-host-secrets.test.ts` | `resolveOpenWaConfig` — env vars presentes vs ausentes | Fallback para Supabase sem env vars |
| Governance check | `bun run governance:check` | Verifica que backofficeBot não importa de whatsapp/ |

---

## 11. Checklist de PR

- [ ] `bun run typecheck` sem erros
- [ ] `bun run lint` sem erros
- [ ] `bun run governance:check` — nenhum import cruzado backoffice ↔ produto
- [ ] `bun run lint:pt-br` sem erros
- [ ] `BackofficeOpenWaApiService` não importa nada de `app/api/services/whatsapp/`
- [ ] `resolveOpenWaConfig()` adicionada sem remover `resolveEvoApiConfig()` (remoção só após validação)
- [ ] `EVOLUTION_HOST_ENV_KEYS` removida de `host-env.ts`
- [ ] N8N workflow `bethania-push-outbound.json` atualizado no repositório
- [ ] Workflow importado no N8N de produção via UI ou API
- [ ] Instância `bethania` criada no OpenWA Gateway e QR escaneado
- [ ] Smoke test: enviar mensagem pela Bethânia → receber no WhatsApp físico
- [ ] Smoke test: receber mensagem → processar inbound → resposta automática
- [ ] Painel Ops exibe `CONNECTED` para instância Bethânia via OpenWA
- [ ] `.env.n8n.production.example` atualizado
