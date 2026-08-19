import type { LeadImportRow } from "@/lib/leadImport/leadImportFields";

export interface LeadImportContext {
  supabaseId: string;
  teamId: string;
}

export interface LeadImportRowIssue {
  line: number | null;
  name: string;
  kind: "not_imported" | "default_status" | "duplicate_detected" | "email_flagged";
  reason: string;
}

export interface LeadImportResult {
  created: number;
  createdWithDefaultStatus: number;
  skipped: number;
  sanitized: number;
  errors: string[];
  issues: LeadImportRowIssue[];
}

export interface ILeadImportService {
  importMappedLeads(rows: LeadImportRow[], ctx: LeadImportContext): Promise<LeadImportResult>;
  importMappedLeadsInBatches(
    rows: LeadImportRow[],
    ctx: LeadImportContext,
    options?: {
      onProgress?: (processed: number, total: number) => void;
    }
  ): Promise<LeadImportResult>;
}
