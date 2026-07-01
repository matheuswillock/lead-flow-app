import type { LeadImportRow } from "@/lib/leadImport/leadImportFields";
import {
  getImportHttpErrorMessage,
  parseImportOutputResponse,
  runImportInBatches,
} from "@/lib/import/importBatchClient";
import type {
  ILeadImportService,
  LeadImportContext,
  LeadImportResult,
} from "./ILeadImportService";

type LeadImportApiResult = {
  created?: number;
  createdWithDefaultStatus?: number;
  skipped?: number;
  sanitized?: number;
  errors?: string[];
  issues?: LeadImportResult["issues"];
};

function mergeLeadImportResults(
  current: LeadImportResult,
  batch: LeadImportResult
): LeadImportResult {
  return {
    created: current.created + batch.created,
    createdWithDefaultStatus: current.createdWithDefaultStatus + batch.createdWithDefaultStatus,
    skipped: current.skipped + batch.skipped,
    sanitized: current.sanitized + batch.sanitized,
    errors: [...current.errors, ...batch.errors],
    issues: [...current.issues, ...batch.issues],
  };
}

function mapLeadImportApiResult(result: LeadImportApiResult | undefined): LeadImportResult {
  return {
    created: result?.created ?? 0,
    createdWithDefaultStatus: result?.createdWithDefaultStatus ?? 0,
    skipped: result?.skipped ?? 0,
    sanitized: result?.sanitized ?? 0,
    errors: result?.errors ?? [],
    issues: result?.issues ?? [],
  };
}

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

    const output = await parseImportOutputResponse<LeadImportApiResult>(response, "leads");
    if (!response.ok || !output.isValid) {
      throw new Error(
        output.errorMessages?.[0] || getImportHttpErrorMessage(response.status, "leads")
      );
    }

    return mapLeadImportApiResult(output.result);
  }

  async importMappedLeadsInBatches(
    rows: LeadImportRow[],
    ctx: LeadImportContext,
    options?: {
      onProgress?: (processed: number, total: number) => void;
    }
  ): Promise<LeadImportResult> {
    return runImportInBatches({
      rows,
      onProgress: options?.onProgress,
      emptyResult: {
        created: 0,
        createdWithDefaultStatus: 0,
        skipped: 0,
        sanitized: 0,
        errors: [],
        issues: [],
      },
      importBatch: (batch) => this.importMappedLeads(batch, ctx),
      mergeResults: mergeLeadImportResults,
    });
  }
}

export const leadImportService: ILeadImportService = new LeadImportService();
