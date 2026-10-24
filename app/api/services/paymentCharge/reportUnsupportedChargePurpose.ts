import * as Sentry from "@sentry/nextjs"
import type { UnsupportedPurposeReport } from "./PaymentChargeSettlementService"

/** Cobrança confirmada cuja finalidade não tem aplicador: dinheiro entrou e nada foi liberado. */
export function reportUnsupportedChargePurpose(report: UnsupportedPurposeReport): void {
  console.error("[PaymentChargeSettlement][unsupported-purpose]", report)
  Sentry.captureMessage("Cobrança confirmada com finalidade sem aplicador de domínio", {
    level: "error",
    tags: { route: "PaymentChargeSettlement", phase: "unsupported-purpose", purpose: report.purpose },
    extra: report,
  })
}
