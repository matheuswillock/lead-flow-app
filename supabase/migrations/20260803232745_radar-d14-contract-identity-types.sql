-- D14: identity types for contract holder/dependent profiles + source type for LeadFinalized sync

ALTER TYPE "public"."radar_identity_type" ADD VALUE IF NOT EXISTS 'contract_holder';
ALTER TYPE "public"."radar_identity_type" ADD VALUE IF NOT EXISTS 'contract_dependent';
ALTER TYPE "public"."radar_source_type" ADD VALUE IF NOT EXISTS 'lead_finalized';
