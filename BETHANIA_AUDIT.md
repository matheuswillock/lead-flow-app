# BETHANIA_AUDIT — Auditoria da falha sistêmica N8N + defeito "Gerar código"

**Data:** 2026-07-10
**Escopo:** 9 workflows `bethania-*` no N8N (n8n.corretorstudio.com, self-hosted 2.28.5) + fluxo de vinculação web no Corretor Studio (`/[supabaseId]/account`).

---

## Sumário executivo

São **dois defeitos independentes, com causas raiz distintas**, que juntos quebram a vinculação ponta a ponta:

1. **Falha sistêmica N8N (100% das execuções):** a instância roda a imagem `n8nio/n8n:latest` e foi atualizada silenciosamente para a linha **2.x**, onde `N8N_BLOCK_ENV_ACCESS_IN_NODE` passou a ser **`true` por padrão** (hardening do n8n 2.0, junto com task runners habilitados por padrão). Todos os 9 workflows leem `$env` — 8 em expressões de nodes HTTP Request e 1 (`bethania-push-outbound`) dentro de um Code node — e o bloqueio vale para **ambos** os contextos. Toda execução morre na primeira leitura de `$env`, em ~10ms, o que bate com o tempo médio de 0.01s do Overview.
2. **Botão "Gerar código" (Corretor Studio):** `lib/studio-bot/auth-code.ts` usa **`Bun.password.hash`/`Bun.password.verify`**, mas a produção roda em **Vercel com runtime Node v24** (confirmado via Sentry: `runtime: node v24.18.0`, `cloud.provider: vercel`). O global `Bun` não existe → `ReferenceError` → capturado pelo `try/catch` do `BackofficeBotAuthUseCase.linkInitiate` → toast genérico "Erro ao iniciar vínculo". **Não tem relação com o N8N.**

Corrigir só o N8N não destrava a vinculação (a geração e a verificação do código quebram no Vercel); corrigir só o `Bun.password` não destrava (o `VINCULAR <código>` passa pelo `bethania-router`/`bethania-verification-web`, que estão caídos). **Os dois consertos são pré-requisito do fluxo ponta a ponta.**

---

## Diagnóstico 1 — Falha de 100% nos workflows N8N

### Causa raiz (confirmada por evidência estática + docs oficiais)

- **Erro real:** `access to env vars denied`, lançado por `workflow-data-proxy-env-provider.js` (visível no stack trace do output). A mensagem exibida — `Cannot assign to read only property 'name' of object 'Error: access to env vars denied'` — é um **bug cosmético do task runner** do n8n ao re-embrulhar o erro original (objeto de erro congelado); ela **mascara** a causa, mas o erro subjacente está no stack trace.
- **Por que começou:** breaking change do **n8n 2.0** (dez/2025): `N8N_BLOCK_ENV_ACCESS_IN_NODE` agora **default `true`** e task runners habilitados por padrão. A instância está em **2.28.5** porque os compose files usam tag flutuante:
  - `docker-compose.vps.yml:58` → `image: docker.io/n8nio/n8n:latest`
  - `docker-compose.n8n.yml` (dev local) → idem
  Qualquer `docker compose pull`/recreate na VPS puxou a 2.x e ativou o bloqueio sem nenhuma mudança nos workflows.
- **Por que TODOS os 9 quebram de uma vez:** o bloqueio vale para `$env` em **expressões e em Code nodes**. Mapeamento (fonte: `n8n/workflows/*.json` versionados no repo):

| Workflow | Onde lê `$env` | Node | Variável |
|---|---|---|---|
| bethania-router | Expressão (HTTP Request) | Auth Status | `LEAD_FLOW_API_BASE_URL` |
| bethania-verification-web | Expressão (HTTP Request) | Verify Code | `LEAD_FLOW_API_BASE_URL` |
| bethania-verification-channel | Expressão (HTTP Request) | Request Code | `LEAD_FLOW_API_BASE_URL` |
| bethania-menu-main | Expressão (HTTP Request) | Get Context Menu | `LEAD_FLOW_API_BASE_URL` |
| bethania-list-leads | Expressão (HTTP Request) | List Leads | `LEAD_FLOW_API_BASE_URL` |
| bethania-list-tasks | Expressão (HTTP Request) | List Tasks | `LEAD_FLOW_API_BASE_URL` |
| bethania-agenda-today | Expressão (HTTP Request) | Agenda Today | `LEAD_FLOW_API_BASE_URL` |
| bethania-add-note-confirm | Expressão (HTTP Request) | Confirm Add Note | `LEAD_FLOW_API_BASE_URL` |
| bethania-push-outbound | **Code node** | Route Outbound Event | `EVO_BETHANIA_INSTANCE`, `EVO_API_BASE_URL`, `EVO_API_KEY` |

- **Por que 345 execuções:** o cron `studio-bot-outbox` na Vercel (`vercel.json`, `*/5 * * * *`) despacha eventos do outbox para `https://n8n.corretorstudio.com/webhook/bethania-outbound` sempre que há eventos pendentes → cada dispatch dispara uma execução do `bethania-push-outbound`, que falha instantaneamente. Os demais workflows só executam quando alguém manda mensagem para a Bethânia (e também falham).

> **Correção a uma hipótese do prompt:** mover a leitura para um node `Set`/`Edit Fields` via expressão `{{$env.VAR}}` **não resolve** — o bloqueio do `N8N_BLOCK_ENV_ACCESS_IN_NODE` cobre expressões também, não só o corpo do Code node. A correção é liberar a flag na instância ou eliminar `$env` (credentials/valores fixos). Ver decisão na SPEC.

### Agravante encontrado (falharia mesmo com env liberado)

O espelho do env de produção (`.env.n8n` no repo, comentado como "VALORES REAIS em produção — VPS `/opt/lead-flow-bot/.env.n8n`") **não contém `EVO_API_BASE_URL` nem `EVO_API_KEY`**, que o `bethania-push-outbound` consome. O código faz fallback para `''` → mesmo após liberar `$env`, as chamadas à Evolution API sairiam com URL vazia. `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER` também está vazio. Se o arquivo real da VPS espelha este, é uma segunda correção obrigatória.

### Confirmação in loco (VPS, 2026-07-10 — Estágio 0 da SPEC executado)

Inspeção direta via SSH em `root@187.77.226.253` (srv1799450):

- `docker exec n8n n8n --version` → **2.28.5**; container `n8nio/n8n:latest` recriado há **8 dias** (~2026-07-02, quando as falhas começaram). A imagem anterior não existe mais localmente (sobrescrita pelo pull de `latest`).
- `/opt/lead-flow-bot/.env.n8n` **não contém** `N8N_BLOCK_ENV_ACCESS_IN_NODE` → vale o default 2.x (`true`, bloqueio ativo). Confirmado também no env efetivo do container (`docker exec n8n printenv`).
- `EVO_API_BASE_URL` e `EVO_API_KEY` **ausentes** do arquivo e do container (agravante confirmado). `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER` está vazio.
- Compose ativo: `/opt/lead-flow-bot/docker-compose.vps.yml` (há uma cópia desatualizada em `/opt/lead-flow-app/` — atenção para não editar o diretório errado).

**Causa raiz confirmada, sem ressalvas.**

### Terceira causa encadeada, descoberta após a correção do `$env` (2026-07-10)

Com o bloqueio de `$env` removido, as execuções reais do `bethania-push-outbound` passaram a falhar adiante, no node "Evolution API": **404 — `The "bethania" instance does not exist`**. A Evolution API da VPS só tem instâncias `team_*` do produto (ambas `connecting`); a instância `bethania` **nunca foi provisionada** — consistente com `BACKOFFICE_BETHANIA_WHATSAPP_NUMBER` vazio no env. Ou seja, o módulo tinha três camadas de quebra: (1) `$env` bloqueado pelo n8n 2.x [corrigido], (2) `EVO_API_BASE_URL`/`EVO_API_KEY` ausentes [corrigido], (3) canal WhatsApp da Bethânia inexistente na Evolution [pendente — exige criar a instância via backoffice e escanear QR com o telefone da Bethânia; Estágio 2b da SPEC].

---

## Diagnóstico 2 — Botão "Gerar código" (independente do N8N)

### Cadeia do fluxo (toda no Corretor Studio, sem N8N)

`BethaniaConnectionCard` → `BethaniaLinkService.initiate()` → `POST /api/v1/bot/link/initiate` → `BackofficeBotAuthUseCase.linkInitiate` → `BackofficeBotAuthService.linkInitiate` → Prisma. **Nenhuma chamada a N8N/Evolution** — gerar o código é 100% banco de dados.

### Causa raiz

[lib/studio-bot/auth-code.ts:12,16](lib/studio-bot/auth-code.ts) usa `Bun.password.hash` / `Bun.password.verify`:

- Produção roda na **Vercel com runtime Node** (evidência Sentry no evento do projeto: `runtime: node v24.18.0`, `cloud.provider: vercel`, caminho `/var/task/...`). O Vercel usa Bun no *build* (package manager), mas as functions executam em Node — onde o global `Bun` **não existe**.
- `linkInitiate` → `hashAuthCode(code)` → `ReferenceError: Bun is not defined` → capturado em `BackofficeBotAuthUseCase.linkInitiate` → `Output(false, ..., ["Erro ao iniciar vínculo"])` → HTTP 400 → toast de erro no card. O botão "não completa a ação" exatamente como reportado.
- **Por que não aparece no Sentry:** o erro é engolido pelo `try/catch` e só vai para `console.error` (não capturado como issue). Não há nenhum evento/trace de `/api/v1/bot/link/*` no Sentry nos últimos 14 dias.
- **Confiança:** alta (única explicação consistente com código + runtime). Validação definitiva: logs de runtime da Vercel no horário de um clique (o MCP da Vercel não está autorizado nesta sessão) ou reproduzir com `next start` sob Node local.

### Raio de explosão (maior que o botão)

O mesmo `auth-code.ts` atende **todo** o stack de autenticação da Bethânia:

- `requestCode` (caminho A — e-mail via canal) → `hashAuthCode` → quebrado.
- `verifyCode` (chamado pelo `bethania-verification-web` via HMAC quando o usuário manda `VINCULAR <código>`) → `verifyAuthCode` → quebrado.

Ou seja: **mesmo consertando o N8N, a vinculação continuaria falhando** no `verify-code`. E funciona em dev local (dev roda sob Bun), o que explica não ter sido pego antes de produção.

### Relação entre os dois defeitos

**Causas raiz independentes** (config de segurança do n8n 2.x vs. API exclusiva do runtime Bun em produção Node). Relacionam-se apenas na consequência: ambos são pré-requisito do fluxo de vinculação ponta a ponta. A SPEC trata como dois planos de correção com validação e2e conjunta ao final.

---

## AUDIT — classificação dos itens do estado-alvo

| # | Item | Status | Observação |
|---|---|---|---|
| 1 | Zero falha sistêmica nos workflows | **Falha confirmada, causa raiz identificada** | `N8N_BLOCK_ENV_ACCESS_IN_NODE=true` (default 2.x) + tag `latest` |
| 2 | "Gerar código" funcional | **Não existe (quebrado em produção)** | `Bun.password` em runtime Node; independente do N8N |
| 3 | Observabilidade/alerta de falha | **Implementado no repo/dev** | `bethania-error-notifier` → Slack; VPS pendente auth |
| 4 | Processo de validação manual N8N | **Não existe** | Nenhum runbook de execução de teste documentado; a SPEC define um |

## CRITIQUE — riscos além dos itens

1. **`image: latest` em produção** é a causa primária estrutural: um upgrade de major com breaking changes entrou em produção sem ninguém decidir. Vale para o n8n do VPS **e** para o dev local (`docker-compose.n8n.yml`) — dev e prod podem estar em versões diferentes a qualquer momento. Pinar versão é obrigatório.
2. **Perda silenciosa de eventos, não só falta de alerta:** o webhook do `bethania-push-outbound` usa `responseMode: "onReceived"` — o n8n responde **200 antes de executar**. O `BackofficeBotEventOutboxUseCase.dispatchPending` recebe 200 e marca o evento como **`sent`**. Resultado: o app acredita que 100% dos pushes foram entregues enquanto 100% falharam, e os eventos marcados `sent` **não serão reenviados** após a correção (perda definitiva do backlog). Além disso, eventos marcados `failed` nunca são retentados (`listPendingOutboxEvents` só pega `pending`) — não há retry/backoff.
3. **`$env` espalhado em 9 workflows sem camada de abstração:** uma única mudança de política derrubou o módulo inteiro. O snippet de HMAC recomendado no próprio `n8n/README.md` também lê `$env` dentro de Code node — a documentação interna ensina o padrão quebrado.
4. **Dependência sem fallback nem mensagem clara:** quando o N8N está fora, a Bethânia simplesmente não responde no WhatsApp e o usuário não recebe nenhum sinal no produto. O card da Account também mostra apenas toast genérico ("Erro ao iniciar vínculo") sem código de suporte/correlação.
5. **Gap dev↔prod de runtime:** dev local executa sob Bun, produção sob Node. Qualquer API exclusiva do Bun (`Bun.*`) passa em dev e explode em produção. Vale lint/CI (ex.: proibir `Bun.` fora de `scripts/`) — proposto na SPEC.
6. **Placeholders `REPLACE_WITH_HMAC_SIGNATURE`** presentes nos 8 workflows versionados: se os workflows importados em produção espelham os JSONs do repo sem o node de assinatura, as chamadas HMAC ao Lead Flow API falhariam com 401 mesmo após os dois consertos — verificar na validação manual (estágio de validação da SPEC cobre isso).

## Evidências consultadas

- Output de erro do node "Route Outbound Event" (stack trace com `workflow-data-proxy-env-provider.js` e `js-task-runner.js`; n8n `2.28.5 Self Hosted`).
- `n8n/workflows/*.json` (mapeamento completo de `$env` por node), `.env.n8n`, `docker-compose.vps.yml`, `docker-compose.n8n.yml`, `deploy/hostinger/README.md`, `vercel.json` (cron outbox).
- Código do fluxo de vinculação: `BethaniaConnectionCard.tsx`, `BethaniaLinkService.ts`, `app/api/v1/bot/link/*/route.ts`, `BackofficeBotAuthUseCase.ts`, `BackofficeBotAuthService.ts`, `lib/studio-bot/auth-code.ts`, `BackofficeBotEventOutboxUseCase.ts`.
- Sentry (org `corretor-studio`): ausência de issues/eventos em `/api/v1/bot/link/*`; evento em produção confirmando runtime `node v24.18.0` na Vercel.
- `bun run db:migrate:status`: migrations locais e remotas 100% sincronizadas (descarta hipótese de schema ausente em produção; `20260630173123_studio-bot-foundation` aplicada).
- Docs oficiais n8n 2.0 breaking changes (task runners default + `N8N_BLOCK_ENV_ACCESS_IN_NODE` default true): https://docs.n8n.io/release-notes/v20-breaking-changes

---

## Estado pós-correção (2026-07-10, local)

| Item | Status |
|---|---|
| Estágio 1 — `bcryptjs` / sem `Bun.password` | ✅ Feito (`lib/studio-bot/auth-code.ts`) |
| Estágio 2 — N8N `$env` + imagem pinada | ✅ Feito em VPS/repo; local com `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` |
| Estágio 2b — canal `bethania` + QR | ✅ Feito em **dev local** (instância open, webhook → N8N → inbound) |
| Vínculo e2e Account → `VINCULAR` → confirmação WhatsApp | ✅ Feito local |
| Polling UI pós-vínculo | ✅ Feito (`BethaniaConnectionCard`) |
| Menu principal (`menu`/`oi`/`ajuda`) | ✅ Feito no **Next.js** inbound — N8N `bethania-router` é só proxy |
| Escolhas 1–5 do menu → actions + resposta WhatsApp | ✅ Feito no inbound Next.js (Estágio 5) |
| Actions backend (`list_leads`, `agenda_today`, …) | ✅ API pronta (`BackofficeBotActionUseCase`); JSONs N8N `list-*` = stubs manuais (não são o caminho ativo) |
| Estágio 3 — runbook caminho ativo (Y) | ✅ Matriz em SPEC/README; stubs classificados; VPS pendente auth |
| Estágio 4 — error notifier Slack + `lastNode` + log outbox | ✅ Repo/dev; preencher `BETHANIA_SLACK_WEBHOOK_URL` para teste e2e Slack; VPS pendente auth |

**Decisão validada em runtime:** orquestração conversacional no Corretor Studio; stubs N8N de menu/listas não precisam ser o caminho ativo nesta fase.
