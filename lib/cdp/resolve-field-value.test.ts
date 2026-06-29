import { describe, expect, it } from "bun:test"
import { buildProfileDataMap, resolveCdpFieldValue } from "@/lib/cdp/resolve-field-value"

const baseProfile = {
  displayName: "Maria Silva",
  displayPhone: "(11) 99999-0000",
  primaryEmail: "maria@example.com",
  primaryDocument: "12345678900",
  lastSeenAt: new Date("2026-06-01T12:00:00.000Z"),
  consents: [{ channel: "email", status: "allowed" as const }],
  sourceLinks: [
    {
      sourceType: "portfolio" as const,
      sourceMetadata: {
        renewalStatus: "to_renew",
        portfolioStatus: "active",
        renewalAmount: "1500.50",
      },
    },
  ],
  identities: [{ type: "lead_id", normalizedValue: "lead-1" }],
}

const baseLead = {
  status: "contract_finalized",
  currentHealthPlan: "Unimed",
  soldPlan: "Plano Ouro",
  contractDueDate: new Date("2026-12-01T00:00:00.000Z"),
  referenceHospital: "Hospital São Lucas",
}

describe("resolveCdpFieldValue", () => {
  it("resolve campos do perfil CDP", () => {
    expect(resolveCdpFieldValue("profile.displayName", baseProfile, null)).toBe("Maria Silva")
    expect(resolveCdpFieldValue("profile.primaryEmail", baseProfile, null)).toBe("maria@example.com")
  })

  it("resolve campos do CRM quando lead está disponível", () => {
    expect(resolveCdpFieldValue("crm.lead.soldPlan", baseProfile, baseLead)).toBe("Plano Ouro")
    expect(resolveCdpFieldValue("crm.lead.soldPlan", baseProfile, null)).toBe("")
  })

  it("resolve campos da carteira via sourceMetadata", () => {
    expect(resolveCdpFieldValue("portfolio.renewalStatus", baseProfile, null)).toBe("to_renew")
  })

  it("materializa profileData com chaves de variável", () => {
    const profileData = buildProfileDataMap(
      [
        { key: "operadora", cdpFieldKey: "crm.lead.currentHealthPlan" },
        { key: "nome_cliente", cdpFieldKey: "profile.displayName" },
      ],
      baseProfile,
      baseLead
    )

    expect(profileData.operadora).toBe("Unimed")
    expect(profileData.nome_cliente).toBe("Maria Silva")
  })
})
