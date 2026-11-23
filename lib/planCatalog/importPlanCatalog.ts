import { planCatalogFileSchema } from "./planCatalogSchema";
import { transformPlanCatalog, type PlanCatalogRows } from "./planCatalogTransform";

export interface IPlanCatalogRepository {
  /** Substitui o catálogo inteiro numa transação. Idempotente: a mesma base gera o mesmo estado. */
  replaceCatalog(rows: PlanCatalogRows, meta: PlanCatalogImportMeta): Promise<void>;
}

export type PlanCatalogImportMeta = {
  source: string;
  generatedAt: Date;
  counts: Record<string, number>;
};

export type PlanCatalogImportResult =
  | { ok: true; counts: Record<string, number> }
  | { ok: false; issues: string[] };

/**
 * Valida a base, transforma e grava. Nada é gravado se houver qualquer
 * inconsistência: o catálogo publicado nunca fica pela metade.
 */
export async function importPlanCatalog(
  raw: unknown,
  repo: IPlanCatalogRepository,
  options: { source: string; dryRun: boolean },
): Promise<PlanCatalogImportResult> {
  const parsed = planCatalogFileSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`) };
  }

  const { rows, issues } = transformPlanCatalog(parsed.data);
  if (issues.length > 0) return { ok: false, issues };

  const counts = {
    operators: rows.operators.length,
    tables: rows.tables.length,
    ruleTexts: rows.ruleTexts.length,
    providers: rows.providers.length,
    networkEntries: rows.networkEntries.length,
  };

  if (!options.dryRun) {
    await repo.replaceCatalog(rows, {
      source: options.source,
      generatedAt: new Date(parsed.data.sobre.geradoEm),
      counts,
    });
  }

  return { ok: true, counts };
}
