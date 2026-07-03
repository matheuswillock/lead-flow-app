-- Backoffice contract documents (PDF) with versioning and share tokens.

CREATE TABLE IF NOT EXISTS public.backoffice_contracts (
  id uuid NOT NULL,
  title text NOT NULL,
  description text,
  "clientId" uuid,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdByProfileId" uuid NOT NULL,
  "createdAt" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT backoffice_contracts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS backoffice_contracts_client_id_idx
  ON public.backoffice_contracts USING btree ("clientId");

CREATE INDEX IF NOT EXISTS backoffice_contracts_is_active_idx
  ON public.backoffice_contracts USING btree ("isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contracts_clientId_fkey'
  ) THEN
    ALTER TABLE public.backoffice_contracts
      ADD CONSTRAINT backoffice_contracts_clientId_fkey
      FOREIGN KEY ("clientId") REFERENCES public.backoffice_clients(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contracts_createdByProfileId_fkey'
  ) THEN
    ALTER TABLE public.backoffice_contracts
      ADD CONSTRAINT backoffice_contracts_createdByProfileId_fkey
      FOREIGN KEY ("createdByProfileId") REFERENCES public.corretor_studio_profiles(id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.backoffice_contract_versions (
  id uuid NOT NULL,
  "contractId" uuid NOT NULL,
  "versionNumber" integer NOT NULL,
  "fileName" text NOT NULL,
  "storagePath" text NOT NULL,
  "fileSize" integer NOT NULL,
  "fileType" text NOT NULL DEFAULT 'application/pdf'::text,
  "importedByProfileId" uuid NOT NULL,
  "importedAt" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "shareTokenHash" text,
  "shareExpiresAt" timestamp(6) with time zone,
  "shareGeneratedAt" timestamp(6) with time zone,
  "shareGeneratedByProfileId" uuid,
  CONSTRAINT backoffice_contract_versions_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS backoffice_contract_versions_contract_version_unique
  ON public.backoffice_contract_versions USING btree ("contractId", "versionNumber");

CREATE UNIQUE INDEX IF NOT EXISTS backoffice_contract_versions_shareTokenHash_key
  ON public.backoffice_contract_versions USING btree ("shareTokenHash");

CREATE INDEX IF NOT EXISTS backoffice_contract_versions_share_token_hash_idx
  ON public.backoffice_contract_versions USING btree ("shareTokenHash");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contract_versions_contractId_fkey'
  ) THEN
    ALTER TABLE public.backoffice_contract_versions
      ADD CONSTRAINT backoffice_contract_versions_contractId_fkey
      FOREIGN KEY ("contractId") REFERENCES public.backoffice_contracts(id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contract_versions_importedByProfileId_fkey'
  ) THEN
    ALTER TABLE public.backoffice_contract_versions
      ADD CONSTRAINT backoffice_contract_versions_importedByProfileId_fkey
      FOREIGN KEY ("importedByProfileId") REFERENCES public.corretor_studio_profiles(id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_contract_versions_shareGeneratedByProfileId_fkey'
  ) THEN
    ALTER TABLE public.backoffice_contract_versions
      ADD CONSTRAINT backoffice_contract_versions_shareGeneratedByProfileId_fkey
      FOREIGN KEY ("shareGeneratedByProfileId") REFERENCES public.corretor_studio_profiles(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.backoffice_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backoffice_contract_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS backoffice_contracts_select ON public.backoffice_contracts;
CREATE POLICY backoffice_contracts_select ON public.backoffice_contracts
  FOR SELECT TO authenticated
  USING (public.is_active_backoffice_user());

DROP POLICY IF EXISTS backoffice_contracts_insert ON public.backoffice_contracts;
CREATE POLICY backoffice_contracts_insert ON public.backoffice_contracts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_backoffice_user());

DROP POLICY IF EXISTS backoffice_contracts_update ON public.backoffice_contracts;
CREATE POLICY backoffice_contracts_update ON public.backoffice_contracts
  FOR UPDATE TO authenticated
  USING (public.is_active_backoffice_user());

DROP POLICY IF EXISTS backoffice_contracts_delete ON public.backoffice_contracts;
CREATE POLICY backoffice_contracts_delete ON public.backoffice_contracts
  FOR DELETE TO authenticated
  USING (public.is_active_backoffice_user());

DROP POLICY IF EXISTS backoffice_contract_versions_select ON public.backoffice_contract_versions;
CREATE POLICY backoffice_contract_versions_select ON public.backoffice_contract_versions
  FOR SELECT TO authenticated
  USING (public.is_active_backoffice_user());

DROP POLICY IF EXISTS backoffice_contract_versions_insert ON public.backoffice_contract_versions;
CREATE POLICY backoffice_contract_versions_insert ON public.backoffice_contract_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_backoffice_user());

DROP POLICY IF EXISTS backoffice_contract_versions_update ON public.backoffice_contract_versions;
CREATE POLICY backoffice_contract_versions_update ON public.backoffice_contract_versions
  FOR UPDATE TO authenticated
  USING (public.is_active_backoffice_user());

DROP POLICY IF EXISTS backoffice_contract_versions_delete ON public.backoffice_contract_versions;
CREATE POLICY backoffice_contract_versions_delete ON public.backoffice_contract_versions
  FOR DELETE TO authenticated
  USING (public.is_active_backoffice_user());
