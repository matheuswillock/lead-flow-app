import { describe, expect, it } from "bun:test"
import { shouldShowDnsMissingAlerts } from "./domain-verification-visibility"

describe("shouldShowDnsMissingAlerts", () => {
  it("não mostra ausência de DKIM/SPF logo após adicionar o domínio", () => {
    expect(
      shouldShowDnsMissingAlerts({
        domainStatus: "pending",
        domainEvents: [{ type: "domain_added" }],
        verificationRequested: false,
      }),
    ).toBe(false)
  })

  it("mostra a ausência depois do clique em Verificar DNS", () => {
    expect(
      shouldShowDnsMissingAlerts({
        domainStatus: "pending",
        domainEvents: [{ type: "domain_added" }],
        verificationRequested: true,
      }),
    ).toBe(true)
  })

  it("preserva o alerta de uma verificação já falha ao reabrir a tela", () => {
    expect(
      shouldShowDnsMissingAlerts({
        domainStatus: "failed",
        domainEvents: [{ type: "domain_added" }, { type: "domain_failed" }],
        verificationRequested: false,
      }),
    ).toBe(true)
  })
})
