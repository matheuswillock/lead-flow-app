-- Soft-delete de pergunta pública (`PublicFormQuestion.deletedAt`).
-- Editor deixa de hard-delete para não quebrar FK de answers/metrics e
-- publicações congeladas (ghost IDs da Lista Fria).
-- Idempotente: seguro reexecutar.
--
-- Nomes físicos: @@map("corretor_studio_public_form_questions"), coluna "deletedAt".

ALTER TABLE "public"."corretor_studio_public_form_questions"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "corretor_studio_public_form_questions_formId_deletedAt_idx"
  ON "public"."corretor_studio_public_form_questions" ("formId", "deletedAt");
