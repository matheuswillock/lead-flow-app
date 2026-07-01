# Bethânia — N8N Workflows (dev local)

Automação conversacional da **Bethânia** orquestrada por N8N. Os workflows desta pasta são exports versionados para importação na UI do N8N.

## Pré-requisitos

1. Docker Desktop em execução.
2. Stack N8N ativa: `bun run n8n:up` (ou `bun run dev` com auto-start).
3. Next.js em `http://127.0.0.1:3000`.
4. Evolution API com instância dedicada **`bethania`** (`EVO_BETHANIA_INSTANCE=bethania`).
5. Arquivo `.env.n8n` (copie de `.env.n8n.example` ou deixe o `bun dev` criar).

## URLs importantes

| Serviço | URL (host) | URL (container → host) |
|---------|------------|--------------------------|
| N8N UI | `http://127.0.0.1:5678` | — |
| Lead Flow API | `http://127.0.0.1:3000` | `{{ $env.LEAD_FLOW_API_BASE_URL }}` (ver `.env.n8n`) |
| Webhook inbound Bethânia | `http://127.0.0.1:5678/webhook/bethania-inbound` | `http://host.docker.internal:5678/webhook/bethania-inbound` |
| Eventos outbound (Fase 4) | `http://127.0.0.1:5678/webhook/bethania-outbound` | — |

## Importar workflows

1. Acesse `http://127.0.0.1:5678` e faça login (primeiro acesso cria o admin).
2. **Workflows → Import from File** (ou arraste o JSON).
3. Importe, nesta ordem sugerida:

| Arquivo | Propósito |
|---------|-----------|
| `workflows/bethania-verification-channel.json` | Caminho A — e-mail → código |
| `workflows/bethania-verification-web.json` | Caminho B — `VINCULAR {OTP}` |
| `workflows/bethania-menu-main.json` | Menu principal pós-auth |
| `workflows/bethania-list-leads.json` | Listar leads |
| `workflows/bethania-agenda-today.json` | Agenda de hoje |
| `workflows/bethania-list-tasks.json` | Listar tarefas |
| `workflows/bethania-add-note-confirm.json` | Confirmação add_note (write) |
| `workflows/bethania-push-outbound.json` | Webhook outbound push (Fase 4) |
| `workflows/bethania-router.json` | Roteador inbound (Evolution → N8N) |

4. Ative o workflow **bethania-router** após configurar credenciais e variáveis.

## Evolution — instância `bethania`

Na Evolution API (stack `docker-compose.evolution.yml` — API + Redis; banco em Supabase remoto):

1. Crie ou use a instância **`bethania`** (`EVO_BETHANIA_INSTANCE`).
2. Configure o webhook da instância para:

```text
{N8N_WEBHOOK_BASE_URL}{N8N_BETHANIA_INBOUND_PATH}
```

Exemplo dev local:

```text
http://host.docker.internal:5678/webhook/bethania-inbound
```

3. O número de teste deve coincidir com `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER` (E.164, ex.: `5511999999999`).

## HMAC — chamadas N8N → Lead Flow API

Endpoints protegidos por HMAC exigem o header:

```text
x-studio-bot-signature: sha256=<hmac_hex>
```

O HMAC é `HMAC-SHA256(secret, body)` onde `secret` = `BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET` (mesmo valor em `.env.n8n` e no app).

**Placeholder nos workflows:** cada nó HTTP usa o header com valor `REPLACE_WITH_HMAC_SIGNATURE`. Antes de ativar em produção, adicione um nó **Code** que calcule a assinatura:

```javascript
const crypto = require('crypto');
const secret = $env.BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET;
const body = JSON.stringify($json.requestBody ?? {});
const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
return [{ json: { ...$json, hmacSignature: `sha256=${hash}`, requestBodyString: body } }];
```

Configure `BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET` em **Settings → Variables** do N8N (ou via `.env.n8n`).

Para `GET /api/v1/bot/context` e `GET /api/v1/bot/auth/status`, o body da assinatura é string vazia (`""`).

## Endpoints Lead Flow usados

| Workflow | Método | Endpoint |
|----------|--------|----------|
| router | GET | `/api/v1/bot/auth/status?phone=` |
| verification-channel | POST | `/api/v1/bot/auth/request-code` |
| verification-web | POST | `/api/v1/bot/auth/verify-code` |
| menu-main | GET | `/api/v1/bot/context?userLinkId=` |
| list-leads | POST | `/api/v1/bot/actions/list_leads` |
| agenda-today | POST | `/api/v1/bot/actions/agenda_today` |
| list-tasks | POST | `/api/v1/bot/actions/list_tasks` |

Base URL nos nós HTTP (container): `http://host.docker.internal:3000`

## Variáveis de ambiente

| Variável | Exemplo dev |
|----------|-------------|
| `N8N_BASE_URL` | `http://127.0.0.1:5678` |
| `N8N_WEBHOOK_BASE_URL` | `http://host.docker.internal:5678` |
| `N8N_BETHANIA_INBOUND_PATH` | `/webhook/bethania-inbound` |
| `BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET` | `leadflow-local-studio-bot-secret` |
| `EVO_BETHANIA_INSTANCE` | `bethania` |
| `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER` | número E.164 de teste |

Base URL nos nós HTTP (container): definida por `LEAD_FLOW_API_BASE_URL` em `.env.n8n` (dev: `http://host.docker.internal:3000`; produção: `https://corretorstudio.com`).

## Produção VPS (Hostinger)

Ver [`deploy/hostinger/README.md`](../deploy/hostinger/README.md).

```bash
# Na VPS após bootstrap:
bun run n8n:import:all   # importa todos os workflows Bethânia
```

| Variável | Produção |
|----------|----------|
| `LEAD_FLOW_API_BASE_URL` | `https://corretorstudio.com` |
| `N8N_WEBHOOK_BASE_URL` | `http://n8n:5678` |
| `WEBHOOK_URL` | `https://n8n.corretorstudio.com/` |

## Comandos úteis

```bash
bun run n8n:up
bun run n8n:import:all
bun run n8n:import   # importa e publica bethania-push-outbound
bun run n8n:logs
bun run n8n:down
bun run n8n:reset
bun run dev -- --skip-n8n   # dev sem N8N/Bethânia
```

## Vercel → N8N local (ngrok)

Com uma única URL reservada no ngrok free, use **um túnel por vez**:

| Comando | Domínio aponta para |
|---------|---------------------|
| `bun run ngrok` | App (`:3000`) |
| `bun run ngrok:n8n` | N8N (`:5678`) — necessário para `BACKOFFICE_N8N_OUTBOUND_URL` na Vercel |

Os scripts encerram automaticamente qualquer `ngrok` anterior (necessário no plano free com um único domínio).

Na Vercel (production/preview):

```env
BACKOFFICE_N8N_OUTBOUND_URL=https://nonzero-rodrick-mentholated.ngrok-free.dev/webhook/bethania-outbound
BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET=<mesmo valor de .env.n8n>
```

Redeploy após alterar variáveis. Com `bun run ngrok:n8n` ativo, teste em `/backoffice/studio-bot` → **Testar ping**.

## Troubleshooting

| Sintoma | Ação |
|---------|------|
| 403 Assinatura inválida | Conferir secret e body usado no HMAC |
| API inacessível do container | Usar `host.docker.internal:3000`, não `localhost` |
| Evolution não dispara N8N | Conferir `N8N_WEBHOOK_BASE_URL` e path do webhook |
| Router não responde | Workflow `bethania-router` ativo? Webhook path correto? |
