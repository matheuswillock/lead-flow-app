import { describe, expect, it } from "bun:test"
import { shouldShowDnsMissingAlerts } from "./domain-verification-visibility"

describe("shouldShowDnsMissingAlerts", () => {
  it("não mostra ausência de DKIM/SPF logo após adicionar o domínio", () => {
    expect(
      shouldShowDnsMissingAlerts({
        domainName: "mail.acme.com",
        domainEvents: [{ type: "domain_added" }],
        verificationRequested: false,
      }),
    ).toBe(false)
  })

  it("mostra a ausência depois do clique em Verificar DNS", () => {
    expect(
      shouldShowDnsMissingAlerts({
        domainName: "mail.acme.com",
        domainEvents: [{ type: "domain_added" }],
        verificationRequested: true,
      }),
    ).toBe(true)
  })

  it("preserva o alerta de uma verificação já falha ao reabrir a tela", () => {
    expect(
      shouldShowDnsMissingAlerts({
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
        domainName: "mail.acme.com",
        domainEvents: [{ type: "domain_added" }],
        verificationRequested: false,
      }),
    ).toBe(false)
  })

  it("mostra a ausência quando a verificação parcial registrou falha para o domínio atual", () => {
    expect(
      shouldShowDnsMissingAlerts({
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
        domainName: "new.acme.com",
        domainEvents: [{ type: "domain_failed", metadata: { domainName: "old.acme.com" } }],
        verificationRequested: false,
      }),
    ).toBe(false)
  })
})
