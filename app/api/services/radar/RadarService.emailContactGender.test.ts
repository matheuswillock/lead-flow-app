import { describe, expect, it, mock } from "bun:test"
import { RadarService } from "./RadarService"
import type { RadarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"

const profileId = "profile-1"
const teamId = "team-1"
const contactId = "contact-1"

function buildRepo(overrides: Record<string, unknown> = {}): RadarRepository {
  const profile = {
    id: profileId,
    teamId,
    gender: null,
    genderSource: null,
  }

  return {
    findLeadPhoneByEmail: mock(async () => null),
    resolveProfileForEmail: mock(async () => ({ profile, wasExisting: false })),
    resolveProfileForPhone: mock(async () => ({ profile, wasExisting: false })),
    upsertIdentity: mock(async () => ({})),
    upsertSourceLink: mock(async () => ({})),
    upsertConsent: mock(async () => ({})),
    updateProfileGender: mock(async () => ({ count: 1 })),
    findEmailContactById: mock(async () => ({
      id: contactId,
      email: "ana@empresa.com.br",
      name: "Empresa SA",
      isUnsubscribed: false,
      isBounced: false,
      isComplained: false,
      updatedAt: new Date("2026-08-10T12:00:00.000Z"),
      customFields: { gender: "Feminino" },
      list: { teamId },
    })),
    findEmailContactLists: mock(async () => []),
    findEmailContacts: mock(async () => []),
    findEmailLogsForRadarSync: mock(async () => []),
    ...overrides,
  } as unknown as RadarRepository
}

describe("RadarService.processEmailContactForRadar gender sync (F2)", () => {
  it("syncFromEmail persiste gênero mapeado via updateProfileGender", async () => {
    const updateProfileGender = mock(async () => ({ count: 1 }))
    const repo = buildRepo({ updateProfileGender })

    const service = new RadarService(repo)
    await service.syncFromEmail(
      { teamId, ctx: { profileId: "p", teamMember: { role: "manager", functions: [] } } },
      { emailContactId: contactId }
    )

    expect(updateProfileGender).toHaveBeenCalledWith(profileId, teamId, "female", "mapped")
  })

  it("syncFromEmail infere gênero a partir de socios quando não há coluna mapeada", async () => {
    const updateProfileGender = mock(async () => ({ count: 1 }))
    const repo = buildRepo({
      updateProfileGender,
      findEmailContactById: mock(async () => ({
        id: contactId,
        email: "ana@empresa.com.br",
        name: null,
        isUnsubscribed: false,
        isBounced: false,
        isComplained: false,
        updatedAt: new Date("2026-08-10T12:00:00.000Z"),
        customFields: { socios: "João Silva" },
        list: { teamId },
      })),
    })

    const service = new RadarService(repo)
    await service.syncFromEmail(
      { teamId, ctx: { profileId: "p", teamMember: { role: "manager", functions: [] } } },
      { emailContactId: contactId }
    )

    expect(updateProfileGender).toHaveBeenCalledWith(profileId, teamId, "male", "inferred")
  })

  it("syncFromEmail não sobrescreve genderSource manual", async () => {
    const updateProfileGender = mock(async () => ({ count: 1 }))
    const repo = buildRepo({
      updateProfileGender,
      resolveProfileForEmail: mock(async () => ({
        profile: {
          id: profileId,
          teamId,
          gender: "male",
          genderSource: "manual",
        },
        wasExisting: true,
      })),
    })

    const service = new RadarService(repo)
    await service.syncFromEmail(
      { teamId, ctx: { profileId: "p", teamMember: { role: "manager", functions: [] } } },
      { emailContactId: contactId }
    )

    expect(updateProfileGender).not.toHaveBeenCalled()
  })

  it("reimport idempotente não chama updateProfileGender quando já resolvido", async () => {
    const updateProfileGender = mock(async () => ({ count: 1 }))
    const repo = buildRepo({
      updateProfileGender,
      resolveProfileForEmail: mock(async () => ({
        profile: {
          id: profileId,
          teamId,
          gender: "female",
          genderSource: "mapped",
        },
        wasExisting: true,
      })),
    })

    const service = new RadarService(repo)
    await service.syncFromEmail(
      { teamId, ctx: { profileId: "p", teamMember: { role: "manager", functions: [] } } },
      { emailContactId: contactId }
    )

    expect(updateProfileGender).not.toHaveBeenCalled()
  })
})
