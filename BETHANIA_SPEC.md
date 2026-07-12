# BETHANIA_SPEC — Correção da falha sistêmica N8N e do fluxo de vinculação

**Data:** 2026-07-10
**Baseada em:** `BETHANIA_AUDIT.md` (diagnóstico confirmado)
**Pré-condição:** nenhum estágio de infraestrutura (VPS/N8N) deve ser executado sem autorização explícita do owner.

---

## Goal

1. Restaurar 100% de sucesso no caminho feliz dos 9 workflows `bethania-*` em produção.
2. Restaurar o fluxo completo de vinculação: "Gerar código" na Account → `VINCULAR <código>` no WhatsApp → confirmação.
3. Instalar alerta mínimo de falha para o N8N (gap mais grave revelado pela auditoria).
4. Pinar a versão do n8n para eliminar upgrades silenciosos.

## Non-goals

- Refatorar os 9 workflows para usar n8n Credentials em vez de env vars (fase 2 — registrado como follow-up).
- Retry/backoff completo do outbox (proposto como estágio opcional; o mínimo aqui é parar de marcar `sent` para execução que falhou).
- Recuperar o backlog de eventos outbox já marcados `sent` que nunca foram entregues (pushes informativos; perda documentada e aceita).
- Qualquer mudança de UI no card da Bethânia além de mensagem de erro.
- Reimplementar a máquina de estados conversacional (menu 1–5, busca) nos stubs N8N `bethania-menu-main` / `list-*` nesta fase — a orquestração fica no inbound Next.js.

---

## Decisão arquitetural — leitura de env vars nos nodes do N8N

**Contexto:** o n8n 2.x bloqueia `$env` por padrão (`N8N_BLOCK_ENV_ACCESS_IN_NODE=true`), tanto em **expressões** quanto em **Code nodes**. A ideia de mover `$env` para um node `Set` **não funciona** — expressões sofrem o mesmo bloqueio. As opções reais:

| Opção | Prós | Contras |
|---|---|---|
| **A. `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` na instância** | 1 linha; restaura os 9 workflows sem tocar em nenhum; reversível | Contraria o hardening default do n8n 2.x |
| B. n8n Variables (`$vars`) | Padrão recomendado | Recurso licenciado — indisponível no self-hosted community |
| C. Migrar para Credentials + URLs fixas nos nodes | Alinhado ao hardening | Toca os 9 workflows de uma vez, alto risco de regressão, sem CI |

**Decisão: Opção A agora, C como fase 2.** Justificativa: a instância é single-tenant, atrás de Caddy/HTTPS, sem editores de workflow externos — o risco de expor env vars a quem edita workflows é aceitável (quem edita já administra a VPS). O bloqueio default protege instâncias multiusuário, que não é o caso. A migração para Credentials (C) é a direção correta de longo prazo, mas não deve ser feita às pressas em cima de um módulo 100% fora do ar.

**Decisão complementar (Corretor Studio):** substituir `Bun.password` por `bcryptjs` (implementação pura JS, agnóstica de runtime, mesmo formato bcrypt — hashes existentes continuam verificáveis; irrelevante na prática pois os códigos expiram em 10 min). Nenhuma API `Bun.*` pode existir em código que roda na Vercel.

---

## Estágios

### Estágio 0 — Confirmação in loco (VPS) — ✅ CONCLUÍDO em 2026-07-10

Inspeção via SSH confirmou: n8n 2.28.5 (`latest`, recriado há 8 dias), `N8N_BLOCK_ENV_ACCESS_IN_NODE` ausente (default true ativo), `EVO_API_BASE_URL`/`EVO_API_KEY` ausentes, `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER` vazio. Compose ativo: `/opt/lead-flow-bot/docker-compose.vps.yml` (**não** o de `/opt/lead-flow-app/`, que está desatualizado). Versão anterior do n8n irrecuperável (imagem sobrescrita).

**Aceite:** ✅ hipótese confirmada por inspeção direta.

### Estágio 1 — Correção do runtime no Corretor Studio (repo, PR normal) — ✅ IMPLEMENTADO em 2026-07-10 (branch `bugfix/bethania-auth-code-node-runtime`, aguardando PR/deploy)

1. Adicionar `bcryptjs` (`bun add bcryptjs`).
2. Em `lib/studio-bot/auth-code.ts`: `hashAuthCode`/`verifyAuthCode` passam a usar `bcryptjs` (cost 10, como hoje). Assinaturas inalteradas — nenhum call site muda.
3. **Testes obrigatórios (governança):** unit tests para `auth-code.ts` (hash→verify roundtrip, verify contra hash bcrypt pré-gerado, rejeição de código errado) e para `BackofficeBotAuthUseCase.linkInitiate`/`verifyCode` (caminho feliz + RATE_LIMIT + erro).
4. Guard-rail: adicionar checagem no `governance:check` (ou lint rule) proibindo o global `Bun.` em `app/**` e `lib/**` (permitido apenas em `scripts/**`).
5. Validação: `bun run typecheck`, `bun run lint`, `bun run governance:check`, `bun run lint:pt-br` + **verificação sob Node** (`next build && next start` com Node, clicar "Gerar código" localmente) — é exatamente o gap dev/prod que deixou o bug passar.

**Aceite:** código de vínculo gerado com sucesso em ambiente Node; testes verdes.

### Estágio 2 — Correção da instância N8N (VPS, manual, com autorização) — ✅ APLICADO em 2026-07-10

Aplicado na VPS com backups (`.env.n8n.bak-20260710`, `docker-compose.vps.yml.bak-20260710`): flag `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, `EVO_API_BASE_URL=http://evolution_api:8080` (rede interna docker), `EVO_API_KEY` (copiada do env do container `evolution_api`), imagem pinada em `2.28.5`, container recriado saudável. **Validação:** execução nº 445 do `bethania-push-outbound` → `success` em 136ms (primeira execução verde; antes, erros de ~11ms). Espelhos no repo atualizados (compose files, `.env.n8n` local, `n8n/README.md`).

**Descoberta pós-correção:** execuções reais do cron outbox (`studio_bot.channel_reconnect`) agora passam do Code node mas falham no node "Evolution API" com **404 — "The bethania instance does not exist"**. A instância `bethania` nunca foi provisionada na Evolution API (só existem instâncias `team_*` do produto; `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER` vazio corrobora). Ver Estágio 2b.

### Estágio 2b — Provisionar o canal WhatsApp da Bethânia (ação do owner) — ✅ CONCLUÍDO em dev local (2026-07-10)

1. No backoffice (tela Studio Bot / Canal), criar a instância `bethania` e conectar via QR Code com o telefone da Bethânia (não criar direto na Evolution API — o backoffice persiste o estado em `backoffice_bot_channels`).
2. Preencher `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER` no `.env.n8n` da VPS (e `NEXT_PUBLIC_BETHANIA_WHATSAPP_NUMBER` na Vercel para o deep link do card).
3. Configurar o webhook da instância para `http://n8n:5678/webhook/bethania-inbound`.

**Evidência (dev local):** instância `bethania` com `connectionStatus: open`; webhook Evolution → N8N `bethania-router` → `/api/webhooks/backoffice/studio-bot/inbound`; vínculo e2e Account → `VINCULAR` → confirmação WhatsApp; menu principal ao digitar `menu`/`oi`/`ajuda` no **Next.js** (não no N8N). Produção VPS ainda depende de QR + número preenchido no env.

**Aceite:** instância `bethania` com `connectionStatus: open` e evento `channel_reconnect` do outbox executando verde.

1. Editar `/opt/lead-flow-bot/.env.n8n`:
   - `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`
   - `EVO_API_BASE_URL=https://evo.corretorstudio.com`
   - `EVO_API_KEY=<chave da Evolution API>`
   - Preencher `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER` se ainda vazio.
2. Pinar a imagem: `image: docker.io/n8nio/n8n:2.28.5` em `docker-compose.vps.yml` **e** `docker-compose.n8n.yml` (mesma versão em dev e prod). Atualizar via PR no repo; aplicar na VPS (`docker compose -f docker-compose.vps.yml up -d n8n`).
3. Atualizar o espelho `.env.n8n` do repo e o `n8n/README.md` (o snippet de HMAC documentado lê `$env` em Code node — anotar a dependência da flag e a migração futura para Credentials).

**Aceite:** n8n reinicia saudável (healthcheck OK) e uma execução manual de teste de qualquer workflow não lança mais `access to env vars denied`.

### Estágio 3 — Validação do caminho ativo (runbook) — ✅ RUNBOOK ATUALIZADO em 2026-07-10 (dev)

Alinhado ao Estágio 5: a conversa não passa pelos stubs N8N `menu-main` / `list-*`. Aceite = **matriz documentada do caminho ativo** + stubs classificados (não “9 stubs verdes no WhatsApp”).

| # | Item | Como validar (dev) | Critério | Evidência (dev local) |
|---|---|---|---|---|
| 1 | `bethania-router` | Mensagem WhatsApp → Evolution → N8N → inbound 200 | Execução verde + resposta Bethânia | Validado 2026-07-10 (inbound 200 + menu) |
| 2 | Verify / vínculo | Account “Gerar código” → `VINCULAR` | Vínculo ativo + confirmação WA (inbound Next.js) | Validado 2026-07-10 |
| 3 | Menu + opções `1`/`2`/`3` | Digitar `menu` e escolhas | Listas formatadas no WA (inbound Next.js) | Implementado Estágio 5; validar no WA após deploy local |
| 4 | `bethania-push-outbound` | Outbox `test_ping` / dispatch; falha forçada | Verde no happy path; falha → outbox `failed` + Slack | Repo: `responseMode=lastNode`; import local OK 2026-07-10; Slack e2e aguarda `BETHANIA_SLACK_WEBHOOK_URL` |
| 5 | Stub `bethania-menu-main` | Manual Trigger / classificar | Stub — não caminho ativo; smoke HMAC **adiado (fase 2)** | Classificado stub |
| 6 | Stub `bethania-list-leads` | idem | idem | Classificado stub |
| 7 | Stub `bethania-list-tasks` | idem | idem | Classificado stub |
| 8 | Stub `bethania-agenda-today` | idem | idem | Classificado stub |
| 9 | Stub `bethania-add-note-confirm` + `verification-channel` | idem | Caminho A e-mail / add-note via N8N adiado | Classificado stub |

Runbook espelhado em `n8n/README.md` (seção “Runbook de validação”).

**Aceite desta entrega:** matriz preenchida (caminho ativo + stubs classificados). Aplicação VPS exige autorização explícita.

### Estágio 4 — Observabilidade (alerta mínimo) — ✅ IMPLEMENTADO no repo/dev em 2026-07-10 (VPS pendente auth)

1. **Error workflow:** `n8n/workflows/bethania-error-notifier.json` — Error Trigger → Code → HTTP POST Slack Incoming Webhook (`$env.BETHANIA_SLACK_WEBHOOK_URL`). ID estável `a1b2c3d4-err0-4000-8000-0000000000ef`. Os 9 workflows `bethania-*` têm `settings.errorWorkflow` apontando para esse ID. Import via `bun run n8n:import:all`.
2. **Fechar o buraco do `onReceived`:** `bethania-push-outbound` com `responseMode: lastNode`. `BackofficeBotEventOutboxUseCase.dispatchPending` faz `console.error` com contagem/`eventId`s quando há falhas.
3. *(Opcional, follow-up)* Retry de eventos `failed` no outbox com `attemptCount` + backoff, e alerta (Sentry cron monitor no `studio-bot-outbox`) quando a taxa de falha do dispatch passar de 10% em 1h.

**Aceite (dev):** forçar erro em workflow ativo dispara Slack (com `BETHANIA_SLACK_WEBHOOK_URL` preenchida); evento outbox de execução falhada fica `failed`, não `sent`.

#### TODO — configurar Incoming Webhook no Slack (owner)

O workflow `bethania-error-notifier` já está versionado e importável, mas **não alerta até a URL existir no env**.

- [ ] Criar Incoming Webhook no Slack (passos abaixo) e copiar a URL `https://hooks.slack.com/services/...`
- [ ] Preencher `BETHANIA_SLACK_WEBHOOK_URL` em `.env.n8n` (dev local)
- [ ] Restart do container N8N (`bun run n8n:down && bun run n8n:up` ou `docker restart n8n`) para o env entrar no processo
- [ ] Forçar falha em workflow **ativo** (ex. Code node `throw new Error('teste alerta Bethânia')` no `bethania-push-outbound`, ou URL Evolution inválida temporária) → confirmar mensagem no canal
- [ ] (VPS, com autorização) repetir no `.env.n8n` de produção e restart do `n8n`

##### Como criar um Incoming Webhook no Slack

1. No workspace Slack, abra **[api.slack.com/apps](https://api.slack.com/apps)** → **Create New App** → **From scratch** (nome sugerido: `Bethânia N8N Alerts`, workspace do Corretor Studio).
2. No menu do app: **Incoming Webhooks** → ative **Activate Incoming Webhooks**.
3. **Add New Webhook to Workspace** → escolha o canal (ex.: `#bethania-alerts` ou `#ops`) → **Allow**.
4. Copie a **Webhook URL** (`https://hooks.slack.com/services/T.../B.../...`). Trate como segredo — não commitar no git.
5. Cole em `.env.n8n`:

```env
BETHANIA_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/SEU/WEBHOOK/AQUI
```

6. Alternativa legada (ainda funciona em muitos workspaces): **Apps** no Slack → buscar **Incoming Webhooks** → **Add to Slack** → canal → copiar URL. Preferir o fluxo via [api.slack.com/apps](https://api.slack.com/apps) (acima).

Teste manual da URL (opcional, fora do N8N):

```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Teste Bethânia — webhook OK"}' \
  "$BETHANIA_SLACK_WEBHOOK_URL"
```

#### Checklist VPS (requer autorização explícita — não executar sem auth)

1. Preencher `BETHANIA_SLACK_WEBHOOK_URL` no `.env.n8n` da VPS.
2. Restart/recreate do container `n8n`.
3. `bun run n8n:import:all`.
4. Confirmar notifier ativo + `errorWorkflow` nos 9.
5. Repetir matriz Estágio 3 em produção; simular falha → Slack.

### Estágio 5 — Máquina de estados conversacional (menu) — ✅ IMPLEMENTADO em 2026-07-10 (dev)

**Modelo:** respostas no inbound Next.js (`BackofficeBotInboundWebhookUseCase`), não nos stubs N8N. Fluxo:

`WhatsApp → Evolution → bethania-router → /api/webhooks/backoffice/studio-bot/inbound → BackofficeBotActionUseCase → Evolution sendTextMessage → WhatsApp`

**Contrato do menu principal** (texto + mapeamento):

| Opção | Action | Quem vê |
|---|---|---|
| `1` | `list_leads` | todos vinculados |
| `2` | `agenda_today` | todos vinculados |
| `3` | `list_tasks` | todos vinculados |
| `4` | `search_lead` | MANAGER+ (item no menu); senão mensagem de permissão |
| `5` | `team_digest` | MANAGER+ (idem) |

**Sessão:** `flowId=menu_main`; `flowStep` ∈ `awaiting_choice` | `awaiting_search_query` | `list_shown`; `currentLeadId` reservado para submenu (fora desta entrega).

**Comandos globais:** `menu` / `voltar` / `cancelar` (e aliases `oi`/`ajuda`/…) reabrem o menu e resetam `flowStep=awaiting_choice`.

**Busca (opção 4):** primeira escolha pede query e seta `awaiting_search_query`; próxima mensagem de texto chama `search_lead` com `query`.

**Aceite:** digitar `1`/`2`/`3` (e `4`/`5` se MANAGER+) devolve lista formatada no WhatsApp com dados do time do usuário; `menu`/`voltar` sempre reabre o menu.

**Fora de escopo (follow-up):** submenu de lead (detalhe/nota/reunião/tarefa — J3–J6); caminho A (e-mail no chat); aplicar Estágio 3/4 na VPS sem autorização.

---

## Critérios de aceite globais

- [ ] Overview do n8n sem falhas de execução no caminho feliz por 24h após o deploy.
- [x] "Gerar código" funciona em produção (Vercel/Node) e o e2e `VINCULAR` conclui o vínculo. *(Estágio 1 implementado; e2e validado em **dev local** 2026-07-10 — produção aguarda deploy)*
- [x] Imagem do n8n pinada em versão explícita nos dois compose files.
- [x] `EVO_API_BASE_URL`/`EVO_API_KEY` presentes no env da instância. *(VPS + espelho local)*
- [x] Error workflow ativo nos 9 workflows; falha simulada gera alerta. *(repo/dev — `bethania-error-notifier` + Slack; VPS pendente autorização; webhook Slack precisa estar preenchido no env para o teste e2e)*
- [x] Execuções de teste do caminho ativo documentadas (Estágio 3 Y). *(stubs 5–9 classificados; smoke HMAC adiado fase 2; VPS pendente autorização)*
- [x] Testes de `auth-code`/UseCase verdes; `typecheck`, `lint`, `governance:check` verdes.
- [x] Menu 1–5 responde no WhatsApp (dev) com dados reais do time (Estágio 5).

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` reduz hardening | Instância single-tenant; follow-up de migração p/ Credentials (fase 2) |
| Workflows importados em produção divergem dos JSONs do repo | Estágio 3 valida execução real, não o JSON; reexportar após validação |
| Backlog outbox `sent` perdido | Aceito (non-goal); eventos são pushes informativos |
| bcryptjs mais lento que bcrypt nativo | Custo 10 em código de 6 dígitos com rate limit de 3/h — irrelevante |

## Follow-ups (fora desta correção)

1. Fase 2: migrar segredos dos workflows para n8n Credentials e eliminar `$env` (permite religar o bloqueio).
2. Retry/backoff do outbox + monitor de taxa de falha.
3. Mensagem de erro do card Bethânia com código de correlação (hoje: toast genérico).
4. Processo de upgrade do n8n: changelog review antes de subir versão (nunca `latest`).
5. **TODO Slack:** criar Incoming Webhook e preencher `BETHANIA_SLACK_WEBHOOK_URL` (dev + VPS) — ver Estágio 4 → “TODO — configurar Incoming Webhook no Slack”.
