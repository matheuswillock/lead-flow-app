-- Fase 4 / PR1 (dispatch-queue): créditos reservados + snapshot do beta de
-- campanhas precisam sobreviver entre invocações (fila multi-lote finaliza
-- em um isolate diferente do que reservou os créditos em startManualDispatch).
alter table "public"."corretor_studio_email_campaign_dispatches"
  add column if not exists "reservedCredits" integer not null default 0;

alter table "public"."corretor_studio_email_campaign_dispatches"
  add column if not exists "hasCampaignsBetaAccess" boolean not null default false;
