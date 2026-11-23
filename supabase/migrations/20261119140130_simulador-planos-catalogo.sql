DO $$ BEGIN
  CREATE TYPE "public"."corretor_studio_health_plan_network_kind" as enum ('HOSPITAL', 'LAB');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

  create table if not exists "public"."corretor_studio_health_plan_catalog_imports" (
    "id" uuid not null,
    "source" text not null,
    "generatedAt" timestamp(6) with time zone not null,
    "counts" jsonb not null,
    "importedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );

  create table if not exists "public"."corretor_studio_health_plan_network_entries" (
    "id" uuid not null,
    "planoId" integer not null,
    "providerId" integer not null,
    "kind" public.corretor_studio_health_plan_network_kind not null,
    "atendimento" text[] default ARRAY[]::text[]
      );

  create table if not exists "public"."corretor_studio_health_plan_operators" (
    "id" uuid not null,
    "name" text not null,
    "logoPath" text not null
      );

  create table if not exists "public"."corretor_studio_health_plan_providers" (
    "id" integer not null,
    "nome" text not null,
    "bairro" text,
    "cidade" text,
    "uf" character varying(2),
    "regiao" text,
    "endereco" text,
    "site" text
      );

  create table if not exists "public"."corretor_studio_health_plan_rule_texts" (
    "id" character varying(64) not null,
    "texto" text not null
      );

  create table if not exists "public"."corretor_studio_health_plan_tables" (
    "id" uuid not null,
    "chave" text not null,
    "estado" character varying(2) not null,
    "cidade" text not null,
    "operatorId" uuid not null,
    "produto" text not null,
    "planoId" integer not null,
    "plano" text not null,
    "tabela" text not null,
    "acomodacao" text not null,
    "contratacao" text not null,
    "contratacaoPainel" text not null,
    "coparticipacao" text not null,
    "coparticipacaoTabela" text not null,
    "aceitaMei" boolean not null,
    "remissao" boolean not null,
    "vidasMin" integer not null,
    "vidasMinPainel" integer not null,
    "vidasMax" integer not null,
    "precos" jsonb not null,
    "regras" jsonb not null
      );

  create table if not exists "public"."corretor_studio_plan_quote_shares" (
    "id" uuid not null,
    "token" character varying(64) not null,
    "quoteId" uuid not null,
    "payload" jsonb not null,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "expiresAt" timestamp(6) with time zone
      );

  create table if not exists "public"."corretor_studio_plan_quotes" (
    "id" uuid not null,
    "teamId" uuid not null,
    "ownerProfileId" uuid not null,
    "nome" text not null,
    "state" jsonb not null,
    "resumo" jsonb,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );
CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_health_plan_catalog_imports_pkey ON public.corretor_studio_health_plan_catalog_imports USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_health_plan_network_entries_pkey ON public.corretor_studio_health_plan_network_entries USING btree (id);

CREATE INDEX IF NOT EXISTS "corretor_studio_health_plan_network_entries_planoId_idx" ON public.corretor_studio_health_plan_network_entries USING btree ("planoId");

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_health_plan_network_entries_planoId_provide_key" ON public.corretor_studio_health_plan_network_entries USING btree ("planoId", "providerId", kind);

CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_health_plan_operators_name_key ON public.corretor_studio_health_plan_operators USING btree (name);

CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_health_plan_operators_pkey ON public.corretor_studio_health_plan_operators USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_health_plan_providers_pkey ON public.corretor_studio_health_plan_providers USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_health_plan_rule_texts_pkey ON public.corretor_studio_health_plan_rule_texts USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_health_plan_tables_chave_key ON public.corretor_studio_health_plan_tables USING btree (chave);

CREATE INDEX IF NOT EXISTS corretor_studio_health_plan_tables_estado_idx ON public.corretor_studio_health_plan_tables USING btree (estado);

CREATE INDEX IF NOT EXISTS "corretor_studio_health_plan_tables_estado_operatorId_idx" ON public.corretor_studio_health_plan_tables USING btree (estado, "operatorId");

CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_health_plan_tables_pkey ON public.corretor_studio_health_plan_tables USING btree (id);

CREATE INDEX IF NOT EXISTS "corretor_studio_health_plan_tables_planoId_idx" ON public.corretor_studio_health_plan_tables USING btree ("planoId");
CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_plan_quote_shares_pkey ON public.corretor_studio_plan_quote_shares USING btree (id);

CREATE INDEX IF NOT EXISTS "corretor_studio_plan_quote_shares_quoteId_idx" ON public.corretor_studio_plan_quote_shares USING btree ("quoteId");

CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_plan_quote_shares_token_key ON public.corretor_studio_plan_quote_shares USING btree (token);

CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_plan_quotes_pkey ON public.corretor_studio_plan_quotes USING btree (id);

CREATE INDEX IF NOT EXISTS "corretor_studio_plan_quotes_teamId_ownerProfileId_idx" ON public.corretor_studio_plan_quotes USING btree ("teamId", "ownerProfileId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."corretor_studio_health_plan_catalog_imports"'::regclass AND contype = 'p') THEN
    alter table "public"."corretor_studio_health_plan_catalog_imports" add constraint "corretor_studio_health_plan_catalog_imports_pkey" PRIMARY KEY using index "corretor_studio_health_plan_catalog_imports_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."corretor_studio_health_plan_network_entries"'::regclass AND contype = 'p') THEN
    alter table "public"."corretor_studio_health_plan_network_entries" add constraint "corretor_studio_health_plan_network_entries_pkey" PRIMARY KEY using index "corretor_studio_health_plan_network_entries_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."corretor_studio_health_plan_operators"'::regclass AND contype = 'p') THEN
    alter table "public"."corretor_studio_health_plan_operators" add constraint "corretor_studio_health_plan_operators_pkey" PRIMARY KEY using index "corretor_studio_health_plan_operators_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."corretor_studio_health_plan_providers"'::regclass AND contype = 'p') THEN
    alter table "public"."corretor_studio_health_plan_providers" add constraint "corretor_studio_health_plan_providers_pkey" PRIMARY KEY using index "corretor_studio_health_plan_providers_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."corretor_studio_health_plan_rule_texts"'::regclass AND contype = 'p') THEN
    alter table "public"."corretor_studio_health_plan_rule_texts" add constraint "corretor_studio_health_plan_rule_texts_pkey" PRIMARY KEY using index "corretor_studio_health_plan_rule_texts_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."corretor_studio_health_plan_tables"'::regclass AND contype = 'p') THEN
    alter table "public"."corretor_studio_health_plan_tables" add constraint "corretor_studio_health_plan_tables_pkey" PRIMARY KEY using index "corretor_studio_health_plan_tables_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."corretor_studio_plan_quote_shares"'::regclass AND contype = 'p') THEN
    alter table "public"."corretor_studio_plan_quote_shares" add constraint "corretor_studio_plan_quote_shares_pkey" PRIMARY KEY using index "corretor_studio_plan_quote_shares_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."corretor_studio_plan_quotes"'::regclass AND contype = 'p') THEN
    alter table "public"."corretor_studio_plan_quotes" add constraint "corretor_studio_plan_quotes_pkey" PRIMARY KEY using index "corretor_studio_plan_quotes_pkey";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_health_plan_network_entries_providerId_fkey') THEN
    alter table "public"."corretor_studio_health_plan_network_entries" add constraint "corretor_studio_health_plan_network_entries_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public.corretor_studio_health_plan_providers(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;
  END IF;
END $$;

alter table "public"."corretor_studio_health_plan_network_entries" validate constraint "corretor_studio_health_plan_network_entries_providerId_fkey";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_health_plan_tables_operatorId_fkey') THEN
    alter table "public"."corretor_studio_health_plan_tables" add constraint "corretor_studio_health_plan_tables_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES public.corretor_studio_health_plan_operators(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;
  END IF;
END $$;

alter table "public"."corretor_studio_health_plan_tables" validate constraint "corretor_studio_health_plan_tables_operatorId_fkey";
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_plan_quote_shares_quoteId_fkey') THEN
    alter table "public"."corretor_studio_plan_quote_shares" add constraint "corretor_studio_plan_quote_shares_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES public.corretor_studio_plan_quotes(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
  END IF;
END $$;

alter table "public"."corretor_studio_plan_quote_shares" validate constraint "corretor_studio_plan_quote_shares_quoteId_fkey";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_plan_quotes_ownerProfileId_fkey') THEN
    alter table "public"."corretor_studio_plan_quotes" add constraint "corretor_studio_plan_quotes_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
  END IF;
END $$;

alter table "public"."corretor_studio_plan_quotes" validate constraint "corretor_studio_plan_quotes_ownerProfileId_fkey";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corretor_studio_plan_quotes_teamId_fkey') THEN
    alter table "public"."corretor_studio_plan_quotes" add constraint "corretor_studio_plan_quotes_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
  END IF;
END $$;

alter table "public"."corretor_studio_plan_quotes" validate constraint "corretor_studio_plan_quotes_teamId_fkey";
