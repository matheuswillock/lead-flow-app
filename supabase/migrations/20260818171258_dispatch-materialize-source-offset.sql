-- Cursor da fonte da audiência no dispatch em fila (IDs Radar / skip da lista /
-- índice retry). Não reutilizar emailLog.count como skip — no Radar o skip
-- pagina profile IDs antes do match do segmento.
alter table "public"."corretor_studio_email_campaign_dispatches"
  add column if not exists "materializeSourceOffset" integer not null default 0;
