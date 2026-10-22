import * as Sentry from "@sentry/nextjs"
import type { Divergence } from "./ChargeDivergenceService"

const MAX_REPORTED = 20

/** Só valores e ids internos; nenhum dado pessoal nem segredo. */
export function reportChargeDivergences(divergences: readonly Divergence[]): void {
  const sample = divergences.slice(0, MAX_REPORTED)
  console.error("[ChargeDivergence] divergências entre ledger e fonte", { total: divergences.length, sample })
  Sentry.captureMessage("Divergência entre o ledger de cobranças e a fonte", {
    level: "warning",
    tags: { route: "ChargeDivergence" },
    extra: { total: divergences.length, sample },
  })
}
