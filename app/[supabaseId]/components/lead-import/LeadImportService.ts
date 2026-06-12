import type { LeadImportRow } from "@/lib/leadImport/leadImportFields";
import type {
  ILeadImportService,
  LeadImportContext,
  LeadImportResult,
} from "./ILeadImportService";

export class LeadImportService implements ILeadImportService {
  async importMappedLeads(rows: LeadImportRow[], ctx: LeadImportContext): Promise<LeadImportResult> {
    const response = await fetch("/api/v1/leads/import/mapped", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": ctx.supabaseId,
        "x-team-id": ctx.teamId,
      },
      body: JSON.stringify({ rows }),
    });

    const output = await response.json().catch(() => null);
    if (!response.ok || !output?.isValid) {
      const message = output?.errorMessages?.[0] || "Falha ao importar leads";
      throw new Error(message);
    }

    return {
      created: output.result?.created ?? 0,
      createdWithDefaultStatus: output.result?.createdWithDefaultStatus ?? 0,
      skipped: output.result?.skipped ?? 0,
      sanitized: output.result?.sanitized ?? 0,
      errors: output.result?.errors ?? [],
      leads: output.result?.leads ?? [],
    };
  }
}

export const leadImportService: ILeadImportService = new LeadImportService();
