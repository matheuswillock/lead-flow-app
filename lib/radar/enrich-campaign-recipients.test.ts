import { afterEach, describe, expect, it, mock, spyOn } from "bun:test"
import { enrichCampaignRecipientsWithRadar } from "@/lib/radar/enrich-campaign-recipients"
import {
  mergeRecipientInterpolationFields,
  resolveInterpolationValuesForProfile,
} from "@/lib/radar/resolve-recipient-interpolation"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"

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
  identities: [{ type: "lead_id" as const, normalizedValue: "lead-1" }],
}

const baseLead = {
  status: "contract_finalized",
  currentHealthPlan: "Unimed",
  soldPlan: "Plano Ouro",
  contractDueDate: new Date("2026-12-01T00:00:00.000Z"),
  referenceHospital: "Hospital São Lucas",
}

describe("resolveInterpolationValuesForProfile", () => {
  it("preenche variável Radar a partir do perfil", () => {
    const values = resolveInterpolationValuesForProfile(
      [{ key: "plano", radarFieldKey: "crm.lead.soldPlan", defaultValue: null }],
      baseProfile,
      baseLead
    )

    expect(values.plano).toBe("Plano Ouro")
  })

  it("aplica fallback Radar quando campo resolvido está vazio", () => {
    const values = resolveInterpolationValuesForProfile(
      [{ key: "cidade", radarFieldKey: "crm.lead.city", defaultValue: "São Paulo" }],
      baseProfile,
      { ...baseLead, city: null }
    )

    expect(values.cidade).toBe("São Paulo")
  })

  it("usa profileData materializado quando resolução live falha", () => {
    const values = resolveInterpolationValuesForProfile(
      [{ key: "extra", radarFieldKey: "crm.lead.city", defaultValue: null }],
      baseProfile,
      { ...baseLead, city: null },
      { extra: "valor-cache" }
    )

    expect(values.extra).toBe("valor-cache")
  })
})

describe("mergeRecipientInterpolationFields", () => {
  it("valor manual do contato sobrescreve valor Radar", () => {
    const merged = mergeRecipientInterpolationFields(
      {
        email: "maria@example.com",
        name: "",
        customFields: { plano: "Manual" },
      },
      {
        radarValues: { plano: "Plano Ouro" },
        displayName: "Maria Silva",
      }
    )

    expect(merged.customFields?.plano).toBe("Manual")
  })

  it("usa displayName do Radar quando name do contato está vazio", () => {
    const merged = mergeRecipientInterpolationFields(
      { email: "maria@example.com", name: "" },
      {
        radarValues: {},
        displayName: "Maria Silva",
      }
    )

    expect(merged.name).toBe("Maria Silva")
  })

  it("mantém name do contato quando preenchido", () => {
    const merged = mergeRecipientInterpolationFields(
      { email: "maria@example.com", name: "João" },
      {
        radarValues: {},
        displayName: "Maria Silva",
      }
    )

    expect(merged.name).toBe("João")
  })
})

describe("enrichCampaignRecipientsWithRadar", () => {
  afterEach(() => {
    mock.restore()
  })

  it("retorna recipients sem alteração quando Radar está inativo", async () => {
    const batchSpy = spyOn(radarRepository, "findProfilesForInterpolationByEmails")

    const recipients = [{ email: "test@example.com", name: "Test" }]
    const result = await enrichCampaignRecipientsWithRadar("team-1", recipients, { radarEnabled: false })

    expect(result).toEqual(recipients)
    expect(batchSpy).not.toHaveBeenCalled()
  })

  it("enriquece customFields com valores Radar resolvidos", async () => {
    spyOn(radarRepository, "findProfilesForInterpolationByEmails").mockResolvedValue([
      {
        normalizedPrimaryEmail: "maria@example.com",
        ...baseProfile,
      },
    ] as Awaited<ReturnType<typeof radarRepository.findProfilesForInterpolationByEmails>>)
    spyOn(radarRepository, "listRadarEmailVariables").mockResolvedValue([
      { key: "plano", radarFieldKey: "crm.lead.soldPlan", defaultValue: null },
    ])
    spyOn(radarRepository, "findProfileDataByEmails").mockResolvedValue(new Map())
    spyOn(radarRepository, "findLeadsForRadarFieldResolution").mockResolvedValue(
      new Map([["lead-1", { id: "lead-1", ...baseLead }]])
    )

    const [result] = await enrichCampaignRecipientsWithRadar(
      "team-1",
      [{ email: "maria@example.com", name: "", customFields: {} }],
      { radarEnabled: true }
    )

    expect(result.customFields?.plano).toBe("Plano Ouro")
    expect(result.name).toBe("Maria Silva")
  })

  it("sem perfil Radar mantém apenas campos manuais", async () => {
    spyOn(radarRepository, "findProfilesForInterpolationByEmails").mockResolvedValue([])
    spyOn(radarRepository, "listRadarEmailVariables").mockResolvedValue([
      { key: "plano", radarFieldKey: "crm.lead.soldPlan", defaultValue: "Fallback Radar" },
    ])
    spyOn(radarRepository, "findProfileDataByEmails").mockResolvedValue(new Map())
    spyOn(radarRepository, "findLeadsForRadarFieldResolution").mockResolvedValue(new Map())

    const [result] = await enrichCampaignRecipientsWithRadar(
      "team-1",
      [
        {
          email: "unknown@example.com",
          name: "Contato",
          customFields: { empresa: "Acme" },
        },
      ],
      { radarEnabled: true }
    )

    expect(result.customFields).toEqual({ empresa: "Acme" })
    expect(result.customFields?.plano).toBeUndefined()
  })
})
