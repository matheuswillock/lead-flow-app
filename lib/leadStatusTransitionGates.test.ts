import { describe, expect, it } from "bun:test"
import {
  getBuiltinAllowedTargetStatuses,
  isTransitionAllowedByGates,
  type LeadStatusTransitionGateRow,
} from "@/lib/leadStatusTransitionGates"

/** Espelha o config gravado pelo seed/migration `new_opportunity_allowed_targets`. */
function buildNewOpportunityGate(
  allowedTargetStatuses: string[]
): LeadStatusTransitionGateRow[] {
  return [
    {
      id: "gate-new-opportunity",
      slug: "new_opportunity_allowed_targets",
      name: "Nova oportunidade: destinos permitidos",
      gateType: "allowed_target_statuses",
      sourceStatus: "new_opportunity",
      targetStatus: null,
      config: { allowedTargetStatuses },
      blockerType: "validation_error",
      errorMessage: null,
      isEnabled: true,
      sortOrder: 10,
    },
  ]
}

describe("getBuiltinAllowedTargetStatuses", () => {
  it("inclui disqualified como destino permitido a partir de new_opportunity", () => {
    const allowed = getBuiltinAllowedTargetStatuses("new_opportunity")
    expect(allowed).toContain("disqualified")
  })

  it("mantém os destinos já permitidos (scheduled, future_sale, opportunityLost)", () => {
    const allowed = getBuiltinAllowedTargetStatuses("new_opportunity")
    expect(allowed).toEqual(
      expect.arrayContaining(["scheduled", "future_sale", "opportunityLost"])
    )
  })
})

describe("isTransitionAllowedByGates — new_opportunity com gate do banco atualizado", () => {
  const gates = buildNewOpportunityGate([
    "scheduled",
    "future_sale",
    "opportunityLost",
    "disqualified",
  ])

  it("permite new_opportunity -> disqualified", () => {
    expect(isTransitionAllowedByGates(gates, "new_opportunity", "disqualified")).toBe(true)
  })

  it("continua permitindo os destinos pré-existentes", () => {
    expect(isTransitionAllowedByGates(gates, "new_opportunity", "scheduled")).toBe(true)
    expect(isTransitionAllowedByGates(gates, "new_opportunity", "future_sale")).toBe(true)
    expect(isTransitionAllowedByGates(gates, "new_opportunity", "opportunityLost")).toBe(true)
  })

  it("continua bloqueando destinos fora da whitelist", () => {
    expect(isTransitionAllowedByGates(gates, "new_opportunity", "offerNegotiation")).toBe(false)
    expect(isTransitionAllowedByGates(gates, "new_opportunity", "contract_finalized")).toBe(false)
    expect(isTransitionAllowedByGates(gates, "new_opportunity", "invoicePayment")).toBe(false)
  })
})

describe("isTransitionAllowedByGates — gate customizado (alvo extra preservado pela migration aditiva)", () => {
  const gates = buildNewOpportunityGate([
    "scheduled",
    "opportunityLost",
    "no_show",
    "disqualified",
  ])

  it("permite disqualified e preserva o alvo customizado no_show", () => {
    expect(isTransitionAllowedByGates(gates, "new_opportunity", "disqualified")).toBe(true)
    expect(isTransitionAllowedByGates(gates, "new_opportunity", "no_show")).toBe(true)
  })

  it("não reintroduz future_sale se o manager não o tinha customizado", () => {
    expect(isTransitionAllowedByGates(gates, "new_opportunity", "future_sale")).toBe(false)
  })
})
