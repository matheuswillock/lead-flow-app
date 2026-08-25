import { describe, expect, it } from "bun:test"
import {
  isPendingLeadIdentity,
  isRealLeadIdentity,
  PENDING_LEAD_IDENTITY_PREFIX,
  PENDING_LEAD_IDENTITY_SQL_PATTERN,
  PENDING_LEAD_IDENTITY_STALE_MS,
} from "./lead-identity"

describe("isPendingLeadIdentity", () => {
  it("reconhece a reserva provisória", () => {
    expect(isPendingLeadIdentity("pending:1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed")).toBe(true)
  })

  it("um id de Lead real é uuid puro, nunca casa", () => {
    expect(isPendingLeadIdentity("1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed")).toBe(false)
    expect(isPendingLeadIdentity(null)).toBe(false)
    expect(isPendingLeadIdentity(undefined)).toBe(false)
    expect(isPendingLeadIdentity("")).toBe(false)
  })
})

describe("isRealLeadIdentity", () => {
  // Predicado único dos cinco consumidores. Divergir é como o perfil acabava
  // contado em crm_clients e fora de engaged_no_lead por causa de uma reserva.
  it("vínculo real com o CRM", () => {
    expect(
      isRealLeadIdentity({ type: "lead_id", normalizedValue: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed" })
    ).toBe(true)
  })

  it("reserva provisória não é vínculo", () => {
    expect(isRealLeadIdentity({ type: "lead_id", normalizedValue: "pending:abc" })).toBe(false)
  })

  it("identidade de outro tipo não é vínculo", () => {
    expect(isRealLeadIdentity({ type: "email", normalizedValue: "a@b.com" })).toBe(false)
    expect(isRealLeadIdentity({ type: "phone", normalizedValue: "5511987654321" })).toBe(false)
  })

  it("tolera type/normalizedValue ausentes", () => {
    expect(isRealLeadIdentity({})).toBe(false)
    expect(isRealLeadIdentity({ type: "lead_id" })).toBe(true)
    expect(isRealLeadIdentity({ type: null, normalizedValue: null })).toBe(false)
  })
})

describe("contrato do prefixo", () => {
  it("o padrão SQL deriva do prefixo — não são duas constantes soltas", () => {
    expect(PENDING_LEAD_IDENTITY_SQL_PATTERN).toBe(`${PENDING_LEAD_IDENTITY_PREFIX}%`)
  })

  it("a janela de reserva órfã é positiva e da ordem de minutos", () => {
    // Curta demais reabriria a corrida que a reserva existe para fechar;
    // longa demais deixa o perfil bloqueado esperando por uma liberação que
    // já falhou.
    expect(PENDING_LEAD_IDENTITY_STALE_MS).toBeGreaterThan(60_000)
    expect(PENDING_LEAD_IDENTITY_STALE_MS).toBeLessThanOrEqual(30 * 60 * 1000)
  })
})
