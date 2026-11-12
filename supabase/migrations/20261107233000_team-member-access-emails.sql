-- Liga cada e-mail de acesso (primeiro acesso ou nova senha) à conta e ao time que pediu o envio.
-- O histórico de acesso que master/manager veem mostra só os envios da própria conta: quem
-- trabalha para duas corretoras não tem os envios de uma expostos à outra.
--
-- Seguro para os dados existentes: tabela nova, sem alteração em tabelas atuais.
-- Rollback: DROP TABLE "public"."team_member_access_emails";

CREATE TABLE IF NOT EXISTS "public"."team_member_access_emails" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "account_id" UUID NOT NULL,
  "team_id" UUID,
  "profile_id" UUID NOT NULL,
  "dispatch_id" UUID NOT NULL,
  "requested_by_profile_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "team_member_access_emails_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "team_member_access_emails_dispatch_id_key" UNIQUE ("dispatch_id"),
  CONSTRAINT "team_member_access_emails_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "team_member_access_emails_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "public"."corretor_studio_teams"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "team_member_access_emails_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "team_member_access_emails_dispatch_id_fkey"
    FOREIGN KEY ("dispatch_id") REFERENCES "public"."backoffice_email_dispatches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "team_member_access_emails_account_profile_idx"
  ON "public"."team_member_access_emails" ("account_id", "profile_id", "created_at" DESC);

ALTER TABLE "public"."team_member_access_emails" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."team_member_access_emails" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."team_member_access_emails" TO service_role;

CREATE POLICY "team_member_access_emails_service_role_only"
  ON "public"."team_member_access_emails"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
