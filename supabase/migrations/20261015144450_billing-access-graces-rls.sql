-- BillingAccessGrace is an operator-only backend exception. The application
-- accesses it through Prisma/service credentials; end-user roles must never
-- read or mutate these grants directly.
ALTER TABLE IF EXISTS "public"."billing_access_graces" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."billing_access_graces" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."billing_access_graces" TO service_role;

DROP POLICY IF EXISTS "billing_access_graces_service_role_only" ON "public"."billing_access_graces";
CREATE POLICY "billing_access_graces_service_role_only"
  ON "public"."billing_access_graces"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
