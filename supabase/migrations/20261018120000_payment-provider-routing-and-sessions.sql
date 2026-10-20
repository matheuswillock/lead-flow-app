-- PAY-PROV-T020/T022-T024: server-owned provider configuration, identities,
-- migration gates and durable session/attempt leases.
-- This migration is intentionally fail-closed: seeded configs are disabled and
-- production cannot route until the explicit rollout state is ACTIVE.

CREATE TYPE "payment_provider_key" AS ENUM ('ASAAS', 'ABACATE_PAY');
CREATE TYPE "payment_provider_environment" AS ENUM ('DEV', 'PRODUCTION');
CREATE TYPE "payment_provider_rollout_state" AS ENUM (
  'DISABLED', 'SANDBOX_VALIDATED', 'APPROVED', 'ACTIVE'
);
CREATE TYPE "payment_provider_health_status" AS ENUM ('UNKNOWN', 'HEALTHY', 'UNHEALTHY');
CREATE TYPE "payment_provider_route" AS ENUM ('NEW_ROUTER', 'LEGACY_ASAAS');
CREATE TYPE "payment_provider_identity_type" AS ENUM (
  'CUSTOMER', 'PAYMENT', 'SUBSCRIPTION', 'CHECKOUT', 'SESSION'
);
CREATE TYPE "payment_provider_migration_gate_status" AS ENUM (
  'PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED'
);
CREATE TYPE "payment_provider_session_status" AS ENUM (
  'OPEN', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELED'
);
CREATE TYPE "payment_provider_attempt_status" AS ENUM (
  'CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED', 'DISPUTED',
  'EXPIRED', 'CANCELED', 'UNKNOWN'
);

CREATE TABLE "payment_provider_configs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_key" "payment_provider_key" NOT NULL,
  "environment" "payment_provider_environment" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "external_account_context" TEXT NOT NULL,
  "rollout_state" "payment_provider_rollout_state" NOT NULL DEFAULT 'DISABLED',
  "kill_switch" BOOLEAN NOT NULL DEFAULT false,
  "config_revision" INTEGER NOT NULL DEFAULT 1,
  "health_status" "payment_provider_health_status" NOT NULL DEFAULT 'UNKNOWN',
  "last_health_check_at" TIMESTAMPTZ(6),
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "public_key_fingerprint" TEXT,
  "logo_url" TEXT,
  "logo_alt_text" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_provider_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_configs_provider_environment_key"
    UNIQUE ("provider_key", "environment"),
  CONSTRAINT "payment_provider_configs_context_not_blank"
    CHECK (length(btrim("external_account_context")) > 0),
  CONSTRAINT "payment_provider_configs_revision_positive"
    CHECK ("config_revision" > 0)
);
CREATE UNIQUE INDEX "payment_provider_configs_one_default_per_environment"
  ON "payment_provider_configs" ("environment") WHERE "is_default";
CREATE INDEX "payment_provider_configs_routing_idx"
  ON "payment_provider_configs" ("environment", "enabled", "rollout_state");
CREATE INDEX "payment_provider_configs_default_idx"
  ON "payment_provider_configs" ("environment", "is_default");

INSERT INTO "payment_provider_configs"
  ("provider_key", "environment", "enabled", "is_default", "external_account_context")
VALUES
  ('ABACATE_PAY', 'DEV', false, true, 'abacate-dev'),
  ('ABACATE_PAY', 'PRODUCTION', false, true, 'abacate-production')
ON CONFLICT ("provider_key", "environment") DO NOTHING;

CREATE TABLE "payment_provider_identities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_key" "payment_provider_key" NOT NULL,
  "environment" "payment_provider_environment" NOT NULL,
  "external_account_context" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "identity_type" "payment_provider_identity_type" NOT NULL,
  "owner_type" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "route" "payment_provider_route" NOT NULL,
  "route_version" TEXT NOT NULL,
  "binding_revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_provider_identities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_identities_external_scope_key"
    UNIQUE ("provider_key", "environment", "external_account_context", "external_id", "identity_type"),
  CONSTRAINT "payment_provider_identities_owner_scope_key"
    UNIQUE ("tenant_id", "provider_key", "environment", "external_account_context", "owner_type", "owner_id", "identity_type"),
  CONSTRAINT "payment_provider_identities_context_not_blank"
    CHECK (
      length(btrim("external_account_context")) > 0
      AND length(btrim("external_id")) > 0
      AND length(btrim("owner_type")) > 0
      AND length(btrim("owner_id")) > 0
      AND length(btrim("tenant_id")) > 0
      AND length(btrim("route_version")) > 0
    )
);
CREATE INDEX "payment_provider_identities_owner_idx"
  ON "payment_provider_identities" ("tenant_id", "owner_type", "owner_id");
CREATE INDEX "payment_provider_identities_route_idx"
  ON "payment_provider_identities" ("route", "route_version");

CREATE FUNCTION "protect_payment_provider_identity_binding"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."provider_key" IS DISTINCT FROM OLD."provider_key"
    OR NEW."environment" IS DISTINCT FROM OLD."environment"
    OR NEW."external_account_context" IS DISTINCT FROM OLD."external_account_context"
    OR NEW."external_id" IS DISTINCT FROM OLD."external_id"
    OR NEW."identity_type" IS DISTINCT FROM OLD."identity_type"
    OR NEW."owner_type" IS DISTINCT FROM OLD."owner_type"
    OR NEW."owner_id" IS DISTINCT FROM OLD."owner_id"
    OR NEW."tenant_id" IS DISTINCT FROM OLD."tenant_id"
    OR NEW."route" IS DISTINCT FROM OLD."route"
  THEN
    RAISE EXCEPTION 'payment provider identity binding is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "payment_provider_identities_immutable_binding"
  BEFORE UPDATE ON "payment_provider_identities"
  FOR EACH ROW EXECUTE FUNCTION "protect_payment_provider_identity_binding"();

CREATE TABLE "payment_provider_migration_gates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_route" "payment_provider_route" NOT NULL,
  "target_route" "payment_provider_route" NOT NULL,
  "version" TEXT NOT NULL,
  "environment" "payment_provider_environment" NOT NULL,
  "external_account_context" TEXT NOT NULL,
  "authorized_by_profile_id" UUID NOT NULL,
  "status" "payment_provider_migration_gate_status" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "activated_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_provider_migration_gates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_migration_gates_binding_key"
    UNIQUE ("source_route", "target_route", "version", "environment", "external_account_context"),
  CONSTRAINT "payment_provider_migration_gates_authorized_by_profile_id_fkey"
    FOREIGN KEY ("authorized_by_profile_id") REFERENCES "corretor_studio_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_provider_migration_gates_routes_differ"
    CHECK ("source_route" <> "target_route")
);
CREATE INDEX "payment_provider_migration_gates_status_expiry_idx"
  ON "payment_provider_migration_gates" ("status", "expires_at");
CREATE INDEX "payment_provider_migration_gates_authorized_by_idx"
  ON "payment_provider_migration_gates" ("authorized_by_profile_id");

CREATE TABLE "payment_provider_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" TEXT NOT NULL,
  "owner_type" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "environment" "payment_provider_environment" NOT NULL,
  "provider_key" "payment_provider_key" NOT NULL,
  "external_account_context" TEXT NOT NULL,
  "route" "payment_provider_route" NOT NULL,
  "route_version" TEXT NOT NULL,
  "status" "payment_provider_session_status" NOT NULL DEFAULT 'OPEN',
  "lease_token" UUID,
  "lease_until" TIMESTAMPTZ(6),
  "fence_version" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_provider_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_sessions_owner_idempotency_key"
    UNIQUE ("tenant_id", "owner_type", "owner_id", "idempotency_key"),
  CONSTRAINT "payment_provider_sessions_binding_not_blank"
    CHECK (
      length(btrim("tenant_id")) > 0
      AND length(btrim("owner_type")) > 0
      AND length(btrim("owner_id")) > 0
      AND length(btrim("idempotency_key")) > 0
      AND length(btrim("external_account_context")) > 0
      AND length(btrim("route_version")) > 0
    )
);
CREATE INDEX "payment_provider_sessions_status_expiry_idx"
  ON "payment_provider_sessions" ("status", "expires_at");
CREATE INDEX "payment_provider_sessions_lease_idx"
  ON "payment_provider_sessions" ("lease_until");

CREATE TABLE "payment_provider_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "provider_key" "payment_provider_key" NOT NULL,
  "environment" "payment_provider_environment" NOT NULL,
  "external_account_context" TEXT NOT NULL,
  "status" "payment_provider_attempt_status" NOT NULL DEFAULT 'CREATED',
  "external_id" TEXT,
  "lease_token" UUID,
  "lease_until" TIMESTAMPTZ(6),
  "fence_version" INTEGER NOT NULL DEFAULT 0,
  "unknown_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_provider_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_attempts_session_number_key"
    UNIQUE ("session_id", "attempt_number"),
  CONSTRAINT "payment_provider_attempts_provider_idempotency_key"
    UNIQUE ("provider_key", "environment", "external_account_context", "idempotency_key"),
  CONSTRAINT "payment_provider_attempts_provider_external_id_key"
    UNIQUE ("provider_key", "environment", "external_account_context", "external_id"),
  CONSTRAINT "payment_provider_attempts_binding_not_blank"
    CHECK (
      length(btrim("idempotency_key")) > 0
      AND length(btrim("request_fingerprint")) = 64
      AND length(btrim("external_account_context")) > 0
    ),
  CONSTRAINT "payment_provider_attempts_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "payment_provider_sessions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "payment_provider_attempts_session_status_idx"
  ON "payment_provider_attempts" ("session_id", "status");
CREATE INDEX "payment_provider_attempts_lease_idx"
  ON "payment_provider_attempts" ("lease_until");

ALTER TABLE "payment_provider_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_provider_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_provider_migration_gates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_provider_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_provider_attempts" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  "payment_provider_configs", "payment_provider_identities",
  "payment_provider_migration_gates", "payment_provider_sessions",
  "payment_provider_attempts"
FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE
  "payment_provider_configs", "payment_provider_identities",
  "payment_provider_migration_gates", "payment_provider_sessions",
  "payment_provider_attempts"
TO service_role;

CREATE POLICY "payment_provider_configs_service_role_all"
  ON "payment_provider_configs" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "payment_provider_identities_service_role_all"
  ON "payment_provider_identities" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "payment_provider_migration_gates_service_role_all"
  ON "payment_provider_migration_gates" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "payment_provider_sessions_service_role_all"
  ON "payment_provider_sessions" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "payment_provider_attempts_service_role_all"
  ON "payment_provider_attempts" FOR ALL TO service_role USING (true) WITH CHECK (true);
