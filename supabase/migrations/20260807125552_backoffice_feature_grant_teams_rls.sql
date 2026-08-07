-- backoffice_feature_grant_teams is only accessed through server-side API routes / Prisma.
-- Keep Data API roles denied; service_role/server access bypasses RLS.
ALTER TABLE "public"."backoffice_feature_grant_teams" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."backoffice_feature_grant_teams" FROM anon, authenticated;
GRANT ALL ON TABLE "public"."backoffice_feature_grant_teams" TO service_role;
