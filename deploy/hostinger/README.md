# Deploy VPS Hostinger — Evolution API + N8N (Bethânia)

Guia operacional para hospedar **Evolution API** e **N8N** na VPS KVM da Hostinger, com HTTPS em `evo.corretorstudio.com` e `n8n.corretorstudio.com`, integrado ao Lead Flow na Vercel.

## Arquitetura

```text
WhatsApp → Evolution (VPS) → N8N (VPS) → Lead Flow API (Vercel)
Lead Flow (Vercel) → N8N outbound webhook → Evolution → WhatsApp
Evolution DB → Supabase corretor-studio-evolution (sa-east-1)
N8N DB → Postgres no container (VPS)
```

## Fase 1 — Contratar VPS (hPanel)

1. **Hostinger → VPS → Criar VPS**
2. **Plano:** KVM 1 (4 GB) mínimo; **KVM 2 (8 GB)** recomendado
3. **Localização:** Brasil (São Paulo) — menor latência com Supabase `aws-1-sa-east-1`
4. **SO:** Ubuntu 24.04 **com Docker** (template Hostinger)
5. **SSH:** adicione sua chave pública
6. Anote o **IP público**

## Fase 2 — DNS (corretorstudio.com)

No painel DNS da Hostinger:

| Tipo | Nome | Valor |
|------|------|-------|
| A | `evo` | IP da VPS |
| A | `n8n` | IP da VPS |
| A | `ops` | IP da VPS |

Aguarde propagação (5–30 min). Teste: `ping evo.corretorstudio.com`

## Fase 3 — Primeiro acesso SSH

```bash
ssh root@IP_DA_VPS
```

## Fase 4 — Deploy automatizado

### Opção A — clone do repositório na VPS

```bash
apt-get update && apt-get install -y git
git clone <URL_DO_REPO> /opt/lead-flow-app
cd /opt/lead-flow-app

# Preencher secrets de produção
cp deploy/hostinger/.env.evolution.production.example /opt/lead-flow-bot/.env.evolution
cp deploy/hostinger/.env.n8n.production.example /opt/lead-flow-bot/.env.n8n
mkdir -p /opt/lead-flow-bot
nano /opt/lead-flow-bot/.env.evolution   # senha Supabase + AUTHENTICATION_API_KEY
nano /opt/lead-flow-bot/.env.n8n         # secrets + telefone Bethânia

# Gerar secrets (na VPS):
openssl rand -hex 32   # AUTHENTICATION_API_KEY, N8N_ENCRYPTION_KEY, BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET
openssl rand -hex 24   # N8N_POSTGRES_PASSWORD (= DB_POSTGRESDB_PASSWORD)

export DEPLOY_DIR=/opt/lead-flow-bot
export REPO_DIR=/opt/lead-flow-app
bash deploy/vps-bootstrap.sh
```

### Opção B — apenas arquivos essenciais (sem clone completo)

Copie do seu PC via `scp`:

```bash
scp -r docker-compose.vps.yml n8n deploy root@IP_DA_VPS:/opt/lead-flow-app/
```

Depois execute o bootstrap como na opção A.

## Painel Ops (agente VPS)

Após o bootstrap, a operação diária (env N8N/Evolution, restart, import de workflows, sync de versão) deve ser feita pelo backoffice em **Bethânia → Ops / Host** (`/backoffice/studio-bot/ops`), não por SSH.

### Bootstrap one-shot do agente

1. DNS `ops.corretorstudio.com` → IP da VPS; Caddy com bloco `ops` (ver `Caddyfile`).
2. No backoffice, **Gerar token do agente** e copiar o valor.
3. Na VPS, em `/opt/lead-flow-bot/.env` (ou export no compose): `OPS_AGENT_TOKEN=<token>`.
4. Copiar `deploy/hostinger/studio-bot-ops` para `/opt/lead-flow-bot/studio-bot-ops` (ou `bun run host:pack` + sync).
5. `docker compose -f docker-compose.vps.yml up -d --build studio-bot-ops`
6. Em Vercel Production: `BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN=<mesmo token>`
7. No painel Ops: `agentBaseUrl=https://ops.corretorstudio.com` → Salvar → Health.

### Sync de versão do host

```bash
bun run host:pack
# Upload do .tar.gz no painel Ops → Sync host version
```

O agente materializa `.env.n8n` / `.env.evolution`, recria containers e pode reimportar workflows. O HMAC CS↔N8N passa a preferir o secret do canal no Postgres (rotacionável sem redeploy Vercel).

## Fase 5 — Evolution (instância Bethânia)

1. Acesse `https://evo.corretorstudio.com/manager`
2. Crie instância **`bethania`**
3. Escaneie QR Code (número = `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER`)
4. Webhook da instância:

```text
http://n8n:5678/webhook/bethania-inbound
```

Se o manager não aceitar hostname Docker, use `http://127.0.0.1:5678/webhook/bethania-inbound`.

## Fase 6 — N8N (workflows)

```bash
cd /opt/lead-flow-bot
# Com bun instalado na VPS, ou rode n8n:import:all do repo clonado:
cd /opt/lead-flow-app && bun run n8n:import:all
```

1. Acesse `https://n8n.corretorstudio.com` — crie admin
2. Confirme `LEAD_FLOW_API_BASE_URL` em Settings → Variables (vem do `.env.n8n`)
3. Ative **`bethania-router`** por último

## Fase 7 — Vercel

Copie variáveis de [`vercel-env.production.example`](vercel-env.production.example) para o projeto na Vercel e faça **redeploy**.

Teste: backoffice → Studio Bot → **Testar ping**.

## Fase 8 — Snapshots (obrigatório)

hPanel → VPS → **Snapshots** → ativar retenção de 7 dias.

Guarde `N8N_ENCRYPTION_KEY` no gerenciador de senhas — sem ela, credenciais do N8N são irrecuperáveis.

## Comandos do dia a dia

Na VPS (`/opt/lead-flow-bot`):

```bash
# Status
docker compose -f docker-compose.vps.yml ps

# Logs
docker compose -f docker-compose.vps.yml logs -f api
docker compose -f docker-compose.vps.yml logs -f n8n

# Reiniciar Evolution
docker compose -f docker-compose.vps.yml restart api

# Atualizar imagens (janela de manutenção)
docker compose -f docker-compose.vps.yml pull
docker compose -f docker-compose.vps.yml up -d
```

No repositório local:

```bash
bun run vps:up
bun run vps:logs
bun run vps:down
```

## Troubleshooting

| Sintoma | Ação |
|---------|------|
| 502 no Caddy | `docker ps` — containers parados? |
| Evolution sem Supabase | Conferir `[PASSWORD]` em `.env.evolution` |
| Evolution não chama N8N | Rede `studio-bot-net` — use `docker-compose.vps.yml` unificado |
| Vercel ping falha | `BACKOFFICE_N8N_OUTBOUND_URL` e secret |
| QR WhatsApp falha | Atualizar `CONFIG_SESSION_PHONE_VERSION` e `restart api` |

## Arquivos deste diretório

| Arquivo | Uso |
|---------|-----|
| [`Caddyfile`](Caddyfile) | Proxy HTTPS → containers |
| [`.env.evolution.production.example`](.env.evolution.production.example) | Template Evolution na VPS |
| [`.env.n8n.production.example`](.env.n8n.production.example) | Template N8N na VPS |
| [`vercel-env.production.example`](vercel-env.production.example) | Variáveis Vercel |
| [`../vps-bootstrap.sh`](../vps-bootstrap.sh) | Script de bootstrap |
