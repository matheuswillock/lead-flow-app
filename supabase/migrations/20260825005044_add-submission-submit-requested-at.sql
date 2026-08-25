-- SPEC 40 E0 / DA6 — marcador positivo de aceite da submissão de formulário público.
--
-- O cron de re-despacho (`PublicFormSubmissionDispatchUseCase`) reivindicava por
-- ausência (`dispatchAcceptedAt IS NULL`), condição que toda casca criada pelo
-- `/progress` satisfaz por construção (`status` tem default `processing`). Com a
-- coluna abaixo, "aceita" passa a ser fato gravado no POST de envio, e o claim
-- exige `"submitRequestedAt" IS NOT NULL`.
--
-- Backfill NÃO faz parte desta migration: submissão pré-deploy sem carimbo é
-- exatamente a população que não deve ser despachada (ver E0, passo 5/6).

alter table "public"."corretor_studio_public_form_submissions"
  add column if not exists "submitRequestedAt" timestamp(6) with time zone;
