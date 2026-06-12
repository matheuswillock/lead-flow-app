import type { LeadImportRow } from "@/lib/leadImport/leadImportFields";

export interface LeadImportContext {
  supabaseId: string;
  teamId: string;
}

export type LeadImportOutcomeKind = "created" | "created_default_status" | "skipped";

export interface LeadImportOutcome {
  name: string;
  outcome: LeadImportOutcomeKind;
  reason?: string;
}

export interface LeadImportResult {
  created: number;
  createdWithDefaultStatus: number;
  skipped: number;
  sanitized: number;
  errors: string[];
  leads: LeadImportOutcome[];
}

export interface ILeadImportService {
  importMappedLeads(rows: LeadImportRow[], ctx: LeadImportContext): Promise<LeadImportResult>;
}
