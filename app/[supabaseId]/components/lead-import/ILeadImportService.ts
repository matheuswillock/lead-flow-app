import type { LeadImportRow } from "@/lib/leadImport/leadImportFields";

export interface LeadImportContext {
  supabaseId: string;
  teamId: string;
}

export interface LeadImportResult {
  created: number;
  skipped: number;
  sanitized: number;
  errors: string[];
}

export interface ILeadImportService {
  importMappedLeads(rows: LeadImportRow[], ctx: LeadImportContext): Promise<LeadImportResult>;
}
