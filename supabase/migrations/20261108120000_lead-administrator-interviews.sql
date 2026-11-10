-- Entrevista da administradora e lembretes de acompanhamento do lead.
--
-- 1. lead_administrator_interviews: registro opcional (um por lead) da entrevista que a administradora
--    faz com o cliente. "scheduled_local" guarda a data/hora exatamente como o usuário digitou; é ela que
--    vai na mensagem ao cliente.
-- 2. lead_follow_up_reminders: lembretes datados que viram tarefa + alerta + item no feed do lead
--    (entrevista, nutrição do lead até a reunião do SDR, fim de vigência do plano na Carteira).
-- 3. notification_type ganha LEAD_FOLLOW_UP_REMINDER.
--
-- Seguro para os dados existentes: tabelas novas e um valor novo de enum.
-- Rollback: DROP TABLE "public"."lead_follow_up_reminders"; DROP TABLE "public"."lead_administrator_interviews";
-- (o valor de enum não é removível; fica sem uso).

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'LEAD_FOLLOW_UP_REMINDER';

CREATE TABLE IF NOT EXISTS "public"."lead_administrator_interviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lead_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
  "scheduled_local" TEXT NOT NULL,
  "administrator_name" TEXT,
  "notes" TEXT,
  "client_notified_at" TIMESTAMPTZ(6),
  "updated_by_profile_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_administrator_interviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lead_administrator_interviews_lead_id_key" UNIQUE ("lead_id"),
  CONSTRAINT "lead_administrator_interviews_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "public"."corretor_studio_leads"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lead_administrator_interviews_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "public"."corretor_studio_teams"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lead_administrator_interviews_updated_by_fkey"
    FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."lead_follow_up_reminders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lead_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  -- administrator_interview | meeting_nurture | plan_renewal
  "kind" TEXT NOT NULL,
  -- Ex.: "2d", "1d", "1h", "90d". Junto com "anchor_at" evita lembrete duplicado.
  "offset_key" TEXT NOT NULL,
  -- Data do evento (entrevista, reunião, fim de vigência) que originou o lembrete.
  "anchor_at" TIMESTAMPTZ(6) NOT NULL,
  "due_at" TIMESTAMPTZ(6) NOT NULL,
  -- Data do evento já escrita para leitura ("quinta-feira, 12/11, às 14:30"), usada na tarefa e no alerta.
  "event_label" TEXT NOT NULL,
  -- Dono da tarefa; os demais recebem só o alerta.
  "owner_profile_id" UUID NOT NULL,
  "notify_profile_ids" UUID[] NOT NULL DEFAULT '{}',
  "processed_at" TIMESTAMPTZ(6),
  "task_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_follow_up_reminders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lead_follow_up_reminders_unique_key" UNIQUE ("lead_id", "kind", "anchor_at", "offset_key"),
  CONSTRAINT "lead_follow_up_reminders_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "public"."corretor_studio_leads"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lead_follow_up_reminders_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "public"."corretor_studio_teams"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lead_follow_up_reminders_owner_fkey"
    FOREIGN KEY ("owner_profile_id") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "lead_follow_up_reminders_pending_idx"
  ON "public"."lead_follow_up_reminders" ("due_at")
  WHERE "processed_at" IS NULL;

ALTER TABLE "public"."lead_administrator_interviews" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."lead_administrator_interviews" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."lead_administrator_interviews" TO service_role;
CREATE POLICY "lead_administrator_interviews_service_role_only"
  ON "public"."lead_administrator_interviews"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE "public"."lead_follow_up_reminders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."lead_follow_up_reminders" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."lead_follow_up_reminders" TO service_role;
CREATE POLICY "lead_follow_up_reminders_service_role_only"
  ON "public"."lead_follow_up_reminders"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
