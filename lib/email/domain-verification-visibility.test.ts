import { describe, expect, it } from "bun:test"
import { shouldShowDnsMissingAlerts } from "./domain-verification-visibility"

describe("shouldShowDnsMissingAlerts", () => {
  it("não mostra ausência de DKIM/SPF logo após adicionar o domínio", () => {
    expect(
      shouldShowDnsMissingAlerts({
        domainStatus: "pending",
        domainName: "mail.acme.com",
        domainEvents: [{ type: "domain_added" }],
        verificationRequested: false,
      }),
    ).toBe(false)
  })

  it("mostra a ausência depois do clique em Verificar DNS", () => {
    expect(
      shouldShowDnsMissingAlerts({
        domainStatus: "pending",
        domainName: "mail.acme.com",
        domainEvents: [{ type: "domain_added" }],
        verificationRequested: true,
      }),
    ).toBe(true)
  })

  it("preserva o alerta de uma verificação já falha ao reabrir a tela", () => {
    expect(
      shouldShowDnsMissingAlerts({
        domainStatus: "failed",
        domainName: "mail.acme.com",
        domainEvents: [
          { type: "domain_added" },
          { type: "domain_failed", metadata: { domainName: "mail.acme.com" } },
        ],
        verificationRequested: false,
      }),
    ).toBe(true)
  })

  it("não mostra a ausência quando o domínio está parcialmente verificado sem uma falha registrada", () => {
    expect(
      shouldShowDnsMissingAlerts({
        domainStatus: "partially_verified",
        domainName: "mail.acme.com",
        domainEvents: [{ type: "domain_added" }],
        verificationRequested: false,
      }),
    ).toBe(false)
  })

  it("mostra a ausência quando a verificação parcial registrou falha para o domínio atual", () => {
    expect(
      shouldShowDnsMissingAlerts({
        domainStatus: "partially_verified",
        domainName: "mail.acme.com",
        domainEvents: [
          { type: "domain_added" },
          { type: "domain_failed", metadata: { domainName: "mail.acme.com" } },
        ],
        verificationRequested: false,
      }),
    ).toBe(true)
  })

  it("ignora falha registrada para um domínio anterior", () => {
    expect(
      shouldShowDnsMissingAlerts({
        domainStatus: "pending",
        domainName: "new.acme.com",
        domainEvents: [{ type: "domain_failed", metadata: { domainName: "old.acme.com" } }],
        verificationRequested: false,
      }),
    ).toBe(false)
  })
})
