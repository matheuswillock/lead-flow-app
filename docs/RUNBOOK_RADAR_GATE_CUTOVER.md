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
   legada real, cascas do E0 excluídas da amostra). **Rodado nesta sessão**
   (Supabase MCP autenticado em 2026-09-01, produção `wcnxwdcoambpfwxwubka`) —
   ver "Resultado da validação do shadow (2026-09-01)" abaixo. N=79, cobre os
   7 dias mínimos (25/08→01/09) mas fica abaixo do alvo N≥100 da SPEC —
   recomendação: estender mais alguns dias antes do canary, ou aceitar dado o
   padrão já ser claro (ver análise).
4. D2b resolvida pelo dono ([[90 — Decisões em aberto (owner)]]). **Não
   resolvida em 2026-09-01** — segue com as opções A/B/C em aberto, sem
   `Atualização` registrada como D1 recebeu. O cutover congela a régua vigente
   (D2 — telefone BR válido obrigatório, e-mail não basta); decidir D2b depois
   de congelar exigiria reabrir o estágio. **Não ativar canary/cutover antes
   desta decisão.**

## Como rodar a validação do shadow (pré-condição do passo 1)

**Tabelas físicas corretas** (o schema `radar` não existe como namespace
Postgres — é convenção de `eventType`; as tabelas vivem em `public`):
`radar.crm_lead_gate_shadow` = `corretor_studio_radar_events` filtrado por
`"eventType" = 'radar.crm_lead_gate_shadow'`; leads reais em
`corretor_studio_leads`; funil legado em
`corretor_studio_public_form_metric_events`.

```sql
-- Decisão do gate novo (shadow) por time, desde a ativação em 2026-08-25
select
  "teamId",
  (metadata->>'eligible')::text as eligible,
  coalesce(metadata->>'reason','') as reason,
  count(*) as n
from corretor_studio_radar_events
where "eventType" = 'radar.crm_lead_gate_shadow'
  and "occurredAt" >= '2026-08-25'
group by 1, 2, 3
order by 1, n desc;

-- Decisão real do legado no mesmo período (form_completed -> lead_created/lead_attached/lead_discarded)
select
  f."teamId",
  e."eventType",
  coalesce(e.origin->>'reason','') as discard_reason,
  count(*) as n
from corretor_studio_public_form_metric_events e
join corretor_studio_public_forms f on f.id = e."formId"
where e."eventType" in ('lead_created','lead_attached','lead_discarded')
  and e."createdAt" >= '2026-08-25'
group by 1, 2, 3
order by 1, n desc;

-- Leads REAIS criados no período (contorna o mislabel — ver achado abaixo)
select "teamId", count(*) as leads_created
from corretor_studio_leads
where "originChannel" in ('public_form','email_campaign')
  and "createdAt" >= '2026-08-25'
group by 1;
```

As três queries acima agregam (perdem `visitorSessionId`/`formId`/timestamp
individuais) — servem para a comparação **por time**, que é o nível mínimo
que a SPEC pede (E1: "medir... por time × eligible × reason"). Para
classificar divergência **por submissão** (ex.: confirmar se um
`eligible=false/invalid_phone` específico do shadow corresponde a um
`lead_attached` real do legado, não só bater os totais), rode o SELECT sem
`group by`/`count(*)` — mantendo `"teamId"`, `metadata`/`origin` e
`"occurredAt"` — e junte manualmente por `teamId` + janela de tempo próxima
(não há chave de correlação direta entre o evento shadow, que nasce no
`question_answered`, e o evento de conclusão do funil legado). Classifique
cada divergência: **esperada** (ex.: gate novo recusa `invalid_phone` onde o
legado criava mesmo assim — muda comportamento por design, D2) vs. **não
explicada** (para tudo e reporta ao dono, conforme o contrato de execução da
rodada). O resultado agregado desta sessão está no "Passo 1" abaixo; o join
fino por submissão fica como pendência explícita (item 3 do veredito).

## Passo 1 — Resultado da validação do shadow (2026-09-01)

Rodado contra produção (`wcnxwdcoambpfwxwubka`), janela 2026-08-25→2026-09-01
(7 dias, o mínimo exigido):

| Métrica | N |
|---|---:|
| Total de decisões shadow (`radar.crm_lead_gate_shadow`) | 79 |
| Shadow `eligible=true` | 27 |
| Shadow `eligible=false` (`invalid_phone` 44, `invalid_name` 8) | 52 |
| Funil legado: `lead_attached` | 26 |
| Funil legado: `lead_discarded` (`telefone_invalido`) | 1 |
| Funil legado: `lead_created` | **0** |
| Leads REAIS criados (`originChannel` public_form/email_campaign) | 20 |

Times amostrados: MultiSkill, Backoffice, Liber Corretora, Calli Seguros — 4
dos ~dezenas de times ativos (amostra viesada para quem teve tráfego de
formulário na janela; times sem `question_answered` ficam fora, viés
conhecido de H20).

**Classes de divergência:**

1. **`lead_created` sempre 0 no funil, mas 20 leads reais nasceram no
   período** — não é ausência de criação, é **mislabel confirmado** (ver
   achado abaixo). Classe: **esperada dado o bug, mas grave** — todo
   dashboard que lê `lead_created` como proxy de criação está cego. Some no
   cutover (caminho A para de existir em modo `radar`).
2. **Shadow eligible=true (27) ≈ funil legado com desfecho (27 = 26 attached
   + 1 discarded)** — na mesma ordem de grandeza; consistente com D2 já ser a
   mesma régua nos dois caminhos (não é coincidência garantida por join
   direto — shadow dispara por `question_answered`, o funil por conclusão —
   mas a proximidade dos totais não indica divergência de régua). **Classe:
   sem sinal de divergência de elegibilidade.**
3. **Shadow eligible=false por `invalid_phone`/`invalid_name` (52)** — não
   verificado linha a linha se o legado criava lead mesmo assim para esses
   casos (precisaria join por submissão, não feito nesta sessão por custo/
   tempo). Recomendação: antes do canary, rodar esse join fino pelo menos uma
   vez para descartar divergência de régua não esperada.

**Veredito do passo 1:** shadow **não está "sujo"** — nenhuma classe de
divergência não explicada foi encontrada — mas **N=79 < 100** (alvo da SPEC)
e o item 3 acima não foi verificado no nível de submissão. Recomendação:
manter shadow ativo mais alguns dias e rodar o join fino do item 3 antes de
autorizar o canary.

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

Nomes físicos: `Lead` → `corretor_studio_leads` (plural — `@@map` em
`prisma/schema.prisma`); eventos do gate C são linhas em
`corretor_studio_radar_events` com `"eventType" in ('radar.crm_lead_created',
'radar.crm_lead_attached')` (não existe tabela `radar.crm_lead_gate_events`
nem `corretor_studio_lead` no singular — achados de review corrigidos aqui).
T-R8.1 restringe a leads de origem formulário (mesmo predicado do T-R8.2) —
sem isso, leads manuais/importados do time canário, que legitimamente não
têm evento de gate, contariam como falso positivo.

```sql
-- T-R8.1: todo lead novo de FORMULÁRIO do time canário tem evento de gate correspondente
select l.id, l."createdAt"
from corretor_studio_leads l
where l."teamId" = '<canary-team-id>'
  and l."createdAt" >= '<canary-start>'
  and l."originChannel" in ('public_form','email_campaign')
  and l."originMetadata"->>'formId' is not null
  and not exists (
    select 1 from corretor_studio_radar_events e
    where e."eventType" in ('radar.crm_lead_created','radar.crm_lead_attached')
      and e.metadata->>'leadId' = l.id::text
  );
-- esperado: 0 linhas

-- T-R8.2 (pós cutover global): zero leads de formulário nascidos pelos caminhos A/B
select count(*)
from corretor_studio_leads l
where l."originChannel" in ('public_form','email_campaign')
  and l."createdAt" >= '<cutover-timestamp>'
  and l."originMetadata"->>'formId' is not null
  and not exists (
    select 1 from corretor_studio_radar_events e
    where e."eventType" in ('radar.crm_lead_created','radar.crm_lead_attached')
      and e.metadata->>'leadId' = l.id::text
  );
-- esperado: 0 linhas
```

## Achado de telemetria — CONFIRMADO em 2026-09-01 (ver nota 01 §1 / nota 30)

**Causa raiz confirmada com dado real de produção** (Supabase MCP, projeto
`wcnxwdcoambpfwxwubka`, join submissão×evento×lead pela `formId`/janela de
tempo):

O caso "PEDRO TESTE" (lead `ceeab6ab-34c9-445a-bb4d-9338858d2617`,
`corretor_studio_leads."createdAt" = 2026-09-01 11:21:01.846+00`) tem o
`form_completed`/`lead_attached` emitido em `11:21:11.404+00` — **10 segundos
depois** do lead já existir. O que aconteceu: `PublicFormProgressUseCase.ts`
(caminho A, disparado a cada `/progress` durante a digitação) chama
`LegacyPublicFormProgressLeadService.createOrUpdate` com
`allowCreate: !sessionLeadId` — e esse serviço é um wrapper fino que só
delega para `upsertLeadFromFormAnswers`
(`app/api/services/PublicForms/LegacyPublicFormProgressLeadService.ts:26-30`),
**a mesma função de criação usada na conclusão**. O lead nasce no meio da
digitação (assim que nome+telefone válidos aparecem), **sem nenhum evento de
métrica** — `grep` confirma zero ocorrência de `recordMetric`/
`publishServerPublicFormMetricEvent` nesse arquivo. Quando a submissão
completa minutos (ou segundos) depois, `processInBackground` roda o mesmo
`upsertLeadFromFormAnswers`, `findMatchingLead` acha o lead que o caminho A
já criou, e o outcome sai `"updated"` → `lead_attached`, corretamente segundo
a lógica do código (`PublicFormSubmissionUseCase.ts:546-547`), mas
**nenhum evento em lugar nenhum jamais diz `lead_created`** para essa
identidade — o momento real da criação não é instrumentado.

Isso explica **integralmente** `lead_created = 0` desde 18/08: não é bug no
ponto de emissão do evento de conclusão (que está correto e testado desde
`1623d0dda`, 24/08) — é a ausência estrutural de instrumentação no ponto real
de criação (caminho A, `/progress`). Confirmado com os 20 leads reais criados
25/08→01/09 (query acima) contra 0 `lead_created` no funil no mesmo período.

**Por que o cutover resolve isso de graça:** em modo `radar`,
`PublicFormProgressUseCase` **nunca chama** `LegacyPublicFormProgressLeadService`
(guard `leadGateMode !== "radar"` em `PublicFormProgressUseCase.ts:130`) — o
caminho A silencioso deixa de existir. Quem cria passa a ser
`CreateCrmLeadFromRadarFormGateUseCase` (gate C), que emite
`radar.crm_lead_created`/`radar.crm_lead_attached` corretamente e agora tem
trava de regressão por teste (ver acima). **Não é necessário nenhum código
novo para corrigir isto no modo radar** — só o cutover em si.

**Pendência que NÃO é desta sessão:** enquanto o modo `legacy`/`shadow`
continuar ativo (antes do cutover), todo dashboard que lê `lead_created` como
proxy de criação real segue cego. Instrumentar `lead_created` no caminho A
seria trabalho novo em [[40 — Motor de Formulários — Backend]] (não em
[[10]]) e só vale a pena se o cutover atrasar — registrado como possível
follow-up, não implementado aqui (fora do escopo do E8 e o cutover o torna
moot).
