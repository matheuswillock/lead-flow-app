# Supabase — corretor-studio-evolution

Projeto Supabase **dedicado** ao banco Postgres da [Evolution API](https://evolution-api.com). O Lead Flow principal usa [`supabase/`](../supabase/) — este diretório é independente.

## Projeto remoto

| Campo | Valor |
|-------|-------|
| Nome | `corretor-studio-evolution` |
| Project ref | `kzwzgkfgynfwodjmfdli` |
| Região pooler | `aws-1-sa-east-1` |
| URL | `https://kzwzgkfgynfwodjmfdli.supabase.co` |

A Evolution API **não usa** Supabase Auth/Storage hoje — apenas Postgres via pooler. O schema Prisma é `evolution_api` (criado automaticamente na subida do container).

## Linkar o CLI

```bash
supabase link --project-ref kzwzgkfgynfwodjmfdli --workdir supabase-evolution
```

Verificar status:

```bash
bun run evo:db:status
```

## Conexão Postgres (Evolution)

Configure em `.env.evolution` (copie de [`.env.evolution.example`](../.env.evolution.example)):

| Variável | Pooler | Porta | Uso |
|----------|--------|-------|-----|
| `DATABASE_CONNECTION_URI` | Session | 5432 | Migrations Prisma |
| `DATABASE_BOUNCER_CONNECTION_URI` | Transaction | 6543 | Queries da API (`pgbouncer=true`) |

`DATABASE_PROVIDER=psql_bouncer`

Senha: dashboard Supabase → **Project Settings → Database**.

## Referência Auth (futuro)

Variáveis documentadas no example — **não commitar valores reais**:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_JWKS_URL`

## VPS Hostinger — migração da stack antiga

Se a VPS ainda tinha Postgres no Docker:

```bash
docker compose -f docker-compose.evolution.yml --env-file .env.evolution down -v
docker volume rm evolution_postgres 2>/dev/null || true
bun run evo:up
bun run evo:logs   # confirmar migrations sem erro
```

Na VPS, em `.env.evolution`:

- Preencher `[PASSWORD]` nas URIs Supabase
- `EVOLUTION_API_BIND=127.0.0.1:8080` (Caddy faz HTTPS — ver `deploy/hostinger/Caddyfile`)
- `SERVER_URL=https://evo.corretorstudio.com`
- `AUTHENTICATION_API_KEY` forte (= `EVO_API_KEY` no app)

Deploy completo: [`deploy/hostinger/README.md`](../deploy/hostinger/README.md)

No app Lead Flow (produção):

- `EVO_API_BASE_URL=https://<URL-EVOLUTION>`
- `EVO_WEBHOOK_PUBLIC_URL` = URL pública do app

**Nota:** instâncias WhatsApp no volume local antigo não migram — será necessário novo QR scan.
