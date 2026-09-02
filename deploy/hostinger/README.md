# Deploy VPS Hostinger — OpenWA Gateway + Agente Ops

Guia operacional da VPS KVM da Hostinger. A stack versionada em
[`docker-compose.vps.yml`](../../docker-compose.vps.yml) tem **dois** serviços:

| Serviço | O que é | Exposição |
|---|---|---|
| `openwa` | Gateway WhatsApp do produto (`deploy/openwa-gateway`) | interno, `:3333` na rede `studio-bot-net` |
| `studio-bot-ops` | Agente HTTP de operação, consumido pelo backoffice | `127.0.0.1:9090` → Caddy em `ops.corretorstudio.com` |

A mesma VPS hospeda os self-hosted runners do CI (ver [GitHub Actions](#github-actions--self-hosted-runner-ci-sem-minutos-hosted)).

## N8N e Evolution saíram desta VPS

Os serviços `n8n`, `n8n-postgres` e a Evolution API foram removidos do compose, e
os blocos `n8n.corretorstudio.com` / `evo.corretorstudio.com` saíram do
[`Caddyfile`](Caddyfile). Os picos de CPU/RAM do n8n disputavam recurso com o job
`CI Light (VPS)`.

**Consequência em aberto:** o pipeline de notificações da Bethânia
(`StudioBotN8nDispatchService` → `BACKOFFICE_N8N_OUTBOUND_URL`) e a verificação de
canal por Evolution (`backofficeBot/evo`) apontam para hosts que não existem mais.
O código foi mantido intacto, aguardando a Spec 02 (Bethânia → OpenWA), que
precisa escrever o substituto de dispatch antes de reativar o fluxo.

## Fase 1 — Contratar VPS (hPanel)

1. **Hostinger → VPS → Criar VPS**
2. **Plano:** **KVM 2 (8 GB)** — a VPS também roda os runners do CI
3. **Localização:** Brasil (São Paulo)
4. **SO:** Ubuntu 24.04 **com Docker** (template Hostinger)
5. **SSH:** adicione sua chave pública
6. Anote o **IP público**

## Fase 2 — DNS (corretorstudio.com)

No painel DNS da Hostinger:

| Tipo | Nome | Valor |
|------|------|-------|
| A | `ops` | IP da VPS |

Aguarde propagação (5–30 min). Teste: `ping ops.corretorstudio.com`

### Lacuna conhecida: o `openwa` não tem rota pública

O serviço `openwa` tem só `expose: 3333` no compose (sem `ports`) e não tem bloco
no Caddyfile — ou seja, hoje ele só é alcançável de dentro de `studio-bot-net`.

O app roda na **Vercel**, fora dessa rede. `OPENWA_API_URL=http://openwa:3333`
funciona para um cliente dentro do compose, mas **não** para a Vercel: o
hostname não resolve e sessão, QR e envio de mensagem do produto falham.

Antes de apontar a Vercel para o gateway é preciso escolher o caminho de acesso
(bloco Caddy com autenticação, túnel privado, ou o que a Spec 01 definir) e
implementá-lo. Ver [CUTOVER-CHECKLIST](../openwa-gateway/docs/CUTOVER-CHECKLIST.md).

## Fase 3 — Primeiro acesso SSH

```bash
ssh root@IP_DA_VPS
```

## Fase 4 — Deploy automatizado

```bash
apt-get update && apt-get install -y git
git clone <URL_DO_REPO> /opt/lead-flow-app
cd /opt/lead-flow-app

mkdir -p /opt/lead-flow-bot
cp .env.openwa.example /opt/lead-flow-bot/.env.openwa
nano /opt/lead-flow-bot/.env.openwa   # API key, webhook secret, chaves Supabase

# Gerar secrets (na VPS):
openssl rand -hex 32   # OPENWA_API_KEY, OPENWA_WEBHOOK_SECRET

export DEPLOY_DIR=/opt/lead-flow-bot
export REPO_DIR=/opt/lead-flow-app
bash deploy/vps-bootstrap.sh
```

## Painel Ops (agente VPS)

Após o bootstrap, a operação diária (health, restart, logs, sync de versão) deve
ser feita pelo backoffice em **Bethânia → Ops / Host**
(`/backoffice/studio-bot/ops`), não por SSH.

### Bootstrap one-shot do agente

1. DNS `ops.corretorstudio.com` → IP da VPS; Caddy com bloco `ops` (ver [`Caddyfile`](Caddyfile)).
2. No backoffice, **Gerar token do agente** e copiar o valor.
3. Na VPS, em `/opt/lead-flow-bot/.env.ops`: `OPS_AGENT_TOKEN=<token>` (não use `.env` — o compose lê só `.env.ops`).
4. Copiar `deploy/hostinger/studio-bot-ops` para `/opt/lead-flow-bot/deploy/hostinger/studio-bot-ops` (ou `bun run host:pack` + sync).
5. `docker compose -f docker-compose.vps.yml up -d --build studio-bot-ops`
6. Em Vercel Production: `BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN=<mesmo token>`
7. No painel Ops: `agentBaseUrl=https://ops.corretorstudio.com` → Salvar → Health.

O Health devolve `vpsStackCheck.ok=true` quando `openwa` e `studio-bot-ops` estão
`Up` e sem `(unhealthy)`.

### Rotas do agente

| Rota | Uso |
|---|---|
| `GET /healthz` | Liveness sem auth |
| `GET /v1/token/verify` | Confere o token sem HMAC (útil após rotate) |
| `GET /v1/health` | Containers + versão do host + `vpsStackCheck` |
| `GET /v1/logs?service=openwa\|studio-bot-ops` | `docker compose logs --tail` |
| `POST /v1/services/restart` | `service` = `openwa`, `studio-bot-ops` ou `all` |
| `POST /v1/host/sync` | Aplica o `host-pack.tar.gz` e sobe o compose |
| `POST /v1/env/apply` | **Congelado** — ver abaixo |

`POST /v1/env/apply` escreve `.env.n8n`/`.env.evolution` e recria serviços que não
existem mais; o `compose up` no fim sempre falha. Foi mantido intacto porque o
modelo de env vive em colunas do banco (`BackofficeBotHostSettings.n8nEnvEncrypted`
e `evolutionEnvEncrypted`) e reapontá-lo para o `.env.openwa` exige migration mais
decisão sobre expor a service key do Supabase no painel. Fica para a Spec 02.

### Backup do banco — não é mais feito aqui

Decisão de 2026-08-25: **a VPS não faz backup do banco.** O `backup-supabase.sh`,
os endpoints `/backup/run` e `/backup/download` do agente Ops e o painel
`backupReadiness` foram removidos.

Os dois caminhos vigentes são o cron `database-backup` da Vercel (export para o
Google Drive) e o dump manual `bun run db:backup -- <pasta>`.

Se a VPS ainda tiver um cron chamando o script antigo, remova-o de lá — ele é
externo ao repositório e continuaria falhando todo dia.

### Sync de versão do host

```bash
bun run host:pack
# Upload do .tar.gz no painel Ops → Sync host version
```

O pack leva `deploy/hostinger/studio-bot-ops`, `.env.ops.example`, o `Caddyfile` e
o `docker-compose.vps.yml`. O agente faz backup de `docker-compose.vps.yml` e
`studio-bot-ops` antes de extrair, grava `.host-version` e roda
`build studio-bot-ops` + `pull` + `up -d`.

## Fase 5 — Vercel

Copie variáveis de [`vercel-env.production.example`](vercel-env.production.example)
para o projeto na Vercel e faça **redeploy**.

## Fase 6 — Snapshots (obrigatório)

hPanel → VPS → **Snapshots** → ativar retenção de 7 dias.

## Comandos do dia a dia

Na VPS (`/opt/lead-flow-bot`):

```bash
# Status
docker compose -f docker-compose.vps.yml ps

# Logs
docker compose -f docker-compose.vps.yml logs -f openwa
docker compose -f docker-compose.vps.yml logs -f studio-bot-ops

# Reiniciar
docker compose -f docker-compose.vps.yml restart openwa

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

A VPS Hostinger (KVM 2) hospeda até **2** GitHub Actions runners do repositório `lead-flow-app`. Os workflows usam:

```yaml
# Lint / Quality / demais jobs
runs-on: [self-hosted, linux, x64, lead-flow-ci]

# next build (só o runner 1 tem esta label → máx. 1 build por vez)
runs-on: [self-hosted, linux, x64, lead-flow-build]
```

Isso mantém orquestração/logs/secrets no GitHub, mas a CPU/RAM do job é da VPS — **não consome minutos `ubuntu-latest` do plano**. Com 2 runners, até **2 jobs em paralelo** (ex.: Build + Lint), sem dois `next build` ao mesmo tempo.

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
- labels: runner 1 = `lead-flow-ci` + `lead-flow-build`; runner 2 = só `lead-flow-ci`
- systemd separado por runner + `NODE_OPTIONS=--max-old-space-size=2560`
- limpeza diária idle-only via `/usr/local/sbin/github-runner-cleanup.sh` (lista em `/etc/github-runner/workdirs.list` + discovery `.runner`)
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
| `next build` | **máx. 1** via label exclusiva `lead-flow-build` no runner 1 (Build + Lint ok) |
| Stack compartilhada | OpenWA + agente Ops |
| RAM recomendada | KVM 2 (8 GB) |
| Heap Node por runner | `2560` MB |
| Se OOM no `next build` | baixar heap, ou temporariamente voltar só o job `build` para `ubuntu-latest` |

## Troubleshooting

| Sintoma | Ação |
|---------|------|
| 502 no Caddy em `ops` | `docker ps` — o container `studio_bot_ops` está de pé? |
| Painel Ops → Health falha | `curl -sS https://ops.corretorstudio.com/healthz`; depois `/v1/token/verify` com o Bearer |
| App na Vercel não fala com o OpenWA | Esperado enquanto o gateway não tiver rota pública — ver [lacuna conhecida](#lacuna-conhecida-o-openwa-não-tem-rota-pública). `http://openwa:3333` não resolve fora da rede Docker |
| OpenWA sem sessão | `docker compose -f docker-compose.vps.yml logs -f openwa` e reconectar o WhatsApp pelo produto |
| `Aplicar env` falha no painel | Esperado — a rota está congelada (ver acima) |
| CI queued / runner Offline | `systemctl status 'actions.runner.*'` e reiniciar; conferir Idle no GitHub |
| OOM no build Next | `free -h` durante o job; reduzir `NODE_OPTIONS` ou upgrade de RAM |

## Arquivos deste diretório

| Arquivo | Uso |
|---------|-----|
| [`Caddyfile`](Caddyfile) | Proxy HTTPS → agente Ops |
| [`.env.ops.example`](.env.ops.example) | Template do agente Ops na VPS |
| [`vercel-env.production.example`](vercel-env.production.example) | Variáveis Vercel |
| [`bootstrap-github-runner.sh`](bootstrap-github-runner.sh) | Instala self-hosted runner (CI) |
| [`../vps-bootstrap.sh`](../vps-bootstrap.sh) | Script de bootstrap da stack da VPS |
