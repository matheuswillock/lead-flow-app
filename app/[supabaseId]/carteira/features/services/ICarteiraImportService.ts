import type { PortfolioImportRow } from "@/lib/portfolioImport/portfolioImportFields";

export type CarteiraImportSource = "manual" | "brokerage_transfer";

export interface CarteiraImportContext {
  supabaseId: string;
  teamId: string;
  closerId: string;
  source: CarteiraImportSource;
}

export interface CarteiraImportRowIssue {
  line: number | null;
  name: string;
  reason: string;
}

export interface CarteiraImportResult {
  created: number;
  skipped: number;
  errors: string[];
  issues: CarteiraImportRowIssue[];
}

export interface ICarteiraImportService {
  importMappedClients(
    rows: PortfolioImportRow[],
    ctx: CarteiraImportContext
  ): Promise<CarteiraImportResult>;
}
