-- Adiciona questionSnapshot em corretor_studio_public_form_metric_events.
--
-- Mesmo padrão já usado em corretor_studio_public_form_answers.questionSnapshot:
-- cópia congelada da pergunta (resolvida a partir do `snapshot` da
-- PublicFormPublication vigente no momento do evento). Preserva a
-- rastreabilidade do evento mesmo que a pergunta viva
-- (corretor_studio_public_form_questions) seja editada/removida depois —
-- o FK "questionId" nessa tabela é só um best-effort para join "ao vivo"
-- (ON DELETE SET NULL) e pode ficar obsoleto se o formulário for editado
-- enquanto um visitante ainda está usando uma publicação já congelada.
--
-- Idempotente: seguro reexecutar.
ALTER TABLE "public"."corretor_studio_public_form_metric_events"
  ADD COLUMN IF NOT EXISTS "questionSnapshot" JSONB;
