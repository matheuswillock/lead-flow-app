import { describe, expect, it } from "bun:test"
import { isProviderRenewalEnabled, PROVIDER_RENEWAL_ENABLED_ENV } from "./renewal-kill-switch"
import { isInRenewalWindow, renewalIdempotencyKey } from "./renewal-cycle"

describe("isProviderRenewalEnabled", () => {
  it("fica desligado quando a variável está ausente", () => {
    expect(isProviderRenewalEnabled({})).toBe(false)
  })

  it("só liga com o valor literal true, sem diferenciar maiúsculas", () => {
    expect(isProviderRenewalEnabled({ [PROVIDER_RENEWAL_ENABLED_ENV]: "true" })).toBe(true)
    expect(isProviderRenewalEnabled({ [PROVIDER_RENEWAL_ENABLED_ENV]: " TRUE " })).toBe(true)
    expect(isProviderRenewalEnabled({ [PROVIDER_RENEWAL_ENABLED_ENV]: "1" })).toBe(false)
    expect(isProviderRenewalEnabled({ [PROVIDER_RENEWAL_ENABLED_ENV]: "" })).toBe(false)
  })
})

describe("renewalIdempotencyKey", () => {
  const dueDate = new Date("2026-12-10T03:00:00.000Z")

  it("é estável para a mesma assinatura e o mesmo vencimento", () => {
    expect(renewalIdempotencyKey({ profileId: "p1", dueDate })).toBe(
      renewalIdempotencyKey({ profileId: "p1", dueDate: new Date(dueDate) }),
    )
  })

  it("muda quando o vencimento muda (novo ciclo gera nova cobrança)", () => {
    const next = new Date("2027-01-10T03:00:00.000Z")
    expect(renewalIdempotencyKey({ profileId: "p1", dueDate })).not.toBe(
      renewalIdempotencyKey({ profileId: "p1", dueDate: next }),
    )
  })
})

describe("isInRenewalWindow", () => {
  const now = new Date("2026-12-05T12:00:00.000Z")

  it("aceita vencimento entre agora e 5 dias à frente", () => {
    expect(isInRenewalWindow(new Date("2026-12-05T12:00:00.000Z"), now)).toBe(true)
    expect(isInRenewalWindow(new Date("2026-12-10T12:00:00.000Z"), now)).toBe(true)
  })

  it("recusa vencimento além da janela ou já passado", () => {
    expect(isInRenewalWindow(new Date("2026-12-10T12:00:01.000Z"), now)).toBe(false)
    expect(isInRenewalWindow(new Date("2026-12-05T11:59:59.000Z"), now)).toBe(false)
  })
})
