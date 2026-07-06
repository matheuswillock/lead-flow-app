-- FK backoffice_adhesions.sponsorMasterId → corretor_studio_profiles (ON DELETE SET NULL)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'backoffice_adhesions_sponsorMasterId_fkey'
    ) THEN
        ALTER TABLE "public"."backoffice_adhesions"
            ADD CONSTRAINT "backoffice_adhesions_sponsorMasterId_fkey"
            FOREIGN KEY ("sponsorMasterId") REFERENCES "public"."corretor_studio_profiles"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "backoffice_adhesions_sponsor_master_id_idx"
    ON "public"."backoffice_adhesions"("sponsorMasterId");
