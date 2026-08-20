# Coolify — imagem de produção (esqueleto)

Status: **esqueleto**. Nada aqui está validado contra um build real.
Esta pasta existe para que a implementação, quando acontecer, já comece com as
armadilhas mapeadas em vez de descobri-las uma a uma no `docker build`.

Contexto e decisões: nota do vault `Corretor studio/Operações/Migração Self-Hosted — Plano (2026-08)`.

## Arquivos

| Arquivo | O que é |
|---|---|
| `Dockerfile` (raiz) | Multi-stage: `deps` (bun) → `builder` (bun) → `runner` (node) |
| `.dockerignore` (raiz) | Contexto enxuto e, principalmente, zero `.env` na imagem |
| `.github/workflows/build-image.yml` | Build + push GHCR. **Inerte** — só `workflow_dispatch` |

## Desenho

Uma imagem, dois comandos:

```
ghcr.io/matheuswillock/lead-flow-app:<sha>-<env>
  ├── node server.js          → container "app"
  └── node workers/index.js   → container "worker"   (a criar na migração BullMQ)
```

### Version skew

Não fazer duas imagens. Na Vercel Queues, o *deployment pinning* garantia
acidentalmente que uma mensagem fosse consumida pelo mesmo deploy que a
publicou — publisher e consumer nunca divergiam de versão.

O BullMQ **não tem isso**: o worker processa o que estiver no Redis, tenha sido
publicado por qual versão for. Uma imagem só, deployada nos dois containers a
partir da mesma tag, elimina o risco por construção.

Regra decorrente, para o time: **nunca remover um campo de payload no mesmo
release em que se para de publicá-lo.** Sempre em dois passos.

## Armadilhas

Mapeadas contra o código em 2026-08-19. Cada uma tem um `TODO`/comentário
correspondente no `Dockerfile`.

### 1. `next.config.ts` mata o build por env faltando

```ts
if (process.env.CI !== 'true') {
  const envValidation = validateEnv();
  if (!envValidation.isValid) { ...; process.exit(1); }
}
```

Sem `ENV CI=true` no stage de build, o `docker build` exige segredos de
**runtime** (`DATABASE_URL`, `ASAAS_API_KEY`, ...) que não devem existir na
imagem. Solução: `ENV CI=true` no builder.

### 2. `postinstall` roda `hooks:install`

```json
"postinstall": "prisma generate && bun run hooks:install"
```

`install-git-hooks.ts` não encontra `.git` dentro do container. Solução:
`bun install --ignore-scripts` + `bunx prisma generate` explícito.

### 3. O build precisa de Bun, o runtime não

`build:sw` usa `Bun.build()` (`scripts/build-service-worker.ts`) para gerar
`public/sw.js`. Builder = `oven/bun`. Runtime = `node:24-slim` — a governança
proíbe `Bun.*` em `app/**` e `lib/**`, então o servidor roda Node puro.

### 4. `NEXT_PUBLIC_*` é inlinado no bundle — a imagem é do ambiente

9 variáveis entram no JS do cliente em build time:

```
NEXT_PUBLIC_APP_URL            NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_API_URL            NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SENTRY_DSN         NEXT_PUBLIC_ENCRYPTION_KEY
NEXT_PUBLIC_REALTIME_DISABLED  NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
NEXT_PUBLIC_BETHANIA_WHATSAPP_NUMBER
```

Trocar a env no Coolify **não muda nada** no JS já compilado.

Decisão tomada: **um job de build por ambiente**, mesmo SHA, tags
`<sha>-staging` e `<sha>-prod`. Descartadas: runtime env injection via
`window.__ENV__` (refatorar 9 call sites no meio de uma migração de infra) e
staging apontando para o Supabase de produção (suja dados reais).

Consequência aceita: promover staging → prod é **rebuild do mesmo SHA**, não
retag. O que importa — rollback dentro do mesmo ambiente continua sendo retag —
fica preservado.

### 5. Sentry sobe source maps no build

`withSentryConfig` com `widenClientFileUpload: true` exige `SENTRY_AUTH_TOKEN`.
É **build secret**: BuildKit `--mount=type=secret`, nunca `ARG` (ARG fica no
histórico de layers da imagem).

### 6. `output: 'standalone'` não copia tudo

- **`output: 'standalone'` ainda não existe em `next.config.ts`.** Adicionar
  antes de usar o Dockerfile, senão o `runner` não acha `server.js`.
- O standalone gera `server.js` mas não leva `.next/static` nem `public/` —
  copiar explicitamente.
- `next/image` (7 usos) precisa de `sharp` no runtime.
- `empty-module.js` (alias de `@aws-sdk/client-s3` em `turbopack.resolveAlias`)
  precisa existir na raiz: no Next 16 o Turbopack é o bundler do `next build`,
  então o alias vale em produção, não só em dev.
- `openssl` no runner não é opcional — engine do Prisma depende dele.

## Coolify — do lado do servidor

- Fonte da aplicação: **Docker Image**, não Git. O Coolify só faz `pull` + `up`.
  Isso mantém o `next build` (2,5–4 GB de heap) fora da máquina de produção.
- Registry privado GHCR: PAT com `read:packages`.
- **Healthcheck em uma rota que NÃO toca o banco.** Uma instabilidade do
  Supavisor não pode fazer o Coolify matar e reiniciar o container em loop.
  Liveness ≠ readiness do banco. As rotas de health existentes
  (`/api/v1/backoffice/bot/host/health`) são autenticadas e checam dependências
  — não servem para isso.
- **Nada de migração no boot.** Migração é Supabase CLI, fora do deploy.
- Worker: sem porta exposta, sem healthcheck HTTP, `restart: unless-stopped`.

## Não fazer ainda

- Não remover os `export const maxDuration` das rotas. Fora da Vercel viram
  no-op inofensivo, e eles precisam continuar lá para o código voltar à Vercel
  sem edição durante a janela de rollback.
- Não adicionar gatilho de `push` em `build-image.yml` antes do Dockerfile
  buildar limpo localmente.
