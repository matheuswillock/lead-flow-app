import { describe, expect, it } from "bun:test"
import {
  canCreateLeadFromExtracted,
  resolveLeadDiscardReason,
  type ExtractedLeadData,
} from "@/lib/public-forms/lead-identity"

/**
 * SPEC 40 — E2/DA2. O motivo do descarte já era computado (`buildLeadSyncAlerts`)
 * e morria em `errorMessage`: string livre não agrega, não alarma e não entra no
 * funil. `resolveLeadDiscardReason` é o mesmo julgamento do gate — reusando
 * `canCreateLeadFromExtracted`/`canUpdateLeadFromExtracted` — devolvendo um
 * motivo estável que vira `origin.reason` do evento.
 */

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

const NEW_LEAD = { hasMatchingLead: false }
const EXISTING_LEAD = { hasMatchingLead: true }

describe("resolveLeadDiscardReason", () => {
  it("sem nome nenhum", () => {
    expect(
      resolveLeadDiscardReason(extracted({ normalizedPhone: "11987654321" }), NEW_LEAD),
    ).toBe("sem_nome")
  })

  it("nome que não é de pessoa", () => {
    expect(
      resolveLeadDiscardReason(
        extracted({ name: "contato@empresa.com", normalizedPhone: "11987654321" }),
        NEW_LEAD,
      ),
    ).toBe("nome_invalido")
  })

  it("sem telefone", () => {
    expect(resolveLeadDiscardReason(extracted({ name: "Maria Silva" }), NEW_LEAD)).toBe(
      "sem_telefone",
    )
  })

  it("telefone que não é brasileiro válido", () => {
    expect(
      resolveLeadDiscardReason(extracted({ name: "Maria Silva", normalizedPhone: "123" }), NEW_LEAD),
    ).toBe("telefone_invalido")
  })

  it("identidade completa não é descarte", () => {
    expect(
      resolveLeadDiscardReason(
        extracted({ name: "Maria Silva", normalizedPhone: "11987654321" }),
        NEW_LEAD,
      ),
    ).toBeNull()
  })

  it("lead já existente sem nenhum contato para atualizar", () => {
    expect(resolveLeadDiscardReason(extracted({ name: "Maria Silva" }), EXISTING_LEAD)).toBe(
      "sem_contato",
    )
  })

  it("lead já existente com e-mail é atualizável", () => {
    expect(
      resolveLeadDiscardReason(extracted({ name: "Maria Silva", email: "a@b.com" }), EXISTING_LEAD),
    ).toBeNull()
  })

  /**
   * O motivo tem de concordar com o gate: toda combinação que o gate recusa
   * precisa ter motivo, e nenhuma que ele aceita pode ter. Sem este par, o
   * contador de descartes conta uma população e o CRM cria outra.
   */
  it("concorda com o gate em toda combinação de nome × telefone", () => {
    const names = ["", "Maria Silva", "contato@empresa.com", "Clinica Boa Saude LTDA"]
    const phones = ["", "11987654321", "123", "1132654321"]
    for (const name of names) {
      for (const normalizedPhone of phones) {
        const data = extracted({ name, normalizedPhone })
        expect(resolveLeadDiscardReason(data, NEW_LEAD) === null).toBe(
          canCreateLeadFromExtracted(data),
        )
      }
    }
  })
})
