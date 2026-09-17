-- SPEC 40 E0, todo 23 — marca as submissões fabricadas pelo cron de despacho.
--
-- Antes do E0, `claimPendingSubmissionDispatches` reivindicava qualquer
-- `status='processing' AND "dispatchAcceptedAt" IS NULL` — condição que as cascas
-- criadas pelo `/progress` satisfazem por construção. O cron `*/5` então
-- completava o parcial como se fosse envio: `form.completed` server-side, gate de
-- lead, tudo. Medido em produção em 25/08: **311 submissões em 24 formulários**,
-- de 30/07 a 25/08 11:04 (a última antes do deploy do E0, às 15:16 UTC).
--
-- O estrago é de MEDIÇÃO, não de dado: o funil mostrava 21,5% de conversão
-- (413 completados / 89 com lead) quando a taxa real, fora as fabricadas, é
-- 75,7% (103 / 78). O produto parecia 3,5× pior do que é.
--
-- Por que marcar em vez de apagar: `DELETE` destruiria resposta de gente real —
-- a pessoa DIGITOU nome e telefone num formulário parcial; o que foi fabricado é
-- o evento de conclusão, não o contato. Pelo mesmo motivo os 21 leads gerados a
-- partir delas ficam intocados no CRM.
--
-- Idempotente e de alvo fechado: o critério só casa linha anterior ao E0, e o
-- `WHERE ... IS NULL` no fim impede reescrita. Replay é seguro.

-- 1) A submissão. Marcar é fato sobre a linha, vale mesmo sem sessão resolvida.
update "public"."corretor_studio_public_form_submissions"
set origin = jsonb_set(
      coalesce(origin, '{}'::jsonb),
      '{fabricatedByDispatcher}',
      'true'::jsonb,
      true
    )
where status = 'completed'
  and "requestKey" like 'progress:%'
  and "submitRequestedAt" is null
  and "dispatchAcceptedAt" is not null
  and (origin -> 'fabricatedByDispatcher') is null;

-- 2) Os eventos derivados dessa conclusão inventada.
--
-- Escopo deliberadamente mais estreito que o da submissão: só sessões cujas
-- submissões são TODAS fabricadas. Em 25/08 havia 305 assim e **4 mistas** — a
-- mesma sessão com uma casca completada pelo cron e um envio real depois. Como
-- o `eventKey` de `form_completed` é único por sessão (`sessão:form_completed`,
-- first-write-wins), nas mistas não dá para saber pela linha qual das duas
-- ocupou a chave. Marcar por sessão apagaria do funil a conversão legítima
-- dessas 4; deixá-las passar mantém 4 completados a mais numa série de 413.
-- Errar para o lado de preservar o dado real é o correto — as 4 ficam
-- registradas na SPEC para conferência manual.
--
-- `form_viewed`, `form_started` e `question_answered` NÃO entram: quem viu e
-- respondeu foi uma pessoa de verdade. Fabricado é o desfecho, não a visita.
with sessoes_so_fabricadas as (
  select "formId", "visitorSessionId"
  from "public"."corretor_studio_public_form_submissions"
  where "visitorSessionId" is not null
  group by "formId", "visitorSessionId"
  having bool_and(
           status = 'completed'
           and "requestKey" like 'progress:%'
           and "submitRequestedAt" is null
           and "dispatchAcceptedAt" is not null
         )
)
update "public"."corretor_studio_public_form_metric_events" e
set origin = jsonb_set(
      coalesce(e.origin, '{}'::jsonb),
      '{fabricatedByDispatcher}',
      'true'::jsonb,
      true
    )
from sessoes_so_fabricadas s
where e."formId" = s."formId"
  and e."visitorSessionId" = s."visitorSessionId"
  and e."eventType" in ('form_completed', 'lead_created', 'lead_attached', 'meeting_scheduled')
  and (e.origin -> 'fabricatedByDispatcher') is null;

-- 3) A projeção de jornada, que também foi contaminada.
--
-- `recordJourneyProgress` roda a cada métrica: ao consumir o `form_completed`
-- fabricado ele moveu a `PublicFormJourneySession` para `completed`. Marcar só
-- o evento deixaria `journey.completed` inflado — `countJourneyStates` lê o
-- estado da sessão, não a métrica, e o código **nunca reverte** um `completed`.
-- Medido em 25/08: **302 sessões** nesse estado por conclusão fabricada.
--
-- O estado verdadeiro é `abandoned`: a pessoa preencheu parte e foi embora. É a
-- conclusão a que o cron de jornada teria chegado sozinho — o E0 já diz que
-- "abandono continua sendo trabalho do cron de jornada (`form_abandoned`), que é
-- o evento verdadeiro". Não é invenção nova, é devolver o fato.
--
-- `lastAbandonedAt` recebe `lastActivityAt`, o último instante em que o
-- visitante de fato mexeu no formulário — nunca `now()`, que dataria o abandono
-- no dia da migration e jogaria 302 abandonos falsos no recorte de hoje.
--
-- Mesmo escopo do bloco 2: sessões mistas ficam de fora, porque nelas houve um
-- envio real e o `completed` é legítimo.
with sessoes_so_fabricadas as (
  select "formId", "visitorSessionId"
  from "public"."corretor_studio_public_form_submissions"
  where "visitorSessionId" is not null
  group by "formId", "visitorSessionId"
  having bool_and(
           status = 'completed'
           and "requestKey" like 'progress:%'
           and "submitRequestedAt" is null
           and "dispatchAcceptedAt" is not null
         )
)
update "public"."corretor_studio_public_form_journey_sessions" j
set state = 'abandoned',
    "lastAbandonedAt" = coalesce(j."lastAbandonedAt", j."lastActivityAt"),
    "completedAt" = null,
    "submittedAt" = null
from sessoes_so_fabricadas s
where j."formId" = s."formId"
  and j."visitorSessionId" = s."visitorSessionId"
  and j.state = 'completed';

-- 4) Índice parcial para o predicado novo do funil.
--
-- Toda leitura de métrica passa a carregar `(origin->'fabricatedByDispatcher') IS NULL`
-- (ver `buildMetricEventWhereSql`). Parcial porque a esmagadora maioria das
-- linhas não é marcada e o índice só precisa cobrir o caminho quente.
--
-- SEM `CONCURRENTLY` de propósito: migrations do Supabase CLI rodam dentro de
-- transação e `CREATE INDEX CONCURRENTLY` não é permitido ali — mesma nota de
-- `20260823234849_email-logs-campaign-recipient-index.sql`. Aqui a janela de
-- lock é aceitável: a tabela tem ~16 mil linhas (contra as 538 mil daquela), e
-- o `CREATE INDEX` normal termina em milissegundos. Se a tabela crescer uma
-- ordem de grandeza, reavaliar.
create index if not exists "public_form_metric_events_not_fabricated_idx"
  on "public"."corretor_studio_public_form_metric_events" ("formId", "eventType")
  where (origin -> 'fabricatedByDispatcher') is null;
