import { describe, expect, it } from "bun:test"
import {
  buildProfileDataMap,
  mergeImportedBaseProfileData,
  resolveRadarFieldValue,
} from "@/lib/radar/resolve-field-value"

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

describe("resolveRadarFieldValue", () => {
  it("resolve campos do perfil Radar", () => {
    expect(resolveRadarFieldValue("profile.displayName", baseProfile, null)).toBe("Maria Silva")
    expect(resolveRadarFieldValue("profile.primaryEmail", baseProfile, null)).toBe("maria@example.com")
  })

  it("resolve campos do CRM quando lead está disponível", () => {
    expect(resolveRadarFieldValue("crm.lead.soldPlan", baseProfile, baseLead)).toBe("Plano Ouro")
    expect(resolveRadarFieldValue("crm.lead.soldPlan", baseProfile, null)).toBe("")
  })

  it("resolve campos da carteira via sourceMetadata", () => {
    expect(resolveRadarFieldValue("portfolio.renewalStatus", baseProfile, null)).toBe("to_renew")
  })

  it("materializa profileData com chaves de variável", () => {
    const profileData = buildProfileDataMap(
      [
        { key: "operadora", radarFieldKey: "crm.lead.currentHealthPlan" },
        { key: "nome_cliente", radarFieldKey: "profile.displayName" },
      ],
      baseProfile,
      baseLead
    )

    expect(profileData.operadora).toBe("Unimed")
    expect(profileData.nome_cliente).toBe("Maria Silva")
  })

  it("preserva chaves base.* do import e deixa variáveis materializadas vencerem", () => {
    const merged = mergeImportedBaseProfileData(
      {
        "base.socios": "Maria Silva",
        "base.segmento": "Industrial",
        operadora: "stale",
      },
      { operadora: "Unimed", nome_cliente: "Maria Silva" }
    )

    expect(merged).toEqual({
      "base.socios": "Maria Silva",
      "base.segmento": "Industrial",
      operadora: "Unimed",
      nome_cliente: "Maria Silva",
    })
  })
})
