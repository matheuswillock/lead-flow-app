-- short_links is only accessed through server-side API routes / Prisma.
-- Keep Data API roles denied; service_role/server access bypasses RLS.
ALTER TABLE "public"."short_links" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."short_links" FROM anon, authenticated;
GRANT ALL ON TABLE "public"."short_links" TO service_role;

-- Ensure no direct client policies accidentally expose short links.
DROP POLICY IF EXISTS "short_links_select" ON "public"."short_links";
DROP POLICY IF EXISTS "short_links_insert" ON "public"."short_links";
DROP POLICY IF EXISTS "short_links_update" ON "public"."short_links";
DROP POLICY IF EXISTS "short_links_delete" ON "public"."short_links";
