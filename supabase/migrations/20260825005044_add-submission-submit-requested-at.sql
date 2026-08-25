-- SPEC 40 E0 / DA6 — marcador positivo de aceite da submissão de formulário público.
--
-- O cron de re-despacho (`PublicFormSubmissionDispatchUseCase`) reivindicava por
-- ausência (`dispatchAcceptedAt IS NULL`), condição que toda casca criada pelo
-- `/progress` satisfaz por construção (`status` tem default `processing`). Com a
-- coluna abaixo, "aceita" passa a ser fato gravado no POST de envio, e o claim
-- exige `"submitRequestedAt" IS NOT NULL`.
--
alter table "public"."corretor_studio_public_form_submissions"
  add column if not exists "submitRequestedAt" timestamp(6) with time zone;

-- Transição (E0, passo 5). Sem este backfill, uma submissão **aceita antes do
-- deploy** — 202 já devolvido, enfileiramento e outbox falharam, e o
-- `markSubmissionDispatchDeferred` a agendou para retry — ficaria fora do claim
-- novo para sempre: ela também tem `submitRequestedAt IS NULL`.
--
-- O critério separa as duas populações pelo que as originou, não pelo estado:
-- `requestKey NOT LIKE 'progress:%'` só existe em linha criada por
-- `createSubmission`, isto é, por um POST de envio real que não tinha casca de
-- progresso. Casca do `/progress` sempre carrega o prefixo e continua de fora.
--
-- Limite conhecido e aceito: um envio real que **resolveu** uma casca de
-- progresso herda o `requestKey` `progress:` (DA6) e não é recuperado aqui.
-- Essa fatia é indistinguível de casca pura só pelo `requestKey`, e errar para
-- o lado de não despachar é o comportamento correto — o oposto é justamente o
-- bug que este estágio fecha.
update "public"."corretor_studio_public_form_submissions"
set "submitRequestedAt" = "createdAt"
where "submitRequestedAt" is null
  and "status" = 'processing'
  and "dispatchAcceptedAt" is null
  and "requestKey" not like 'progress:%';
