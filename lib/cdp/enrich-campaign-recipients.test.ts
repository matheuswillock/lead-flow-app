import { afterEach, describe, expect, it, mock, spyOn } from "bun:test"
import { enrichCampaignRecipientsWithCdp } from "@/lib/cdp/enrich-campaign-recipients"
import {
  mergeRecipientInterpolationFields,
  resolveInterpolationValuesForProfile,
} from "@/lib/cdp/resolve-recipient-interpolation"
import { cdpRepository } from "@/app/api/infra/data/repositories/cdp/CdpRepository"

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
  it("preenche variável CDP a partir do perfil", () => {
    const values = resolveInterpolationValuesForProfile(
      [{ key: "plano", cdpFieldKey: "crm.lead.soldPlan", defaultValue: null }],
      baseProfile,
      baseLead
    )

    expect(values.plano).toBe("Plano Ouro")
  })

  it("aplica fallback CDP quando campo resolvido está vazio", () => {
    const values = resolveInterpolationValuesForProfile(
      [{ key: "cidade", cdpFieldKey: "crm.lead.city", defaultValue: "São Paulo" }],
      baseProfile,
      { ...baseLead, city: null }
    )

    expect(values.cidade).toBe("São Paulo")
  })

  it("usa profileData materializado quando resolução live falha", () => {
    const values = resolveInterpolationValuesForProfile(
      [{ key: "extra", cdpFieldKey: "crm.lead.city", defaultValue: null }],
      baseProfile,
      { ...baseLead, city: null },
      { extra: "valor-cache" }
    )

    expect(values.extra).toBe("valor-cache")
  })
})

describe("mergeRecipientInterpolationFields", () => {
  it("valor manual do contato sobrescreve CDP", () => {
    const merged = mergeRecipientInterpolationFields(
      {
        email: "maria@example.com",
        name: "",
        customFields: { plano: "Manual" },
      },
      {
        cdpValues: { plano: "Plano Ouro" },
        displayName: "Maria Silva",
      }
    )

    expect(merged.customFields?.plano).toBe("Manual")
  })

  it("usa displayName da CDP quando name do contato está vazio", () => {
    const merged = mergeRecipientInterpolationFields(
      { email: "maria@example.com", name: "" },
      {
        cdpValues: {},
        displayName: "Maria Silva",
      }
    )

    expect(merged.name).toBe("Maria Silva")
  })

  it("mantém name do contato quando preenchido", () => {
    const merged = mergeRecipientInterpolationFields(
      { email: "maria@example.com", name: "João" },
      {
        cdpValues: {},
        displayName: "Maria Silva",
      }
    )

    expect(merged.name).toBe("João")
  })
})

describe("enrichCampaignRecipientsWithCdp", () => {
  afterEach(() => {
    mock.restore()
  })

  it("retorna recipients sem alteração quando CDP está inativo", async () => {
    const batchSpy = spyOn(cdpRepository, "findProfilesForInterpolationByEmails")

    const recipients = [{ email: "test@example.com", name: "Test" }]
    const result = await enrichCampaignRecipientsWithCdp("team-1", recipients, { cdpEnabled: false })

    expect(result).toEqual(recipients)
    expect(batchSpy).not.toHaveBeenCalled()
  })

  it("enriquece customFields com valores CDP resolvidos", async () => {
    spyOn(cdpRepository, "findProfilesForInterpolationByEmails").mockResolvedValue([
      {
        normalizedPrimaryEmail: "maria@example.com",
        ...baseProfile,
      },
    ] as Awaited<ReturnType<typeof cdpRepository.findProfilesForInterpolationByEmails>>)
    spyOn(cdpRepository, "listCdpEmailVariables").mockResolvedValue([
      { key: "plano", cdpFieldKey: "crm.lead.soldPlan", defaultValue: null },
    ])
    spyOn(cdpRepository, "findProfileDataByEmails").mockResolvedValue(new Map())
    spyOn(cdpRepository, "findLeadsForCdpFieldResolution").mockResolvedValue(
      new Map([["lead-1", { id: "lead-1", ...baseLead }]])
    )

    const [result] = await enrichCampaignRecipientsWithCdp(
      "team-1",
      [{ email: "maria@example.com", name: "", customFields: {} }],
      { cdpEnabled: true }
    )

    expect(result.customFields?.plano).toBe("Plano Ouro")
    expect(result.name).toBe("Maria Silva")
  })

  it("sem perfil CDP mantém apenas campos manuais", async () => {
    spyOn(cdpRepository, "findProfilesForInterpolationByEmails").mockResolvedValue([])
    spyOn(cdpRepository, "listCdpEmailVariables").mockResolvedValue([
      { key: "plano", cdpFieldKey: "crm.lead.soldPlan", defaultValue: "Fallback CDP" },
    ])
    spyOn(cdpRepository, "findProfileDataByEmails").mockResolvedValue(new Map())
    spyOn(cdpRepository, "findLeadsForCdpFieldResolution").mockResolvedValue(new Map())

    const [result] = await enrichCampaignRecipientsWithCdp(
      "team-1",
      [
        {
          email: "unknown@example.com",
          name: "Contato",
          customFields: { empresa: "Acme" },
        },
      ],
      { cdpEnabled: true }
    )

    expect(result.customFields).toEqual({ empresa: "Acme" })
    expect(result.customFields?.plano).toBeUndefined()
  })
})
