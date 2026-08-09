# Spec: Incidente de Produção 2026-08-09 — Performance, Banco e Aplicação do Radar

**Versão:** 1.1 (B2 revisado em 2026-08-09 com MCP do Supabase autorizado — causa raiz era pool de conexões, não migration ausente)
**Data:** 2026-08-09
**Status:** Não iniciado. B1 confirmado ativo em `origin/main` (release v0.200.0). B2/B3: causa raiz confirmada (pool), correção de código não iniciada.
**Base factual:** `RADAR_AUDIT.md` §9 (leitura obrigatória antes de qualquer estágio).
**Relacionado:** `CRON_OBSERVABILITY_AUDIT.md`/`CRON_OBSERVABILITY_SPEC.md` (mesmo incidente, achado transversal que derruba 21 cron jobs de toda a aplicação — tratado à parte por não ser específico do Radar).

---

## Problema

Auditoria de 24h de logs de produção (2026-08-08→09) identificou 3 causas raiz distintas quebrando funcionalidades do Radar, mais um achado incidental de performance — nenhuma delas relacionada ao incidente de leads fantasma (Fase E, já corrigido em produção) ou ao rename CDP→Radar (Fases R/C/D, já concluídas).

---

## Causa raiz — 4 achados, com file:line exatos (branch `develop` / `origin/main` v0.200.0)

Conteúdo completo de cada achado (B1–B4) está em `RADAR_AUDIT.md` §9 — este spec referencia por ID e foca na correção.

- **B1** — `RadarRepository.countFixedSegmentsSQL` (`RadarRepository.ts:2331-2507`) usa nomes de tabela errados em `$queryRaw` (nomes de model em vez dos nomes físicos mapeados via `@@map`) — quebra `/api/v1/radar/segments` e toda UI que depende de contagem de segmentos fixos.
- **B2** — **[Revisado 2026-08-09 com MCP do Supabase autorizado]** Não é tabela ausente — as 3 tabelas de engajamento existem e as migrations estão aplicadas, confirmado via `execute_sql`/`list_migrations` diretamente no projeto `wcnxwdcoambpfwxwubka`. A causa real é esgotamento/instabilidade do pool de conexões Postgres (P1001 "can't reach database server" e P2024 "timed out fetching connection from pool"), 49 ocorrências em 24h espalhadas quase toda hora do dia — não um evento pontual.
- **B3** — `EmailContactImportUseCase` sincroniza Radar falhando ~100% das vezes (uma das causas possíveis é a mesma de B2 — pool) mas mascara a falha como sucesso HTTP 200, e o log não carrega detalhe correlacionável do erro real.
- **B4** — N+1 em `RadarEngagementBackfillUseCase` (até 1.000 round-trips sequenciais por lote de 500 perfis).

---

## Correções propostas

### B1 — Corrigir os nomes de tabela em `countFixedSegmentsSQL`

Duas opções, em ordem de preferência:

1. **Preferencial:** reescrever `countFixedSegmentsSQL` usando o Prisma Client (`this.db.radarProfile.count(...)`, etc.) em vez de `$queryRaw`, sempre que a contagem não exigir SQL que o Prisma não expresse nativamente. Isso elimina a classe inteira de bug (nomes físicos vs. `@@map`) porque o Client sempre resolve via `@@map` automaticamente. Usar `RadarService.countSegmentsLegacy` (`RadarService.ts:997`) como referência de implementação via Client — ele já faz a mesma contagem corretamente.
2. **Se SQL raw for estritamente necessário** (ganho de performance que o Prisma Client não reproduz): trocar cada identificador pelo nome físico correto — `"RadarProfile"` → `corretor_studio_radar_profiles`, `"RadarIdentity"` → `corretor_studio_radar_identities`, `"RadarSourceLink"` → `corretor_studio_radar_source_links`, `"RadarEvent"` → `corretor_studio_radar_events`, `"RadarConsent"` → `corretor_studio_radar_channel_consents` (note também o nome do model errado, não só a tabela), `"Lead"` → `corretor_studio_leads`. Adicionar um teste de integração que roda a query real contra o banco de teste (não só typecheck) — o bug atual passou por `typecheck`/`lint`/`governance:check` sem ser detectado justamente porque SQL raw é uma string, invisível para essas ferramentas.

Depois da correção, remover ou manter `countSegmentsLegacy` como fallback permanente — decisão do dono do projeto; recomendação é remover quando B1 estiver corrigido e validado, para não manter dois caminhos divergentes de contagem.

**Critério de sucesso:** `/api/v1/radar/segments` retorna 200 com contagens corretas para os 4 requests que hoje falham; latência p95 volta para um valor normal de leitura (não os ~14s observados, que hoje incluem tempo de erro).

### B2 — Mitigar instabilidade do pool de conexões (não é mais migration — já confirmado que schema/migration/banco batem)

**Pré-requisito já cumprido em 2026-08-09:** `bun run db:migrate:status` equivalente rodado via MCP do Supabase (`list_migrations` + `execute_sql` contra `information_schema.tables` no projeto `wcnxwdcoambpfwxwubka`) — as migrations `20260804170650`/`20260804194139` **estão aplicadas** e as 3 tabelas existem com o número de colunas correto. Este achado não precisa mais de confirmação — ver `RADAR_AUDIT.md` §9 B2 para a evidência completa.

**Correção proposta (revisada):**

1. **Curto prazo — `withPrismaRetry` em `loadEngagementWeightsAndConfig`:** envolver o `Promise.all` das 3 queries de engajamento (`RadarRepository.ts:1110-1193`) com o helper já existente em `app/api/infra/data/prisma.ts` (`withPrismaRetry`, já trata `P2024`/`P1001` como erros transitórios) — reduz o impacto de picos passageiros de pool sem exigir mudança de infraestrutura.
2. **Confirmar consistência da `DATABASE_URL` de produção:** 21 das 23 ocorrências de `P2024` neste achado rodaram com `connection_limit: 7` (Prisma sem override, não o `connection_limit=1` recomendado no `.env.example`) — sugere que a env var não estava aplicada de forma consistente em todas as invocações/deploys durante a janela analisada. Confirmar com o dono do projeto se o valor atual na Vercel (`DATABASE_URL` com `connection_limit=1&pool_timeout=20`) está de fato ativo em produção e propagado a um deploy bem-sucedido — esse ajuste já foi identificado e aplicado numa investigação paralela do mesmo incidente (ver `RADAR_AUDIT.md` §9 B2, "Cruzamento com investigação paralela").
3. **Médio prazo:** mesmo com a env var correta, 2 das 23 ocorrências de `P2024` já rodaram com `connection_limit=1` e ainda assim estouraram o pool — indicando que o ajuste de env var sozinho não é suficiente sob a carga atual. Avaliar mitigação estrutural mais ampla (fila/outbox para caminhos de escrita não-críticos, redução de concorrência em crons que competem pelo mesmo pool) — escopo maior que este spec, tratar como item de discussão com o dono do projeto, não uma correção deste ciclo.

**Critério de sucesso:** `RadarRepository.loadEngagementWeightsAndConfig()` para de lançar erro em produção; volume de `[RadarRepository][updateEngagementScore] Error...` nos logs cai a zero (ou ao baseline de erros de negócio genuínos).

### B3 — Log correlacionável + não mascarar falha de sync como sucesso

1. Em `EmailContactImportUseCase.ts:579`, incluir a mensagem real do erro (ou `error.message` capturado no ponto de falha) na mesma linha de log que já carrega `importId` — eliminar a necessidade de correlacionar duas linhas de log distintas por timestamp.
2. Avaliar (decisão de produto, não só técnica) se falha de sync Radar deveria popular `failedBatches` e refletir em `finalizeJob`/status HTTP da rota, ou se o comportamento atual (job de import não falha por causa do Radar) é intencional e só falta visibilidade. Se intencional, a correção deste achado é **só** o log (item 1); se não, adicionar um contador dedicado (`radarSyncFailures`) no resultado do job, sem necessariamente bloquear o HTTP 200 do import em si (não travar contatos importados por causa do Radar).

**Critério de sucesso:** uma falha real de sync Radar em produção é rastreável a partir de uma única linha de log, sem necessidade de correlação manual; o dono do projeto tem visibilidade (dashboard, log estruturado, ou contador) de que 100% dos syncs estão falhando, ao contrário de hoje.

### B4 — Eliminar o N+1 do backfill de engajamento

Reescrever `RadarEngagementBackfillUseCase` para calcular `engagementScore`/`engagementBand` em lote (set-based), ou, como intermediário de menor risco, paralelizar as chamadas a `updateEngagementScore` dentro do lote com concorrência limitada (`Promise.all` em chunks, similar ao padrão já usado em `RADAR_SYNC_CONCURRENCY` do import de e-mail).

**Critério de sucesso:** tempo de execução do cron `radar/cron/engagement-backfill` cai proporcionalmente à redução de round-trips (medir antes/depois via `BackofficeCronExecution.durationMs`, uma vez que `CRON_OBSERVABILITY_SPEC.md` Estágio 1 estiver em produção e a tabela existir).

---

## Ordem de execução e dependências

B1 é independente e pode ir primeiro (bug de código puro, sem dependência de infraestrutura). B2 não tem mais bloqueio de confirmação (resolvido via MCP do Supabase em 2026-08-09) — o item 1 (`withPrismaRetry`) pode ir junto com B1/B3; os itens 2-3 de B2 dependem de ação do dono do projeto (confirmar env var na Vercel / decidir mitigação estrutural). B3 é independente, pode ir em paralelo a B1. B4 depende de `CRON_OBSERVABILITY_SPEC.md` Estágio 1 estar em produção para medir o critério de sucesso via `BackofficeCronExecution`, mas a correção de código em si não depende disso.

## Critérios de sucesso (macro)

- `/api/v1/radar/segments` volta a 200 em todas as chamadas na janela de 24h pós-deploy.
- Erros de `[RadarRepository][updateEngagementScore]` nos logs caem para o baseline de instabilidade geral do pool (não zero — B2 é uma mitigação, não elimina 100% de P1001/P2024 do Postgres/Supavisor), com `withPrismaRetry` absorvendo picos transitórios sem propagar erro.
- `EmailContactImportUseCase` reporta falhas de sync Radar de forma correlacionável e visível, mesmo que o job continue retornando sucesso para os contatos importados.
- `radar/cron/engagement-backfill` roda em fração do tempo anterior, medível via `BackofficeCronExecution.durationMs`.

## Open questions (bloqueiam apenas o estágio indicado)

1. ~~**(B2)** As migrations estão aplicadas no banco remoto?~~ **Resolvido em 2026-08-09** — confirmado via MCP do Supabase autorizado: sim, aplicadas; tabelas existem; causa real é pool de conexões (ver correção revisada de B2 acima).
2. **(B2)** A `DATABASE_URL` com `connection_limit=1&pool_timeout=20` está de fato ativa em produção agora (deploy bem-sucedido, não só a env var salva)? Só o dono do projeto pode confirmar via dashboard da Vercel/redeploy.
3. **(B3)** Falha de sync Radar deveria afetar o status HTTP/resultado do job de import de e-mail, ou só precisa ficar visível em log/contador? Decisão de produto do dono, não técnica.
