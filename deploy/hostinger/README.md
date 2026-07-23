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

## Runbook produção Bethânia (requer autorização explícita do owner)

**Não executar VPS/remoto sem autorização.** Preferir o painel **Bethânia → Ops / Host** como fonte da verdade.

### 1. Secrets alinhados

| Segredo | Onde |
|---|---|
| `BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET` | Vercel Production ↔ Host Settings / `.env.n8n` (idêntico) |
| `BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN` / `OPS_AGENT_TOKEN` | Vercel ↔ VPS agente |
| `BETHANIA_SLACK_WEBHOOK_URL` | `.env.n8n` (Incoming Webhook Slack) |
| `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER` + `NEXT_PUBLIC_BETHANIA_WHATSAPP_NUMBER` | Vercel + env bot |

Após salvar/aplicar env pelo painel, rode **Ops / Host → Health**. O payload deve trazer `bethaniaProductionCheck.ok=true`; esse check valida envs obrigatórias, imagem pinada e estado esperado dos workflows sem revelar valores de segredo.

### 2. Canal WhatsApp

1. Backoffice → Canal Bethânia → QR / status `connected`
2. Evolution webhook → `…/webhook/bethania-inbound`
3. Número público bate com as envs acima

### 3. Workflows

Via Ops “Reimportar workflows” (ou `bun run n8n:import:all` com auth):

- **Ativos:** `bethania-router`, `bethania-push-outbound`, `bethania-error-notifier`
- **Inativos:** stubs `menu-main` / `list-*` / `verification-*` / `add-note`
- Evidência: **Ops / Host → Health** com `bethaniaProductionCheck.workflows[*].ok=true`

### 4. Matriz e2e (Estágio 3 em prod)

1. Mensagem WA → router → inbound 200
2. Account → Gerar código → `VINCULAR` (toast com `ref:` em falha)
3. Menu `1`/`2`/`3` no WhatsApp
4. Push outbox happy path; forçar falha → Slack + outbox `failed` (retry automático no cron)
5. Aceite 24h: overview N8N sem falha sistêmica no caminho feliz

Registrar evidências na PR/deploy note: timestamp, usuário/telefone de teste, execution IDs do N8N, job ID do Ops health, mensagem Slack de falha forçada e horário inicial/final da janela de 24h.

### 5. HSM Meta

Aprovar no WhatsApp Manager os templates em `lib/studio-bot/hsm.ts` (`bethania_meeting_reminder`, `bethania_auth_code`). Validar push fora da janela 24h não some sem template.

## Upgrade n8n — política obrigatória

O n8n fica pinado em `docker.io/n8nio/n8n:2.28.5`. Para subir versão:

1. Abrir PR específico com a nova tag explícita (nunca `latest`).
2. Anexar changelog review da versão alvo, com foco em `$env`, task runners, Code nodes, webhooks e CLI `import/update/publish`.
3. Rodar import local (`bun run n8n:import:all`) e confirmar stubs inativos.
4. Aplicar em produção via Ops / Host, rodar Health e exigir `bethaniaProductionCheck.ok=true`.
5. Repetir matriz e2e e iniciar janela de 24h sem falha sistêmica no overview.

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

## GitHub Actions — self-hosted runner (CI sem minutos hosted)

A VPS Hostinger (KVM 2) hospeda até **2** GitHub Actions runners do repositório `lead-flow-app` (mesmo label pool). Os workflows usam:

```yaml
runs-on: [self-hosted, linux, x64, lead-flow-ci]
```

Isso mantém orquestração/logs/secrets no GitHub, mas a CPU/RAM do job é da VPS — **não consome minutos `ubuntu-latest` do plano**. Com 2 runners, até **2 jobs em paralelo** (ex.: Build + Lint).

### Por que não Jenkins

O corte de minutos vem de sair do runner hosted. Jenkins faria o mesmo com mais manutenção (JVM, plugins, reescrever pipelines). Neste projeto o self-hosted do GitHub Actions é suficiente.

### Instalação (SSH, root)

Na VPS (`187.77.226.253` / `srv1799450.hstgr.cloud`), com o script em `/opt/lead-flow-app`:

```bash
# No seu PC (gh autenticado) — um token por registro:
TOKEN=$(gh api -X POST repos/matheuswillock/lead-flow-app/actions/runners/registration-token --jq .token)

# Runner 1
scp deploy/hostinger/bootstrap-github-runner.sh root@187.77.226.253:/opt/lead-flow-app/deploy/hostinger/
ssh root@187.77.226.253 'export RUNNER_TOKEN='"$TOKEN"'; bash /opt/lead-flow-app/deploy/hostinger/bootstrap-github-runner.sh'

# Runner 2 (novo token)
TOKEN=$(gh api -X POST repos/matheuswillock/lead-flow-app/actions/runners/registration-token --jq .token)
ssh root@187.77.226.253 'export RUNNER_INDEX=2 RUNNER_TOKEN='"$TOKEN"' SKIP_HOST_DEPS=1; bash /opt/lead-flow-app/deploy/hostinger/bootstrap-github-runner.sh'
```

O script [`bootstrap-github-runner.sh`](bootstrap-github-runner.sh):

- `RUNNER_INDEX=1|2` (máx. 2) → users `github-runner` / `github-runner-2`, nomes `lead-flow-vps-1` / `lead-flow-vps-2`
- mesma label pool: `self-hosted,linux,x64,lead-flow-ci`
- systemd separado por runner + `NODE_OPTIONS=--max-old-space-size=2560`
- limpeza diária idle-only em **ambos** `_work` via `/usr/local/sbin/github-runner-cleanup.sh`
- **não** dá acesso a `/opt/lead-flow-bot/.env*`

### Isolamento de PRs (`ci-main.yml`)

Jobs disparados por `pull_request` → `main` rodam em **`ubuntu-latest`** (hosted).  
Só `push` em `main` usa o runner persistente da VPS. Assim código de PR não executa no agente long-lived (evita persistir alterações no worker/`_work` entre jobs).

### Saúde

```bash
systemctl status 'actions.runner.*'
# GitHub → Settings → Actions → Runners → lead-flow-vps-1 e lead-flow-vps-2 = Idle / Online
```

### Remover / re-registrar

```bash
# Ex.: runner 2
cd /home/github-runner-2/actions-runner
sudo ./svc.sh stop
sudo ./svc.sh uninstall
sudo -u github-runner-2 ./config.sh remove --token "$(gh api -X POST repos/matheuswillock/lead-flow-app/actions/runners/remove-token --jq .token)"
# depois rode bootstrap com RUNNER_INDEX=2 e novo RUNNER_TOKEN
```

### Recursos

| Item | Valor |
|------|--------|
| Jobs em paralelo | até **2** (dois runners) |
| `next build` | **máx. 1** via `concurrency.group: lead-flow-next-build` (Build + Lint ok) |
| Stack compartilhada | Evolution + n8n + ops |
| RAM recomendada | KVM 2 (8 GB) |
| Heap Node por runner | `2560` MB |
| Se OOM no `next build` | baixar heap, ou temporariamente voltar só o job `build` para `ubuntu-latest` |

## Troubleshooting

| Sintoma | Ação |
|---------|------|
| 502 no Caddy | `docker ps` — containers parados? |
| Evolution sem Supabase | Conferir `[PASSWORD]` em `.env.evolution` |
| Evolution não chama N8N | Rede `studio-bot-net` — use `docker-compose.vps.yml` unificado |
| Vercel ping falha | `BACKOFFICE_N8N_OUTBOUND_URL` e secret |
| QR WhatsApp falha | Atualizar `CONFIG_SESSION_PHONE_VERSION` e `restart api` |
| CI queued / runner Offline | `systemctl status 'actions.runner.*'` e reiniciar; conferir Idle no GitHub |
| OOM no build Next | `free -h` durante o job; reduzir `NODE_OPTIONS` ou upgrade de RAM |

## Arquivos deste diretório

| Arquivo | Uso |
|---------|-----|
| [`Caddyfile`](Caddyfile) | Proxy HTTPS → containers |
| [`.env.evolution.production.example`](.env.evolution.production.example) | Template Evolution na VPS |
| [`.env.n8n.production.example`](.env.n8n.production.example) | Template N8N na VPS |
| [`vercel-env.production.example`](vercel-env.production.example) | Variáveis Vercel |
| [`bootstrap-github-runner.sh`](bootstrap-github-runner.sh) | Instala self-hosted runner (CI) |
| [`../vps-bootstrap.sh`](../vps-bootstrap.sh) | Script de bootstrap da stack Bethânia |
