import { describe, expect, it, mock } from "bun:test"

const radarIdentityFindUniqueMock = mock(async (args: { where: { teamId_type_normalizedValue: { type: string } } }) => {
  if (args.where.teamId_type_normalizedValue.type === "phone") return { profileId: "profile-1" }
  if (args.where.teamId_type_normalizedValue.type === "contract_holder") return { profileId: "profile-1" }
  return null
})
const radarProfileFindUniqueMock = mock(async (_args: unknown) => ({
  primaryEmail: null,
  normalizedPrimaryEmail: null,
  primaryDocument: null,
  normalizedPrimaryDocument: null,
  displayName: "Nome Antigo",
  normalizedName: "nome antigo",
}))
const radarProfileUpdateMock = mock(async (args: { data: Record<string, unknown> }) => ({
  id: "profile-1",
  ...args.data,
}))

const txMock = {
  $executeRaw: mock(async () => 0),
  radarIdentity: { findUnique: radarIdentityFindUniqueMock },
  radarProfile: { findUnique: radarProfileFindUniqueMock, update: radarProfileUpdateMock },
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
  },
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const { RadarRepository } = await import(
  "@/app/api/infra/data/repositories/radar/RadarRepository"
)

describe("Achado #7 — política única de sobrescrita de nome (code review 2026-08-19)", () => {
  it("resolveProfileForPhone aceita o nome mais recente não-vazio (antes nunca sobrescrevia)", async () => {
    const repo = new RadarRepository()
    await repo.resolveProfileForPhone({
      teamId: "team-1",
      normalizedPhone: "5511999999999",
      normalizedName: "nome novo",
      displayName: "Nome Novo",
      displayPhone: "(11) 99999-9999",
      phoneValue: "(11) 99999-9999",
      phoneSource: "whatsapp",
    })

    const call = radarProfileUpdateMock.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }]
    expect(call[0].data.displayName).toBe("Nome Novo")
    expect(call[0].data.normalizedName).toBe("nome novo")
  })

  it("resolveProfileForPhone não apaga o nome existente quando a fonte atual não traz nome", async () => {
    const repo = new RadarRepository()
    await repo.resolveProfileForPhone({
      teamId: "team-1",
      normalizedPhone: "5511999999999",
      normalizedName: "",
      displayName: "",
      displayPhone: "(11) 99999-9999",
      phoneValue: "(11) 99999-9999",
      phoneSource: "whatsapp",
    })

    const call = radarProfileUpdateMock.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }]
    expect(call[0].data.displayName).toBe("Nome Antigo")
    expect(call[0].data.normalizedName).toBe("nome antigo")
  })

  it("resolveProfileForDocument aceita o nome mais recente não-vazio", async () => {
    const repo = new RadarRepository()
    await repo.resolveProfileForDocument({
      teamId: "team-1",
      identityType: "contract_holder",
      normalizedDocument: "12345678900",
      documentValue: "123.456.789-00",
      displayName: "Titular Novo",
      normalizedName: "titular novo",
      documentSource: "crm",
    })

    const call = radarProfileUpdateMock.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }]
    expect(call[0].data.displayName).toBe("Titular Novo")
    expect(call[0].data.normalizedName).toBe("titular novo")
  })

  it("resolveProfileForDocument não apaga o nome existente com string vazia", async () => {
    const repo = new RadarRepository()
    await repo.resolveProfileForDocument({
      teamId: "team-1",
      identityType: "contract_holder",
      normalizedDocument: "12345678900",
      documentValue: "123.456.789-00",
      displayName: "",
      normalizedName: "",
      documentSource: "crm",
    })

    const call = radarProfileUpdateMock.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }]
    expect(call[0].data.displayName).toBe("Nome Antigo")
    expect(call[0].data.normalizedName).toBe("nome antigo")
  })
})
