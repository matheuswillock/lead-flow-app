import { describe, expect, it } from "bun:test"
import type { ExtractedLeadData } from "./lead-identity"
import { buildLeadSyncAlerts, formatLeadSyncAlerts } from "./lead-sync-alerts"

function extracted(overrides: Partial<ExtractedLeadData> = {}): ExtractedLeadData {
  return {
    native: {},
    custom: {},
    notes: [],
    name: "",
    email: "",
    phone: "",
    normalizedPhone: "",
    ...overrides,
  }
}

describe("buildLeadSyncAlerts", () => {
  it("alerta campos de identidade ausentes", () => {
    const alerts = buildLeadSyncAlerts(extracted(), undefined)
    expect(alerts).toEqual([
      "Nome ausente",
      "E-mail ausente",
      "Telefone ausente",
      "Não foi possível criar o lead: informe nome e telefone",
    ])
  })

  it("permite criar lead quando há nome e telefone", () => {
    const alerts = buildLeadSyncAlerts(
      extracted({ name: "Maria", phone: "(11) 99999-9999", normalizedPhone: "11999999999" }),
      undefined,
    )
    expect(alerts).toEqual(["E-mail ausente"])
  })

  it("exige telefone ou e-mail para atualizar lead existente", () => {
    const alerts = buildLeadSyncAlerts(extracted({ name: "Maria" }), { id: "lead-1" } as never)
    expect(alerts).toContain("E-mail ausente")
    expect(alerts).toContain("Telefone ausente")
    expect(alerts).toContain("Não foi possível atualizar o lead: informe telefone ou e-mail")
  })
})

describe("formatLeadSyncAlerts", () => {
  it("retorna undefined quando não há alertas", () => {
    expect(formatLeadSyncAlerts([])).toBeUndefined()
  })

  it("concatena alertas únicos", () => {
    expect(formatLeadSyncAlerts(["Nome ausente", "Nome ausente", "Telefone ausente"])).toBe(
      "Nome ausente; Telefone ausente",
    )
  })
})
