-- BackofficeAuthorizedSponsor: fonte única de patrocinadores autorizados (ASSOCIATED_SPONSOR_SPEC D1)

CREATE TABLE IF NOT EXISTS "public"."backoffice_authorized_sponsors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profileId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "grantedByProfileId" UUID,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedByProfileId" UUID,
    "revokedAt" TIMESTAMPTZ(6),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backoffice_authorized_sponsors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_authorized_sponsors_profileId_key"
    ON "public"."backoffice_authorized_sponsors"("profileId");

CREATE INDEX IF NOT EXISTS "backoffice_authorized_sponsors_is_active_idx"
    ON "public"."backoffice_authorized_sponsors"("isActive");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'backoffice_authorized_sponsors_profileId_fkey'
    ) THEN
        ALTER TABLE "public"."backoffice_authorized_sponsors"
            ADD CONSTRAINT "backoffice_authorized_sponsors_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_profiles"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'backoffice_authorized_sponsors_grantedByProfileId_fkey'
    ) THEN
        ALTER TABLE "public"."backoffice_authorized_sponsors"
            ADD CONSTRAINT "backoffice_authorized_sponsors_grantedByProfileId_fkey"
            FOREIGN KEY ("grantedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'backoffice_authorized_sponsors_revokedByProfileId_fkey'
    ) THEN
        ALTER TABLE "public"."backoffice_authorized_sponsors"
            ADD CONSTRAINT "backoffice_authorized_sponsors_revokedByProfileId_fkey"
            FOREIGN KEY ("revokedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
