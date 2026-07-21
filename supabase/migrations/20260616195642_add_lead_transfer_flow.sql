ALTER TABLE "public"."corretor_studio_profiles"
  ADD COLUMN IF NOT EXISTS "canTransferAccountLeads" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."corretor_studio_leads"
  ADD COLUMN IF NOT EXISTS "isTransfer" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_team_transfer_routes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceTeamId" uuid NOT NULL,
  "targetTeamId" uuid NOT NULL,
  "createdBy" uuid NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_team_transfer_routes_sourceTeamId_fkey"
    FOREIGN KEY ("sourceTeamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE,
  CONSTRAINT "corretor_studio_team_transfer_routes_targetTeamId_fkey"
    FOREIGN KEY ("targetTeamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE,
  CONSTRAINT "corretor_studio_team_transfer_routes_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE SET NULL,
  CONSTRAINT "corretor_studio_team_transfer_routes_source_target_unique"
    UNIQUE ("sourceTeamId", "targetTeamId")
);

CREATE INDEX IF NOT EXISTS "corretor_studio_team_transfer_routes_target_idx"
  ON "public"."corretor_studio_team_transfer_routes" ("targetTeamId");

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_lead_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "leadId" uuid NOT NULL,
  "fromTeamId" uuid NOT NULL,
  "toTeamId" uuid NOT NULL,
  "transferredByProfileId" uuid NOT NULL,
  "receivedByProfileId" uuid NULL,
  "fromManagerId" uuid NOT NULL,
  "toManagerId" uuid NOT NULL,
  "transferTagUsed" boolean NOT NULL DEFAULT false,
  "preScheduledAt" timestamptz(6) NULL,
  "scheduledAtTransfer" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_lead_transfers_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "public"."corretor_studio_leads"("id") ON DELETE CASCADE,
  CONSTRAINT "corretor_studio_lead_transfers_fromTeamId_fkey"
    FOREIGN KEY ("fromTeamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE,
  CONSTRAINT "corretor_studio_lead_transfers_toTeamId_fkey"
    FOREIGN KEY ("toTeamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE,
  CONSTRAINT "corretor_studio_lead_transfers_transferredByProfileId_fkey"
    FOREIGN KEY ("transferredByProfileId") REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "corretor_studio_lead_transfers_receivedByProfileId_fkey"
    FOREIGN KEY ("receivedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_transfers_lead_created_idx"
  ON "public"."corretor_studio_lead_transfers" ("leadId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_transfers_from_team_created_idx"
  ON "public"."corretor_studio_lead_transfers" ("fromTeamId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_transfers_to_team_created_idx"
  ON "public"."corretor_studio_lead_transfers" ("toTeamId", "createdAt" DESC);
