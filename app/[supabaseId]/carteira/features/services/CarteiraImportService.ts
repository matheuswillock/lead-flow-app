import type { PortfolioImportRow } from "@/lib/portfolioImport/portfolioImportFields";
import {
  getImportHttpErrorMessage,
  parseImportOutputResponse,
  runImportInBatches,
} from "@/lib/import/importBatchClient";
import type {
  CarteiraImportContext,
  CarteiraImportResult,
  ICarteiraImportService,
} from "./ICarteiraImportService";

type CarteiraImportApiResult = {
  created?: number;
  skipped?: number;
  errors?: string[];
  issues?: CarteiraImportResult["issues"];
};

function mergeCarteiraImportResults(
  current: CarteiraImportResult,
  batch: CarteiraImportResult
): CarteiraImportResult {
  return {
    created: current.created + batch.created,
    skipped: current.skipped + batch.skipped,
    errors: [...current.errors, ...batch.errors],
    issues: [...current.issues, ...batch.issues],
  };
}

function mapCarteiraImportApiResult(result: CarteiraImportApiResult | undefined): CarteiraImportResult {
  return {
    created: result?.created ?? 0,
    skipped: result?.skipped ?? 0,
    errors: result?.errors ?? [],
    issues: result?.issues ?? [],
  };
}

export class CarteiraImportService implements ICarteiraImportService {
  async importMappedClients(
    rows: PortfolioImportRow[],
    ctx: CarteiraImportContext
  ): Promise<CarteiraImportResult> {
    const response = await fetch("/api/v1/portfolio/import/mapped", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": ctx.supabaseId,
        "x-team-id": ctx.teamId,
      },
      body: JSON.stringify({ rows, closerId: ctx.closerId, source: ctx.source }),
    });

    const output = await parseImportOutputResponse<CarteiraImportApiResult>(
      response,
      "clientes"
    );
    if (!response.ok || !output.isValid) {
      throw new Error(
        output.errorMessages?.[0] || getImportHttpErrorMessage(response.status, "clientes")
      );
    }

    return mapCarteiraImportApiResult(output.result);
  }

  async importMappedClientsInBatches(
    rows: PortfolioImportRow[],
    ctx: CarteiraImportContext,
    options?: {
      onProgress?: (processed: number, total: number) => void;
    }
  ): Promise<CarteiraImportResult> {
    return runImportInBatches({
      rows,
      onProgress: options?.onProgress,
      emptyResult: {
        created: 0,
        skipped: 0,
        errors: [],
        issues: [],
      },
      importBatch: (batch) => this.importMappedClients(batch, ctx),
      mergeResults: mergeCarteiraImportResults,
    });
  }
}

export const carteiraImportService: ICarteiraImportService = new CarteiraImportService();
