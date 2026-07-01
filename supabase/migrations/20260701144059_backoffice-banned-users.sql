-- Backoffice banned users (Anatemas)

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_ban_status" AS ENUM ('ACTIVE', 'LIFTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."backoffice_ban_scope" AS ENUM ('INDIVIDUAL', 'ACCOUNT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."backoffice_banned_users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL,
  "supabaseId" UUID,
  "email" TEXT NOT NULL,
  "fullName" TEXT,
  "reason" TEXT,
  "status" "public"."backoffice_ban_status" NOT NULL DEFAULT 'ACTIVE',
  "scope" "public"."backoffice_ban_scope" NOT NULL DEFAULT 'INDIVIDUAL',
  "bannedByProfileId" UUID NOT NULL,
  "bannedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "liftedByProfileId" UUID,
  "liftedAt" TIMESTAMPTZ(6),
  "liftReason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_banned_users_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "backoffice_banned_users_profile_status_idx"
  ON "public"."backoffice_banned_users" ("profileId", "status");

CREATE INDEX IF NOT EXISTS "backoffice_banned_users_status_banned_at_idx"
  ON "public"."backoffice_banned_users" ("status", "bannedAt");

CREATE INDEX IF NOT EXISTS "backoffice_banned_users_scope_status_idx"
  ON "public"."backoffice_banned_users" ("scope", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_banned_users_active_profile_unique"
  ON "public"."backoffice_banned_users" ("profileId")
  WHERE "status" = 'ACTIVE';

DO $$ BEGIN
  ALTER TABLE "public"."backoffice_banned_users"
    ADD CONSTRAINT "backoffice_banned_users_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."backoffice_banned_users"
    ADD CONSTRAINT "backoffice_banned_users_bannedByProfileId_fkey"
    FOREIGN KEY ("bannedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."backoffice_banned_users"
    ADD CONSTRAINT "backoffice_banned_users_liftedByProfileId_fkey"
    FOREIGN KEY ("liftedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
