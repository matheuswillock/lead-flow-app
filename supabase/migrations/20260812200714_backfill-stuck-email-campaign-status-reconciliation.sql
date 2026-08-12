-- Backfill: reconcilia EmailCampaign.status/totalSent/errorMessage/sentAt divergentes
-- da realidade dos EmailLog para campanhas que já foram abandonadas pelo cron/fila
-- (dispatch em status terminal, mas nunca revisitado por nenhum job em background).
--
-- Espelha em SQL a mesma lógica de:
--   - reconcileLeafCampaignStatuses (app/api/useCases/email/EmailCampaignUseCase.ts)
--   - refreshParentCampaignStatus  (app/api/useCases/email/EmailCampaignUseCase.ts)
--
-- Idempotente: cada UPDATE só afeta linhas cujo valor calculado diverge do persistido
-- (`IS DISTINCT FROM`), então rodar de novo é sempre um no-op. Não é DDL — não cria
-- nem altera tabelas/colunas, só corrige dados.
--
-- Escopo: apenas UPDATE em corretor_studio_email_campaigns, com base em leitura de
-- corretor_studio_email_logs. Não toca corretor_studio_email_campaign_dispatches nem
-- corretor_studio_email_logs.
--
-- Nota: a reconciliação de campanhas-pai (passo 2) já roda ao vivo em toda chamada de
-- list()/getById() para qualquer pai com filhos (refreshParentCampaignStatus) — este
-- passo é uma medida de consistência para quem lê a tabela direto via SQL (dashboards,
-- exports), não uma necessidade estrita para a UI mostrar dados corretos.

begin;

-- Passo 1: campanhas-folha / sub-campanhas (sem filhos) em status terminal cujo
-- acceptedCount real (deduplicado por e-mail, prioridade accepted > failed > queued)
-- diverge do status/totalSent persistidos.
with log_tiers as (
  select
    "campaignId",
    lower(trim("recipientEmail")) as email,
    case
      when "sentAt" is not null or "resendEmailId" is not null then 2
      when status = 'failed'::"email_log_status" then 1
      else 0
    end as tier,
    "sentAt"
  from corretor_studio_email_logs
  where "campaignId" is not null
),
email_best_tier as (
  select "campaignId", email, max(tier) as tier
  from log_tiers
  group by "campaignId", email
),
campaign_log_summary as (
  select
    ebt."campaignId",
    count(*) filter (where ebt.tier = 2) as accepted_count,
    (
      select max(lt."sentAt")
      from log_tiers lt
      where lt."campaignId" = ebt."campaignId" and lt.tier = 2
    ) as last_accepted_at
  from email_best_tier ebt
  group by ebt."campaignId"
)
update corretor_studio_email_campaigns c
set
  status = case
    when s.accepted_count >= c."totalRecipients" then 'sent'::"email_campaign_status"
    when s.accepted_count = 0 then 'failed'::"email_campaign_status"
    else 'partially_sent'::"email_campaign_status"
  end,
  "totalSent" = s.accepted_count,
  "errorMessage" = case
    when s.accepted_count >= c."totalRecipients" then null
    else c."errorMessage"
  end,
  "sentAt" = case
    when s.accepted_count >= c."totalRecipients" then coalesce(s.last_accepted_at, c."sentAt")
    else c."sentAt"
  end,
  "updatedAt" = now()
from campaign_log_summary s
where c.id = s."campaignId"
  and c.status in (
    'sent'::"email_campaign_status",
    'partially_sent'::"email_campaign_status",
    'failed'::"email_campaign_status"
  )
  and c."totalRecipients" > 0
  and not exists (
    select 1
    from corretor_studio_email_campaigns child
    where child."parentCampaignId" = c.id
  )
  and (
    c.status is distinct from (
      case
        when s.accepted_count >= c."totalRecipients" then 'sent'::"email_campaign_status"
        when s.accepted_count = 0 then 'failed'::"email_campaign_status"
        else 'partially_sent'::"email_campaign_status"
      end
    )
    or c."totalSent" is distinct from s.accepted_count
  );

-- Passo 2: campanhas-pai, recalculadas a partir dos filhos já corrigidos no passo 1
-- (mesma árvore de decisão de refreshParentCampaignStatus).
with child_agg as (
  select
    "parentCampaignId",
    bool_or(status = 'sending'::"email_campaign_status") as has_sending,
    bool_or(status = 'scheduled'::"email_campaign_status") as has_scheduled,
    bool_or(status = 'draft'::"email_campaign_status") as has_draft,
    bool_and(status = 'canceled'::"email_campaign_status") as all_canceled,
    bool_or(status = 'failed'::"email_campaign_status") as has_failed,
    bool_or(status = 'sent'::"email_campaign_status") as has_sent,
    bool_or(status = 'partially_sent'::"email_campaign_status") as has_partially_sent,
    bool_or(status = 'canceled'::"email_campaign_status") as has_canceled,
    sum("totalSent") as sum_total_sent,
    sum("totalDelivered") as sum_total_delivered,
    sum("totalOpened") as sum_total_opened,
    sum("totalClicked") as sum_total_clicked,
    sum("totalBounced") as sum_total_bounced,
    sum("dispatchCount") as sum_dispatch_count,
    max("sentAt") as max_sent_at
  from corretor_studio_email_campaigns
  where "parentCampaignId" is not null
  group by "parentCampaignId"
),
parent_status as (
  select
    "parentCampaignId",
    (case
      when has_sending then 'sending'
      when has_scheduled or has_draft then 'scheduled'
      when all_canceled then 'canceled'
      when has_failed and not has_sent and not has_partially_sent then 'failed'
      when has_failed and (has_sent or has_partially_sent) then 'partially_sent'
      when has_sent or has_partially_sent or has_canceled then 'sent'
      else 'scheduled'
    end)::"email_campaign_status" as computed_status,
    sum_total_sent,
    sum_total_delivered,
    sum_total_opened,
    sum_total_clicked,
    sum_total_bounced,
    sum_dispatch_count,
    max_sent_at
  from child_agg
)
update corretor_studio_email_campaigns p
set
  status = ps.computed_status,
  "totalSent" = ps.sum_total_sent,
  "totalDelivered" = ps.sum_total_delivered,
  "totalOpened" = ps.sum_total_opened,
  "totalClicked" = ps.sum_total_clicked,
  "totalBounced" = ps.sum_total_bounced,
  "dispatchCount" = ps.sum_dispatch_count,
  "sentAt" = case
    when ps.computed_status = 'sent'::"email_campaign_status" and ps.max_sent_at is not null
      then ps.max_sent_at
    else p."sentAt"
  end,
  "updatedAt" = now()
from parent_status ps
where p.id = ps."parentCampaignId"
  and (
    p.status is distinct from ps.computed_status
    or p."totalSent" is distinct from ps.sum_total_sent
    or p."dispatchCount" is distinct from ps.sum_dispatch_count
  );

commit;
