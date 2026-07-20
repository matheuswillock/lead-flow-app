# Bethânia — N8N Workflows (dev local)

Automação conversacional da **Bethânia** orquestrada por N8N. Os workflows desta pasta são exports versionados para importação na UI do N8N.

> **Produção (VPS):** variáveis e reimport de workflows preferencialmente pelo painel **Bethânia → Ops / Host** (`deploy/hostinger/README.md` — seção Painel Ops). Evite editar `.env.n8n` na VPS manualmente após o agente estar ativo.

## Pré-requisitos

1. Docker Desktop em execução.
2. Stack N8N ativa: `bun run n8n:up` (ou `bun run dev` com auto-start).
3. Next.js em `http://127.0.0.1:3000`.
4. Evolution API com instância dedicada **`bethania`** (`EVO_BETHANIA_INSTANCE=bethania`).
5. Arquivo `.env.n8n` (copie de `.env.n8n.example` ou deixe o `bun dev` criar).

> **⚠️ n8n 2.x e `$env`:** a partir do n8n 2.0, `N8N_BLOCK_ENV_ACCESS_IN_NODE` é `true` por padrão e bloqueia `$env` em **expressões e Code nodes** — todos os workflows desta pasta dependem de `$env` e quebram com o default. O `.env.n8n` (local e VPS) precisa de `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, além de `EVO_API_BASE_URL` e `EVO_API_KEY` para o `bethania-push-outbound`. Em Code nodes que usam `require('crypto')` (HMAC do `bethania-router`), use também `NODE_FUNCTION_ALLOW_BUILTIN=crypto` e `N8N_RUNNERS_ENABLED=false` (task runners do 2.x bloqueiam `crypto` mesmo com allow-builtin). A imagem está pinada em versão explícita nos compose files — nunca volte para `latest` (foi o que derrubou a produção em 2026-07; ver `BETHANIA_AUDIT.md`). Migração futura para n8n Credentials permitirá religar o bloqueio.
>
> **Dev local:** `LEAD_FLOW_API_BASE_URL=http://host.docker.internal:3000`, `N8N_WEBHOOK_BASE_URL=http://host.docker.internal:5678`, e o webhook da Evolution na instância `bethania` **deve** ser `http://host.docker.internal:5678/webhook/bethania-inbound` (não `http://n8n:5678/...` — Evolution e N8N estão em redes Docker diferentes). O `BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET` do `.env.n8n` **deve** ser idêntico ao do `.env` do Next.js.

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
| `workflows/bethania-error-notifier.json` | Error Trigger → Slack Incoming Webhook |
| `workflows/bethania-verification-channel.json` | Caminho A — e-mail → código (stub) |
| `workflows/bethania-verification-web.json` | Caminho B — `VINCULAR {OTP}` (stub; verify ativo no inbound Next.js) |
| `workflows/bethania-menu-main.json` | Menu principal pós-auth (stub; menu ativo no inbound Next.js) |
| `workflows/bethania-list-leads.json` | Listar leads (stub) |
| `workflows/bethania-agenda-today.json` | Agenda de hoje (stub) |
| `workflows/bethania-list-tasks.json` | Listar tarefas (stub) |
| `workflows/bethania-add-note-confirm.json` | Confirmação add_note (stub) |
| `workflows/bethania-push-outbound.json` | Webhook outbound push (caminho ativo) |
| `workflows/bethania-router.json` | Roteador inbound Evolution → API (caminho ativo) |

4. Ative **bethania-error-notifier**, **bethania-router** e **bethania-push-outbound** após configurar variáveis (o `n8n:import:all` já faz isso).

> **Arquitetura atual (Estágio 5 + Caminho A):** a conversa (menu 1–5, submenu de lead, verify `VINCULAR` e **Caminho A e-mail no chat**) roda no **Corretor Studio** (`/api/webhooks/backoffice/studio-bot/inbound`). O N8N `bethania-router` é proxy Evolution→API; os JSONs `menu-main` / `list-*` / `add-note` / `verification-*` são stubs manuais até fase 2 (Credentials/HMAC).

## Evolution — instância `bethania`

Na Evolution API (stack `docker-compose.evolution.yml` — API + Redis; banco em Supabase remoto):

1. Crie ou use a instância **`bethania`** (`EVO_BETHANIA_INSTANCE`).
2. Configure o webhook da instância para:

```text
{N8N_WEBHOOK_BASE_URL}{N8N_BETHANIA_INBOUND_PATH}
```

Exemplo dev local:

```text
http://n8n:5678/webhook/bethania-inbound
```

(Evolution e N8N precisam compartilhar a rede `n8n-net` — o `docker-compose.evolution.yml` local já declara essa rede como `external`. Alternativa: `http://host.docker.internal:5678/webhook/bethania-inbound` com a porta do N8N publicada em `0.0.0.0:5678`.)

> **Sintoma local:** Evolution loga `ECONNREFUSED 169.254.1.2:5678` e o `VINCULAR` “não faz nada” — a mensagem WhatsApp chega na Evolution, mas o webhook não alcança o N8N. Corrija a URL/rede acima e reenvie o código.

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
| `BETHANIA_SLACK_WEBHOOK_URL` | URL do Incoming Webhook do Slack (alerta de falha) |
| `N8N_BASE_URL` | `http://127.0.0.1:5678` (link nas mensagens de erro) |

Base URL nos nós HTTP (container): definida por `LEAD_FLOW_API_BASE_URL` em `.env.n8n` (dev: `http://host.docker.internal:3000`; produção: `https://corretorstudio.com`).

## Observabilidade — error notifier (Estágio 4)

1. No Slack: **Apps → Incoming Webhooks → Add New Webhook to Workspace** → canal (ex.: `#bethania-alerts`) → copiar a URL.
2. Preencher `BETHANIA_SLACK_WEBHOOK_URL` em `.env.n8n` e recriar o container N8N (`bun run n8n:down && bun run n8n:up` ou restart) para o env entrar no processo.
3. Importar: `bun run n8n:import:all` (importa `bethania-error-notifier` primeiro e liga `settings.errorWorkflow` nos 9 workflows).
4. **Teste de falha (dev):** em um workflow **ativo** (ex. `bethania-push-outbound`), temporariamente quebrar a URL da Evolution no Code node / env, ou adicionar um Code node `throw new Error('teste alerta Bethânia')` no caminho feliz, salvar, ativar e disparar (ping outbox / mensagem). O `bethania-error-notifier` deve postar no Slack.
5. `bethania-push-outbound` usa `responseMode: lastNode` — falha de execução → HTTP ≠2xx → outbox marca `failed` (não `sent`).
6. **Retry outbox (Next.js):** o cron `studio-bot-outbox` reprocessa eventos `failed` com `attemptCount < 5` e `nextAttemptAt` vencido (backoff 1m/5m/15m/1h/6h). Taxa de falha ≥10% com ≥5 despachos gera alerta Sentry/`console.error` (tag `studio-bot-outbox`).
7. **Dedupe de entrega:** antes do HTTP ao N8N, o consumer grava claim atômico em `backoffice_bot_outbound_delivery` pela `idempotencyKey` (também enviada no body + header). Claim `completed` → não reenvia; falha ambígua (timeout/5xx) **mantém** o claim `processing` (reclaim só após 15min) para não duplicar WhatsApp se a Evolution já aceitou.

## Stubs N8N — não ativar

Os workflows `bethania-menu-main`, `bethania-list-*`, `bethania-agenda-today`, `bethania-add-note-confirm` e `bethania-verification-*` são **stubs**. O caminho conversacional ativo é o inbound Next.js. Ativá-los em produção com `REPLACE_WITH_HMAC_SIGNATURE` gera 401/assinatura inválida e ruído no error notifier — mantenha-os **inativos** até a fase 2 (Credentials/HMAC real).

## Runbook de validação — caminho ativo (Estágio 3)

| # | Item | Como validar (dev) | Critério / evidência |
|---|---|---|---|
| 1 | `bethania-router` | Mensagem WhatsApp → Evolution → N8N → inbound | Execução verde + resposta Bethânia |
| 2 | Verify / vínculo | Account “Gerar código” → `VINCULAR` | Vínculo ativo + confirmação WA (inbound Next.js) |
| 3 | Menu + `1`/`2`/`3` | Digitar `menu` e opções | Listas formatadas no WA (inbound Next.js) |
| 4 | `bethania-push-outbound` | Outbox `test_ping` / dispatch | Execução verde; falha forçada → `failed` + Slack |
| 5–9 | Stubs `menu-main` / `list-*` / `agenda` / `add-note` / `verification-channel` | Manual Trigger **ou** classificar stub | Smoke API adiado até fase 2 HMAC (`REPLACE_WITH_HMAC_SIGNATURE`) — não bloqueia aceite |

Preencher IDs de execução locais na seção correspondente de `BETHANIA_SPEC.md` após cada teste.

### Aplicar em produção VPS (requer autorização explícita do owner)

1. Preencher `BETHANIA_SLACK_WEBHOOK_URL` no `.env.n8n` da VPS (`/opt/lead-flow-bot/.env.n8n`).
2. Recriar/restart do container `n8n` para carregar o env.
3. `bun run n8n:import:all` (ou procedimento em `deploy/hostinger/README.md`).
4. Confirmar `errorWorkflow` nos 9 + `bethania-error-notifier` ativo.
5. Repetir a matriz de validação em produção.
6. Simular falha → mensagem no Slack.

**Não executar esses passos sem autorização explícita.**

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
| Sem alerta no Slack | `BETHANIA_SLACK_WEBHOOK_URL` no env do container? `bethania-error-notifier` ativo? Falha foi em workflow **ativo** (error workflow não dispara em todos os modos manuais)? |
| Outbox marca `sent` com push falho | Conferir `responseMode: lastNode` no `bethania-push-outbound` (não `onReceived`) |
| QR não aparece / reconnect 400 FK | Ver [Runbook Evolution — instância `bethania`](#runbook-evolution--instância-bethania) |

## Runbook Evolution — instância `bethania`

Use quando o backoffice falhar ao gerar QR (`createInstance` 400 com `Webhook_instanceId_fkey`), retornar 404 `instance does not exist`, ou o QR não aparecer após várias tentativas.

**Pré-checks de env (app / Evolution / N8N):**

- `EVO_API_BASE_URL`, `EVO_API_KEY`
- `EVO_BETHANIA_INSTANCE` (default `bethania`)
- `n8nInboundUrl` do canal no backoffice alcançável pela Evolution → N8N → `POST /api/webhooks/backoffice/studio-bot/inbound`

**Passos (operador no host Evolution — sem SQL remoto sem autorização explícita):**

1. Conferir estado via API:
   - `GET {EVO_API_BASE_URL}/instance/fetchInstances?instanceName=bethania`
   - `GET {EVO_API_BASE_URL}/instance/connectionState/bethania`
2. Se 404 ou estado inconsistente (webhook órfão / FK): apagar a instância **antes** de reconectar no backoffice:
   - `DELETE {EVO_API_BASE_URL}/instance/delete/bethania` (path conforme a versão instalada)
   - **Atenção:** `logout` sozinho **não** remove linhas de Instance/Webhook — use delete.
3. Se o DB da Evolution estiver acessível: procurar `Webhook` com `instanceId` inexistente e `IntegrationSession` ligados a `bethania`; remover residual; só então reconectar.
4. Validar que as migrations/schema da Evolution estão aplicadas (a FK `Webhook_instanceId_fkey` exige Instance existente antes do Webhook).
5. No Corretor Studio (`/backoffice/studio-bot` → Canal): clicar **Conectar** **uma vez**; aguardar o QR; não spammar reconnect.
6. Se reconnect retornar 200 sem QR: aguardar ~5s e usar **Trocar WhatsApp** / reconectar **uma** vez de novo.

**Quando o QR não aparece (fluxo curto):**

| Sintoma | Ação |
|---------|------|
| 404 instance does not exist | Delete `bethania` → reconnect uma vez |
| 400 `Webhook_instanceId_fkey` / Foreign key | Mesmo: limpar órfãos / delete → reconnect uma vez |
| 200 sem QR | Esperar 5s → Trocar WhatsApp / reconnect uma vez (não 10 cliques) |
