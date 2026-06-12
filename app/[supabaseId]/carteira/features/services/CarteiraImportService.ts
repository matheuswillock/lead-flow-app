import type { PortfolioImportRow } from "@/lib/portfolioImport/portfolioImportFields";
import type {
  CarteiraImportContext,
  CarteiraImportResult,
  ICarteiraImportService,
} from "./ICarteiraImportService";

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

    const output = await response.json().catch(() => null);
    if (!response.ok || !output?.isValid) {
      const message = output?.errorMessages?.[0] || "Falha ao importar clientes";
      throw new Error(message);
    }

    return {
      created: output.result?.created ?? 0,
      skipped: output.result?.skipped ?? 0,
      errors: output.result?.errors ?? [],
      issues: output.result?.issues ?? [],
    };
  }
}

export const carteiraImportService: ICarteiraImportService = new CarteiraImportService();
