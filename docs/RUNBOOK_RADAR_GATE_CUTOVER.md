# Runbook — Cutover do gate de leads de formulário (Radar C vs. legado)

Runbook operacional do estágio [[10 — Radar — Backend]] E8 (Obsidian, CDP
2026-08). Complementa `agents.md` (governança) e a auditoria CDP 2026-08 §4/§7.

## O mecanismo já existe em código

O gate é resolvido por time, não globalmente, em
`lib/public-forms/public-form-lead-gate-mode.ts`:

```ts
resolvePublicFormLeadGateMode(teamId) // "legacy" | "shadow" | "radar"
```

- `PUBLIC_FORM_RADAR_CANARY_TEAM_IDS` (lista de `teamId` separada por vírgula)
  **sempre vence**: um time nessa lista roda em modo `radar` independente da
  env global.
- Sem estar no canário, o time roda o modo de `PUBLIC_FORM_LEAD_GATE_MODE`
  (default `legacy`).

Nenhum código novo é necessário para canary ou cutover — os dois são apenas
mudança de env var na Vercel (`vercel env`), autorizada pelo dono conforme
`agents.md`. Este runbook documenta a sequência seura de ativação e o
rollback, não implementa a ativação.

## Pré-requisitos duros (não pular nenhum)

1. [[40 — Motor de Formulários — Backend]] E0 (claim do dispatcher) em
   produção. **Confirmado**: `feature/cdp-40-e0` (#1027) está em `origin/main`
   desde antes de 31/08 (commits `3c13e2d2`/`96adf350`/`845b222f`).
2. [[40]] E1 (`required` no servidor) em produção. **Confirmado**: `#1030` em
   `origin/main`.
3. Relatório shadow com ≥7 dias limpos (`radar.crm_lead_gate_shadow` × decisão
   legada real, cascas do E0 excluídas da amostra). **Bloqueado nesta sessão**
   — sem acesso de leitura ao Supabase de produção (MCP não autenticado). Ver
   seção "Como rodar a validação do shadow" abaixo.
4. D2b resolvida pelo dono ([[90 — Decisões em aberto (owner)]]). **Não
   resolvida em 2026-09-01** — segue com as opções A/B/C em aberto, sem
   `Atualização` registrada como D1 recebeu. O cutover congela a régua vigente
   (D2 — telefone BR válido obrigatório, e-mail não basta); decidir D2b depois
   de congelar exigiria reabrir o estágio. **Não ativar canary/cutover antes
   desta decisão.**

## Como rodar a validação do shadow (pré-condição do passo 1)

Query de referência (produção, projeto Supabase `wcnxwdcoambpfwxwubka`, MCP
`mcp__plugin_supabase_supabase__execute_sql` ou `psql` read-only):

```sql
-- Decisão do gate novo (shadow) por time, desde a ativação em 2026-08-25
select
  "teamId",
  metadata->>'eligible' as eligible,
  metadata->>'reason' as reason,
  count(*) as n
from radar.crm_lead_gate_shadow
where "occurredAt" >= '2026-08-25'
group by 1, 2, 3
order by 1, n desc;

-- Decisão real do legado no mesmo período (form_completed -> lead_created/lead_attached/lead_discarded)
select
  eventType,
  origin->>'reason' as discard_reason,
  count(*) as n
from corretor_studio_public_form_metric_events
where "eventType" in ('lead_created','lead_attached','lead_discarded')
  and "occurredAt" >= '2026-08-25'
group by 1, 2
order by 1, n desc;
```

Cruzar por submissão (join por `visitorSessionId`/`formId`/janela de tempo) e
classificar cada divergência: **esperada** (ex.: gate novo recusa
`invalid_phone` onde o legado criava mesmo assim — muda comportamento por
design, D2) vs. **não explicada** (para tudo e reporta ao dono, conforme o
contrato de execução da rodada).

## Passo 1 — Confirmar shadow limpo

Critério: N ≥ 100 decisões, toda divergência classificada, nenhuma classe não
explicada. Ver query acima. Produto do passo: tabela de paridade anexada ao
relatório final e a esta nota (10-E8).

## Passo 2 — Canary

```bash
vercel env add PUBLIC_FORM_RADAR_CANARY_TEAM_IDS production
# valor: "<teamId-gps-insurance>,<teamId-backoffice>"
```

7 dias. Acompanhar `radar.crm_lead_created`/`radar.crm_lead_attached` dos dois
times vs. o que o shadow report previa para eles. Alarme se divergência >10%.

**Rollback do canary:** remover os `teamId` da env (ou apagar a variável) —
efeito imediato no próximo request, sem novo deploy (a resolução é por env,
lida a cada chamada).

## Passo 3 — Cutover global

```bash
vercel env add PUBLIC_FORM_LEAD_GATE_MODE production
# valor: "radar"
```

No modo `radar`:
- `PublicFormSubmissionUseCase.processInBackground` passa `allowCreate:false`
  para `upsertLeadFromFormAnswers` — o caminho legado de criação
  (`upsertLeadFromFormAnswers` criando via `LeadUseCase.createLead`) para de
  criar; só atualiza lead já resolvido.
- `PublicFormProgressUseCase` (`leadGateMode !== "radar"` guard, linha ~130)
  para de disparar o sync inline do caminho A.
- `CreateCrmLeadFromRadarFormGateUseCase` (gate C) passa a ser quem decide
  criação/anexo, com o rótulo correto (`radar.crm_lead_created` /
  `radar.crm_lead_attached` — travado por teste, ver
  `app/api/useCases/radar/CreateCrmLeadFromRadarFormGateUseCase.test.ts`).

**Rollback do cutover:** voltar a env para `legacy` (ou remover a variável).
Efeito imediato, sem novo deploy — é o critério T-R8.4 da SPEC.

## Passo 4 — Janela de compatibilidade e remoção do código legado

14 dias de convivência (`legacy` continua no código, só não é o modo ativo) +
7 dias sem tráfego pelo caminho legado (medir por
`corretor_studio_public_form_metric_events` sem `origin.source` do caminho
A/B) → PR próprio removendo `LegacyPublicFormProgressLeadService` e os ramos
`leadGateMode !== "radar"`. Não faz parte desta sessão — só passa a ser
elegível depois do passo 3 estabilizar.

## Verificação pós-cutover (T-R8.1/T-R8.2)

```sql
-- T-R8.1: todo lead novo do time canário tem evento radar.crm_lead_created/_attached correspondente
select l.id, l."createdAt"
from corretor_studio_lead l
where l."teamId" = '<canary-team-id>'
  and l."createdAt" >= '<canary-start>'
  and not exists (
    select 1 from radar.crm_lead_gate_events e
    where e.metadata->>'leadId' = l.id::text
  );
-- esperado: 0 linhas

-- T-R8.2 (pós cutover global): zero leads nascidos pelos caminhos A/B
select count(*) from corretor_studio_lead
where "originChannel" in ('public_form','email_campaign')
  and "createdAt" >= '<cutover-timestamp>'
  and "originMetadata"->>'formId' is not null
  and not exists (
    select 1 from radar.crm_lead_gate_events e
    where e.metadata->>'leadId' = corretor_studio_lead.id::text
  );
-- esperado: 0 linhas
```

## Achado de telemetria registrado em 2026-09-01 (ver nota 01 §1 / nota 30)

O legado emite `lead_attached` mesmo quando cria o lead — achado relatado
contra produção (card "PEDRO TESTE", 01/09 11:20/11:21). A leitura do código
em `origin/develop` (commit `1623d0dda`, em `origin/main` desde antes de
31/08) mostra o ponto de emissão (`PublicFormSubmissionUseCase.ts:546-547`)
já correto — `eventType` deriva de `upserted.outcome === "created"` — e
coberto por teste (`PublicFormSubmissionUseCase.lead-discarded.test.ts:201-212`).
O candidato mais provável para reconciliar a observação é o caminho de
atribuição por `cs_el` (`ResolveEmailCampaignFormAttributionUseCase`), que
resolve `resolvedLeadId` a partir de um lead **já existente** do destinatário
quando o upsert direto não resolve identidade — nesse caso `lead_attached` é
o rótulo correto por desenho (teste
`PublicFormSubmissionUseCase.lead-discarded.test.ts:241-252`), mas pode SER
confundido com "criação mal rotulada" por quem está olhando o card no CRM sem
saber que a atribuição por e-mail achou um lead pré-existente. **Precisa de
confirmação com leitura real de produção (join submissão×evento×lead) antes
de decidir se é preciso código novo** — não foi possível nesta sessão por
falta de acesso ao Supabase MCP.
