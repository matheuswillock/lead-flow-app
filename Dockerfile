####################################################################
# ESQUELETO — Imagem de produção para Coolify (Vercel → self-hosted)
#
# NÃO ESTÁ PRONTO PARA USO. Cada bloco `TODO` corresponde a uma das
# armadilhas mapeadas em `deploy/coolify/README.md` §Armadilhas.
# Validar uma a uma antes de subir qualquer coisa em produção.
#
# Contexto de build: raiz do repositório.
# Uma única imagem serve app e worker — o comando é sobrescrito no
# Coolify. Isso é proposital: garante que publisher e consumer de fila
# rodem sempre a mesma versão (ver README §Version skew).
####################################################################


####################################################################
# Stage 1 — deps
####################################################################
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma

# Armadilha 2: `postinstall` roda `prisma generate && bun run hooks:install`.
# `install-git-hooks.ts` não encontra `.git` dentro do container.
# `--ignore-scripts` evita isso; o `prisma generate` é chamado explicitamente
# no stage de build.
RUN bun install --frozen-lockfile --ignore-scripts


####################################################################
# Stage 2 — builder
####################################################################
FROM oven/bun:1 AS builder
WORKDIR /app

# Armadilha 1: `next.config.ts` chama `validateEnv()` e faz `process.exit(1)`
# quando `CI !== 'true'`. Sem isso o build exige segredos de RUNTIME
# (DATABASE_URL, ASAAS_API_KEY, ...) que não devem existir na imagem.
ENV CI=true
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bunx prisma generate

# Armadilha 4: `NEXT_PUBLIC_*` são inlinados no bundle do cliente em build time.
# A imagem resultante é ESPECÍFICA DO AMBIENTE — trocar a env no Coolify não
# muda nada no JS já compilado. Por isso o CI builda duas vezes o mesmo SHA
# (tags `<sha>-staging` e `<sha>-prod`).
# TODO: confirmar a lista completa contra `lib/env.ts` antes de usar.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_ENCRYPTION_KEY
ARG NEXT_PUBLIC_REALTIME_DISABLED
ARG NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_BETHANIA_WHATSAPP_NUMBER

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_ENCRYPTION_KEY=$NEXT_PUBLIC_ENCRYPTION_KEY
ENV NEXT_PUBLIC_REALTIME_DISABLED=$NEXT_PUBLIC_REALTIME_DISABLED
ENV NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_BETHANIA_WHATSAPP_NUMBER=$NEXT_PUBLIC_BETHANIA_WHATSAPP_NUMBER

# Armadilha 3: `build:sw` usa `Bun.build()` (scripts/build-service-worker.ts)
# para gerar `public/sw.js`. Por isso o builder é `oven/bun`, não `node`.
# O runtime continua Node puro — a governança proíbe `Bun.*` em app/** e lib/**.
#
# Armadilha 5: `withSentryConfig` com `widenClientFileUpload: true` sobe source
# maps e exige SENTRY_AUTH_TOKEN. É BuildKit secret, nunca ARG (ARG fica no
# histórico de layers da imagem).
#
# TODO: `output: 'standalone'` ainda NÃO está em next.config.ts. Adicionar antes
# de usar este Dockerfile, senão o stage `runner` não encontra `server.js`.
RUN --mount=type=secret,id=sentry,env=SENTRY_AUTH_TOKEN \
    bun run build:sw && bunx next build


####################################################################
# Stage 3 — runner
####################################################################
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# `openssl` não é opcional: o engine do Prisma depende dele. É a causa nº 1 de
# "funciona local, quebra no container".
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Armadilha 6: `output: 'standalone'` gera `server.js` mas NÃO copia
# `.next/static` nem `public/`. Precisa ser explícito.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# TODO(armadilha 6): `next/image` (7 usos) precisa de `sharp` no runtime.
# Confirmar se o standalone já traça a dependência; se não, instalar aqui.
#
# TODO(armadilha 6): confirmar que `empty-module.js` (turbopack.resolveAlias
# de @aws-sdk/client-s3 em next.config.ts) existe na raiz. No Next 16 o
# Turbopack é o bundler do `next build`, então o alias vale em produção.

USER node
EXPOSE 3000

# App. O container de worker sobrescreve para `node workers/index.js`
# (a criar na fase de migração das filas para BullMQ).
CMD ["node", "server.js"]
