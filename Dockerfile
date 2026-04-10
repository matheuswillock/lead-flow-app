# syntax=docker/dockerfile:1
# =============================================================================
# Lead Flow — Multi-stage Dockerfile
#
# Stage 1 (deps):    instala dependências com Bun
# Stage 2 (builder): compila o Next.js (bun run build = prisma generate + next build)
# Stage 3 (runner):  imagem mínima Alpine com standalone output, sem node_modules completo
#
# Build via CI (ci-main.yml / ci-develop.yml) com build-args para variáveis NEXT_PUBLIC_*.
# Runtime: variáveis servidas pelo .env no VPS — nunca baked na imagem.
# =============================================================================

# =============================================================================
# Stage 1: deps — instala dependências
# Node 24 Alpine garante que os binários nativos do Prisma sejam compilados
# para linux-musl (mesma ABI da imagem de runtime).
# =============================================================================
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Instala Bun
RUN npm install -g bun --quiet

# Copia apenas os manifests para maximizar cache de camadas
COPY package.json bun.lock* ./
COPY prisma ./prisma/

# Instala todas as dependências (devDependencies necessárias para prisma generate + next build)
RUN bun install --frozen-lockfile

# =============================================================================
# Stage 2: builder — compila o Next.js
# =============================================================================
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g bun --quiet
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# CI=true → next.config.ts pula a validação de env vars em build-time
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* são embutidos no bundle JavaScript em build-time.
# Passados como build-args no docker build (nunca como secrets de runtime).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_ENCRYPTION_KEY
ARG NEXT_PUBLIC_API_URL=""
ARG RESEND_API_KEY

# bun run build = prisma generate && next build
RUN bun run build

# Inclui assets estáticos e públicos no standalone (necessário para output: 'standalone')
RUN cp -r .next/static .next/standalone/.next/static && \
    cp -r public .next/standalone/public

# =============================================================================
# Stage 3: runner — imagem de produção mínima
# Contém apenas o .next/standalone — todas as dependências rastreadas estão incluídas.
# =============================================================================
FROM node:24-alpine AS runner

# libc6-compat: binários nativos do Prisma em Alpine
# wget: necessário para o healthcheck no docker-compose.yml
RUN apk add --no-cache libc6-compat wget

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# PORT e HOSTNAME lidos pelo server.js do standalone
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Usuário não-root por segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copia o standalone — contém server.js + node_modules rastreados + .next/static + public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

USER nextjs

EXPOSE 3000

# server.js é o entrypoint gerado pelo Next.js standalone
CMD ["node", "server.js"]
