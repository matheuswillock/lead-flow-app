# Análise dos Logs de Produção

**Fonte:** `corretor-studio-log-export-2026-07-02T14-31-40.json` — 214.485 entradas, período 2026-06-29 14:32 UTC a 2026-07-02 14:31 UTC (3 dias), ambiente `production` (www.corretorstudio.com).

## Visão geral

| Métrica | Valor |
|---|---|
| Total de entradas | 214.485 |
| Erros (`level=error`) | 411 |
| Warnings | 32 |
| Tipos | middleware 97.474 · function 57.417 · static 39.978 · external 15.455 · cache 3.999 |
| Cache Vercel | MISS 122.656 (64%) · HIT 69.097 · BYPASS 18.264 · PRERENDER 3.091 |
| Status HTTP | 200: 180.397 · 304: 24.174 · **429: 5.284** · 404: 1.012 · 403: 673 · 400: 388 · 307: 328 · 500: 256 · **504: 130** |

## Achado sistêmico 1 — Functions em `iad1`, banco em São Paulo (P0)

- Todas as invocações de function analisadas (ex.: 13.150x `features/access`) rodam em **`iad1` (Virgínia, EUA)**.
- O banco (Supabase) está em **`aws-1-sa-east-1`** (São Paulo), conforme `DATABASE_URL` (`aws-1-sa-east-1.pooler.supabase.com`).
- Não existe `preferredRegion` em nenhuma rota nem configuração de região no `vercel.json`.
- Consequência: cada query Prisma paga ~130–150ms de RTT intercontinental. Rotas com 10–30 queries sequenciais acumulam segundos de latência **fixa**, independente de carga.
- Evidência nos logs: p50 de `features/access` é **estável em ~6,2–6,5s em todas as horas do dia**, inclusive 04h–09h UTC com tráfego mínimo (n=62–83/h). Não é cold start (seria outlier, não mediana) nem carga (não varia com volume). O p95 sobe com carga (25s às 13h UTC) — aí sim contenção de pool.

## Achado sistêmico 2 — Esgotamento do pool de conexões Prisma (P0)

Erros `Timed out fetching a new connection from the connection pool` em rajadas correlacionadas com picos de tráfego:

| Hora (UTC) | Erros de pool |
|---|---|
| 2026-06-30 20h | 28 |
| 2026-07-01 19h | 6 |
| 2026-07-02 11h | 7 |
| 2026-07-02 12h | 14 |
| **2026-07-02 13h** | **115** |

Queries afetadas: `profile.findUnique`, `team.findUnique`, `teamMember.findMany/findUnique`, `emailLog.create`, `teamTransferRoute.findMany`, `backofficeUserSubscription.findMany`, `teamWhatsAppConfig.findFirst`, `lead.findUnique`.

Fatores combinados: latência intercontinental faz cada request segurar conexão por muito mais tempo; `PrismaClient` sem `connection_limit` explícito; rotas lentas (webhook de 300s) seguram conexões.

## Achado sistêmico 3 — Latência p50 alta em todas as rotas de API

Top rotas por volume (function, com `durationMs`):

| Rota | Chamadas (3 dias) | p50 | p95 |
|---|---|---|---|
| GET /api/v1/features/access | 13.150 | 6,3s | 12,2s |
| GET /api/v1/notifications | 7.362 | 4,0s | 10,7s |
| GET /api/v1/leads/:id/details | 3.282 | 6,4s | 19,4s |
| GET /api/v1/bot/link/status | 1.794 | 1,4s | 3,2s |
| GET /api/v1/integrations/bootstrap | 1.568 | 1,8s | 5,5s |
| GET /api/v1/teams/:id/whatsapp/conversations | 1.266 | 4,0s | 17,1s |
| GET /api/v1/teams/:id/status-rules | 908 | 3,8s | 11,7s |
| GET /api/v1/teams/:id/crm/filter-presets | 895 | 3,9s | 11,7s |
| GET /api/v1/leads | 868 | 3,2s | 8,8s |
| GET /api/v1/teams | 750 | 4,8s | 13,6s |
| GET /api/v1/teams/:id/members | 742 | 6,1s | 17,9s |

Piores p95 (n≥20): webhook Evolution 300s (timeout), `teams/:id/whatsapp/config` 31s, `whatsapp/unread-count` 29s, `email/templates/:id` 29s, `leads/:id/schedule` 27s, `whatsapp/usage` 27s, `calendar/availability` 25s.

## Achado 4 — Webhook Evolution: timeouts de 300s (P0)

- `POST /api/webhooks/whatsapp/evolution/:token`: 463 invocações, p50 2s, **p95 = 300s**.
- 32 ocorrências de `Vercel Runtime Timeout Error: Task timed out after 300 seconds` e 91 respostas 504.
- Correlação por requestId: os timeouts acontecem em eventos **`CONTACTS.UPDATE` (15) e `CONTACTS.UPSERT` (14)** — sync de contatos em massa processado sincronicamente dentro do webhook.
- Efeito colateral: cada execução de 300s segura conexão do Prisma, alimentando o esgotamento do pool.

## Achado 5 — Polling agressivo do frontend

- `features/access`: até **17 requests/minuto** no pico; média de 4,3/min em minutos ativos. É a rota mais chamada do sistema (26,5k requests contando middleware).
- `notifications`: até **30 requests/minuto** no pico; média 2,4/min.
- Ambas sem cache (respostas dinâmicas por usuário, p50 4–6s cada).

## Achado 6 — Sentry tunnel `/monitoring` sobrecarregado

- 30.823 requests em 3 dias — o caminho mais acessado de todo o domínio.
- **2.641 respostas 429** (rate limit do ingest Sentry): volume de eventos/replays do client acima da cota.
- Custo indireto: tráfego de middleware/edge e banda do usuário.

## Achado 7 — Crons em deployments antigos

- `notifications/cron/meeting-reminders` roda a cada 1 minuto (`vercel.json`) — 8.117 invocações no deployment atual, mas também 2.691 + 755 + 610 + ... em **deployments anteriores** (URLs `corretor-studio-*.vercel.app` distintas), indicando execuções duplicadas durante janelas de troca de deployment ou crons ativos em deployments que não são mais produção.
- `lead-status-batch` teve p95 de 60s e 50s em alguns deployments — cron pesado competindo pelo mesmo pool.

## Achado 8 — Erros por rota (top)

| Rota | Erros |
|---|---|
| /api/v1/leads/:id/details | 63 |
| /api/v1/features/access | 58 |
| /api/webhooks/whatsapp/evolution/:hash | 41 |
| /api/v1/notifications | 32 |
| /api/v1/leads/:id | 22 |
| /api/v1/calendar/availability | 17 (15 falhas Google Calendar `freeBusy`) |
| /api/v1/integrations/lead-form | 16 |

Outros erros relevantes: `EVO_API_BASE_URL is not set` (9x — env ausente em runtime), `Invalid Refresh Token` Supabase (8x), DeprecationWarning `url.parse()` (50x).

## Tráfego de páginas (SSR/middleware)

| Página | Requests |
|---|---|
| `/` (landing) | 4.999 |
| `/lead-form/:id` | 3.019 |
| `/:id/crm` | 2.260 |
| `/:id/dashboard` | 2.126 |
| `/:id/pme-simulador` | 1.871 |
| `/:id/calendar` | 1.864 |
| `/:id/docs` | 1.843 |
| `/:id/performance` | 1.789 |
| `/:id/whatsapp` | 1.217 |
| `/:id/carteira` | 1.044 |
| `/:id/email/*` (5 rotas) | ~3.900 |

SSR do `lead-form`: p50 4,0s / p95 23,5s — crítico por ser página pública de conversão embedável.
