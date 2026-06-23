# Runbook — Migração Corretor Studio: Vercel → Hostinger VPS (Coolify)

**Status:** planejamento (runbook operacional — código ainda não alterado)
**Objetivo:** reduzir custo de hospedagem (~R$200/mês na Vercel → ~R$75–90/mês) mantendo o **Supabase** (banco, auth e storage) intacto.
**Banco de dados:** permanece **Supabase** — esta migração troca **apenas a hospedagem da aplicação**.

---

## 1. Contexto e decisões

A aplicação (`lead-flow-app`, Next.js 16 + React 19) **não é estática**: usa SSR, API routes, webhooks e auth via cookies (Supabase SSR). Isso exige um **servidor Node sempre ativo** — a **hospedagem compartilhada/Cloud da Hostinger não roda isso** (é focada em PHP/LiteSpeed). Portanto, a migração é para um **VPS**.

Decisões tomadas:

- **Plataforma:** Hostinger **VPS + Coolify** — PaaS open-source self-hosted com experiência tipo Vercel: deploy por git push, SSL automático (Let's Encrypt), agendador de cron, painel de env vars e auto-restart.
- **Domínio:** **manter o domínio atual** e apenas **repontar o DNS**. Assim, URLs de webhook, redirects de OAuth e `NEXT_PUBLIC_APP_URL` ficam **idênticas** → cutover simples e rollback trivial.
- **Rollback:** repontar o `A record` de volta para a Vercel (o projeto continua existindo) → reversão em ~1 TTL.

---

## 2. Visão geral da arquitetura (levantado do código)

| Aspecto | Situação atual | Impacto na migração |
|---|---|---|
| Runtime | Next.js `16.2.9`, React `19.1.0`, `engines.node >=24`, gerenciador **Bun** (`bun.lock`) | VPS roda Node 24 + Bun via Docker |
| Build | `build: "prisma generate && next build"`, `postinstall: "prisma generate"` | Igual em Docker |
| Output | `next.config.ts` **sem** `output: 'standalone'` | **Adicionar** para self-host enxuto |
| Middleware/Proxy | **`proxy.ts`** na raiz (convenção do Next 16 que substitui `middleware.ts`): faz refresh de sessão Supabase (`updateSession` em `lib/supabase/auth-sessions.ts`) **e roda Prisma** (`profile.findUnique` p/ checar role) em rotas protegidas/backoffice → **runtime Node** | Funciona no self-host via standalone (é empacotado no build); sem dependência de Edge da Vercel. Executa em **toda request** casada pelo `matcher` |
| API routes | Nenhuma fixa `runtime='edge'` / `maxDuration` → tudo Node padrão | Roda direto no VPS |
| Crons | `vercel.json` com 2 jobs (dispatch a cada 5min; reset-credits mensal) que validam `Authorization: Bearer ${CRON_SECRET}` | **Substituir** pelo agendador do Coolify |
| Storage | 100% Supabase Storage; **sem escrita em disco local** | Sem preocupação de volume/disco |
| Integrações | Asaas, Resend, Meta, Google OAuth, Sentry — todas via HTTPS de saída | VPS precisa liberar saída HTTPS |
| Observabilidade/Logs | Hoje runtime logs vistos no painel da Vercel. Sentry **já** com `enableLogs: true` + `consoleLoggingIntegration` (todos os níveis) em **server/edge** → 100% dos `console.*` do servidor já vão ao Sentry Logs (não só erros) | Sentry Logs **independe do host**; perde-se só o *viewer* da Vercel → substituído por Coolify container logs. (Ver §4) |
| Vercel-específico | `@vercel/analytics` no `app/layout.tsx`; Sentry `automaticVercelMonitors: true`; deploy via `vercel` CLI no GitHub Actions | Ajustes pequenos |
| Banco | Supabase Postgres via `DATABASE_URL` (pooler) + `DIRECT_URL` | **Sem mudança** |

### O que NÃO muda
Supabase (DB/Auth/Storage), Prisma, todo o código de integrações, e — por manter o mesmo domínio — os valores das env vars (incl. `NEXT_PUBLIC_APP_URL`), URLs de webhook e redirects OAuth.

---

## 3. Webhooks (validado no código — 8 rotas em `app/api/webhooks/**`)

Ponto-chave: o **`proxy.ts` ignora `/api/webhooks/**` por completo** (`if (pathname.startsWith('/api/webhooks')) return NextResponse.next()`). Logo, **nenhum webhook depende de sessão Supabase** — todos funcionam idênticos no self-host. Cada rota valida do seu jeito:

| Webhook | Endpoint | Verificação | Depende de |
|---|---|---|---|
| **Asaas** | `/api/webhooks/asaas` | header `asaas-access-token` == `ASAAS_WEBHOOK_TOKEN` | **env** |
| **Resend** | `/api/webhooks/resend` | assinatura **Svix** (`svix-id` / `svix-timestamp` / `svix-signature`) via `RESEND_WEBHOOK_SECRET` | **env** |
| **Meta (produto)** | `/api/webhooks/meta` | GET: `hub.verify_token` == `META_VERIFY_TOKEN`; POST: HMAC `x-hub-signature-256` com `META_APP_SECRET` (`MetaLeadService.validateWebhookSignature`) | **env** |
| **Meta (backoffice)** | `/api/webhooks/backoffice/meta/[token]/lead` | token no **path**, validado no **banco** (token de adesão/integração) | DB |
| **Studio (s/ token)** | `/api/webhooks/studio/[teamId]` | `teamId` no path; valida time no **banco** | DB |
| **Studio (c/ token)** | `/api/webhooks/studio/[teamId]/[token]` | `teamId` + token no path, validados no **banco** | DB |
| **Studio (raiz)** | `/api/webhooks/studio` | só devolve instrução de uso (helper, sem processamento) | — |
| **3CPlus** | `/api/webhooks/3cplus` | **stub sem verificação** — apenas loga e retorna 200 | — |

Implicações:

- **Webhooks por env** (Asaas, Resend, Meta): replicar os **mesmos valores** no Coolify — `ASAAS_WEBHOOK_TOKEN`, `RESEND_WEBHOOK_SECRET`, `META_VERIFY_TOKEN`, `META_APP_SECRET`. Como o **domínio é o mesmo**, as URLs cadastradas nos painéis Asaas/Resend/Meta **não mudam**.
- **Webhooks por token de banco** (studio, backoffice-meta): **nada a fazer** — o banco (Supabase) é o mesmo.
- **3CPlus**: stub, sem impacto.
- **Atenção (assinatura × raw body):** Resend (Svix) e Meta (HMAC) validam sobre o **corpo bruto** da request. O reverse proxy do Coolify (**Traefik**) repassa o body intacto, então funciona — mas **incluir no smoke test** um evento real de Resend e de Meta para confirmar que a assinatura valida atrás do Traefik.

---

## 4. Observabilidade e Logs (requisito: 100% dos logs no Sentry)

**O envio de 100% dos logs do servidor para o Sentry JÁ está implementado** — não é preciso construir do zero, e funciona **independente da Vercel**.

Estado atual (validado):

- `sentry.server.config.ts` e `sentry.edge.config.ts`: `enableLogs: true` **+** `Sentry.consoleLoggingIntegration({ levels: ["log","info","warn","error","debug"] })`. Logo, **todo `console.info/warn/error/...` do servidor já vira Sentry Log**, não apenas exceções. Conectado via `instrumentation.ts` (`register()` importa `sentry.server.config` no runtime Node).
- O que hoje se vê "na Vercel" são os **runtime logs** (stdout) do painel da Vercel — isso é só um *viewer*; os logs em si já estão indo ao Sentry pelo SDK.

O que muda na migração:

- **Perde-se o viewer de runtime logs da Vercel.** Substitutos no self-host (somam, não competem):
  1. **Coolify container logs** (stdout/stderr no painel do Coolify) — equivalente direto ao log tail da Vercel; retenção limitada/efêmera.
  2. **Sentry Logs** — já recebe 100% dos console logs do servidor; vira o store **central, pesquisável e com retenção**, no mesmo lugar dos erros. Atende ao requisito "100% no Sentry".
- **Nenhuma mudança de código é necessária para os logs do servidor** — basta as env vars do Sentry estarem no Coolify (`NEXT_PUBLIC_SENTRY_DSN` no build+runtime; `SENTRY_AUTH_TOKEN` no build p/ sourcemaps).

Gap encontrado (corrigir se quiser 100% **também do browser**):

- A config de cliente **ativa** é `instrumentation-client.ts` (convenção Next 15+) e ela tem `enableLogs: true` mas **NÃO** inclui `consoleLoggingIntegration` — então `console.*` do **browser** não está sendo capturado. Quem tem o console integration é o `sentry.client.config.ts` (**legado**, provavelmente ignorado quando `instrumentation-client.ts` existe).
- Correção: adicionar `Sentry.consoleLoggingIntegration({ levels: [...] })` ao `instrumentation-client.ts` e **remover a duplicação** com `sentry.client.config.ts`. (Item opcional em §6; só impacta logs de browser, não os de servidor.)

Caveats no self-host:

- **Flush:** num processo Node persistente (standalone), o SDK agrupa e envia logs continuamente — funciona bem (melhor que serverless).
- **Volume/custo:** mandar `info`+`debug` a 100% gera **alto volume no Sentry Logs** (ex.: `/api/webhooks/3cplus` loga **todos os headers + body**; o `proxy.ts` loga em várias rotas). Revisar a **quota/plano de Logs do Sentry** e considerar remover `debug` em produção. O requisito pede 100% → trade-off consciente de custo.

---

## 5. Stack recomendada na Hostinger

- **VPS KVM 2** (2 vCPU, 8 GB RAM, 100 GB NVMe). Motivo: `next build` do Next 16 + upload de sourcemaps Sentry + Coolify (que roda Docker e serviços próprios) consomem memória; 4 GB (KVM 1) arrisca OOM no build. *(KVM 1 só é viável com swap — não recomendado.)*
- **OS/Template:** Ubuntu 24.04 LTS com **template Coolify (1-clique)** da Hostinger.
- **Build pack:** **Dockerfile** (mais confiável para Bun + Prisma + Next standalone do que o autodetect do Coolify).

---

## 6. Mudanças de código necessárias (aplicar quando autorizado)

> Estas alterações vão para uma branch e seguem o fluxo normal de PR. Não aplicar direto em `main`/`develop`.

### 6.1. `next.config.ts`
- Adicionar `output: 'standalone'` ao `nextConfig` (gera `.next/standalone/server.js`). O **`proxy.ts` é empacotado automaticamente** no standalone (middleware Node roda no mesmo processo).
- Trocar `automaticVercelMonitors: true` → `false` (no bloco `webpack` do `withSentryConfig` — recurso só-Vercel).
- `cacheComponents: true`, `serverExternalPackages: ['unzipper']`, `turbopack` e `tunnelRoute: '/monitoring'` permanecem (funcionam em standalone).
- **Validação de env no build:** `next.config.ts` faz `process.exit(1)` se faltar env, exceto quando `CI=true` → por isso o Dockerfile seta `CI=true` no build.

### 6.2. `Dockerfile` (novo, multi-stage) — esboço
```dockerfile
# ---- deps + build ----
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# NEXT_PUBLIC_* precisam existir no BUILD (sao inlinados no bundle)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_ENCRYPTION_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_ENCRYPTION_KEY=$NEXT_PUBLIC_ENCRYPTION_KEY \
    CI=true
RUN bun run build      # = prisma generate && next build

# ---- runner ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```
- **Gotcha Prisma:** garantir `binaryTargets` em `prisma/schema.prisma` compatível com a imagem runner (ex.: `["native","debian-openssl-3.0.x"]` para `node:slim`) e que o engine/cliente gerado seja incluído (o tracing do standalone normalmente cobre, mas validar). Já existe `@prisma/adapter-pg` — checar `engineType`.
- **Gotcha standalone:** `public/` e `.next/static/` **não** são copiados automaticamente para `.next/standalone` — copiar manualmente (acima).
- **`.dockerignore`** (novo): `node_modules`, `.next`, `.git`, `.env*`, etc.

### 6.3. Substituir os crons da Vercel
- As rotas já existem e validam `Bearer ${CRON_SECRET}` — **mantê-las**.
- Remover `vercel.json` no cutover.
- Criar 2 **Scheduled Tasks** no Coolify (ou crontab do host):
```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://<dominio>/api/v1/email/cron/dispatch-scheduled      # */5 * * * *
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://<dominio>/api/v1/email/cron/reset-credits           # 0 3 1 * *
```

### 6.4. `@vercel/analytics` (opcional, baixa prioridade)
Remover o import + `<Analytics/>` do `app/layout.tsx` (não reporta fora da Vercel) ou trocar por self-hosted (Umami/Plausible via Coolify).

### 6.5. CI/CD (GitHub Actions)
Nos workflows `ci-develop.yml` / `ci-main.yml`, remover os passos `vercel deploy` e os secrets `VERCEL_*`. Manter os jobs de `typecheck` / `lint` / `governance`. Deploy passa a ser automático pelo **GitHub App do Coolify** no push (ou via webhook de deploy do Coolify).

### 6.6. Health check (opcional)
Adicionar `GET /api/health` retornando 200 para o Coolify monitorar (mais limpo que checar `/`).

### 6.7. Logs do browser no Sentry (opcional — ver §4)
Consolidar a config de cliente em `instrumentation-client.ts` adicionando `Sentry.consoleLoggingIntegration({ levels: ["log","info","warn","error","debug"] })` e remover o legado `sentry.client.config.ts`. **Não** é necessário para os logs do servidor (já capturados).

---

## 7. Provisionar Hostinger + Coolify

1. Contratar **VPS KVM 2**; no wizard escolher o **template Coolify** (Ubuntu 24.04).
2. Acessar o painel do Coolify (`http://<ip-do-vps>:8000`), criar admin, concluir onboarding. **Endurecer:** firewall (UFW), senha forte, atualizar o sistema.
3. **Projeto → Environment (production) → Application** → fonte: repositório GitHub (instalar o **GitHub App do Coolify** e liberar o repo). Branch de produção (ex.: `main`).
4. Build pack: **Dockerfile**. Porta: **3000**.
5. **Env vars** (colar todas): Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), `DATABASE_URL`, `DIRECT_URL`, Asaas (`ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`), Resend (`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`), Meta (`META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_VERIFY_TOKEN`), Google OAuth, Sentry, chaves de `ENCRYPTION`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL=https://<dominio-atual>`. Conferir contra `lib/env/validation.ts` (validador de env do projeto). **Marcar os `NEXT_PUBLIC_*` (e `SENTRY_AUTH_TOKEN`, se subir sourcemaps) como _Build Variable_** para existirem no `next build`.
6. **Domínio temporário** primeiro (URL gerada pelo Coolify / sslip.io) para testar antes de mexer no DNS.
7. **Deploy** e acompanhar o build. Resolver eventuais ajustes de Prisma (binaryTarget/engine).
8. Criar as **2 Scheduled Tasks** (crons de §6.3).

---

## 8. Cutover (mantendo o mesmo domínio)

Como o domínio é o mesmo e só o DNS muda, **webhooks, OAuth e `NEXT_PUBLIC_APP_URL` não mudam** — quase zero reconfiguração externa.

1. Testar a fundo na URL temporária do Coolify: login/sessão Supabase, carregar páginas com dados (Prisma), disparo manual do cron, webhook de sandbox.
2. **Reduzir o TTL** do DNS do domínio (ex.: 300s) ~1 dia antes.
3. No Coolify, anexar o **domínio de produção** à app e deixar emitir **SSL Let's Encrypt** (o ACME http-01 exige DNS já apontando — planejar janela curta).
4. Trocar o **A record** do domínio: da Vercel → **IP do VPS** (apex em A; `www`/subdomínio em A/AAAA). Remover o CNAME `cname.vercel-dns.com`.
5. Aguardar propagação; validar HTTPS + app no domínio real.
6. `NEXT_PUBLIC_APP_URL`: **sem mudança** (mesmo domínio).
7. **Supabase Auth** (Site URL / Redirect URLs): **sem mudança** (mesmo domínio) — apenas conferir que não dependem de URL de preview da Vercel.
8. **Webhooks** (ver §3): mesmo domínio → **URLs inalteradas**, sem reconfigurar painéis. Garantir que os secrets por env (`ASAAS_WEBHOOK_TOKEN`, `RESEND_WEBHOOK_SECRET`, `META_VERIFY_TOKEN`, `META_APP_SECRET`) foram colados no Coolify.
9. **Google OAuth** (redirect URIs): **sem mudança**.
10. Manter o projeto Vercel pausado por alguns dias como rollback; depois descomissionar.

---

## 9. Verificação (end-to-end)

- Build conclui no Coolify; container **healthy**.
- App abre na URL temporária com **HTTPS válido**.
- **Login Supabase** funciona (cookies setados, sessão persiste) — requer HTTPS (Coolify provê).
- Cron manual: `curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/v1/email/cron/dispatch-scheduled` → **200**.
- **Webhook smoke test** (atrás do Traefik): evento de sandbox da **Asaas** (token), evento de teste do **Resend** (assinatura Svix) e do **Meta** (HMAC `x-hub-signature-256`) chegam e **passam na validação de assinatura**.
- Página que consulta dados (Prisma → Supabase) carrega.
- **Sentry**: confirmar não só **Issues** (erros), mas **Logs** recebendo `console.info` de fluxo do servidor (ex.: disparar uma rota e ver o log aparecer em Sentry → Logs). Conferir também os **Coolify container logs** (stdout) como tail rápido.
- Pós-DNS: domínio real serve com SSL e tudo acima repete em produção.

---

## 10. Rollback
Repontar o **A record** de volta para a Vercel (projeto ainda existe) → reversão em ~1 TTL.

---

## 11. Custos e trade-offs

- **Vercel hoje:** ~R$200/mês → **Hostinger KVM 2:** ~R$75–90/mês (Coolify é grátis). Supabase inalterado. Economia ~50–60%.
- **Trade-off:** você assume ops — patches de SO, backups e uptime de um VPS único (sem auto-scaling/redundância). Mitigações: **ativar snapshots/backups automáticos** do VPS na Hostinger, monitorar RAM/CPU, Coolify renova SSL sozinho.
- **Email:** envio é via API Resend (não SMTP do VPS) → reputação de IP do VPS não afeta entregabilidade.

---

## 12. Riscos / atenções

- `NEXT_PUBLIC_*` ausentes no build → valores vazios "queimados" no bundle. Marcar como **Build Variable**.
- Sourcemaps Sentry no build exigem `SENTRY_AUTH_TOKEN` no build (ou desativar upload).
- Prisma em Docker: `binaryTargets`/engine corretos para a imagem runner.
- Memória de build: usar KVM 2 (8 GB) ou adicionar swap.
- Após o cutover, **remover `vercel.json`** para não haver dois agendadores disparando os crons.
- **`proxy.ts` roda em toda request** (refresh de sessão Supabase + Prisma em rotas protegidas/backoffice). Esse custo de CPU/DB que hoje a Vercel distribui passa a recair no **VPS único** — ok para a carga atual no KVM 2, mas monitorar latência/CPU e a conexão com o pooler do Supabase.
- `cacheComponents: true` usa cache em memória no processo; com **1 container/instância** funciona. Se um dia escalar para múltiplos containers, será necessário um cache handler compartilhado (ex.: Redis) — sem ação agora.
