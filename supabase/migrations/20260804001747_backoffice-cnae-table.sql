CREATE TABLE IF NOT EXISTS "public"."backoffice_cnaes" (
  "id"        SERIAL        PRIMARY KEY,
  "code"      VARCHAR(10)   NOT NULL,
  "name"      TEXT          NOT NULL,
  "isActive"  BOOLEAN       NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_cnaes_code_key" UNIQUE ("code")
);

CREATE INDEX IF NOT EXISTS "backoffice_cnaes_code_idx" ON "public"."backoffice_cnaes" ("code");
