-- Standalone email index for cross-list lookups on EmailContact.
-- Generated from prisma/schema.prisma @@index([email]) via `prisma migrate diff`.
-- `db:migrate:from-prisma` could not complete here: local proxy /auth health
-- returns 502 and `db reset` stops on hybrid-stack `auth.users`.
CREATE INDEX IF NOT EXISTS "corretor_studio_email_contacts_email_idx"
  ON "public"."corretor_studio_email_contacts" ("email");
