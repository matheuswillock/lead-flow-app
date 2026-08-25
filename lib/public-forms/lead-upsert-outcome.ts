import type { Lead } from "@prisma/client"
import type { PublicFormLeadDiscardReason } from "./lead-identity"

/**
 * SPEC 40 E2/DA2 — os quatro desfechos de `upsertLeadFromFormAnswers`.
 *
 * O `null` seco de antes não dizia se o lead foi recusado, se a chamada nem
 * tentava criar, ou se não havia o que fazer — e o motivo morria como texto em
 * `errorMessage`, invisível ao funil.
 *
 * `skipped` ≠ `discarded`: no modo radar o caminho B chama com
 * `allowCreate:false` **de propósito** (quem promove é o gate C). Contar isso
 * como descarte encheria o funil de não-eventos.
 *
 * Mora aqui, e não em `publicFormLeadSync`, porque é tipo + função pura: os
 * testes que trocam aquele módulo inteiro por um mock continuam enxergando
 * este helper.
 */
export type UpsertLeadOutcome =
  | { outcome: "created"; lead: Lead }
  | { outcome: "updated"; lead: Lead }
  | { outcome: "discarded"; reason: PublicFormLeadDiscardReason }
  | { outcome: "skipped" }

export function leadFromUpsertOutcome(outcome: UpsertLeadOutcome | null): Lead | null {
  if (!outcome) return null
  return outcome.outcome === "created" || outcome.outcome === "updated" ? outcome.lead : null
}
