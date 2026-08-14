import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"

const enqueueRadarProfileSync = mock(async () => {})

mock.module("@/app/api/useCases/radar/enqueueRadarProfileSync", () => ({
  enqueueRadarProfileSync,
}))

mock.module("@/app/api/useCases/radar/SyncRadarProfileDataForTeamUseCase", () => ({
  syncRadarProfileDataForTeamUseCase: { execute: mock(async () => ({ isValid: true })) },
}))

const createMock = mock(async () => ({
  id: "var-1",
  key: "foo",
  type: "string",
  defaultValue: null,
  description: null,
  isActive: true,
  valueSource: "RADAR",
  radarFieldKey: "name",
}))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailTeamVariable: {
      findUnique: mock(async () => null),
      create: createMock,
    },
  },
}))

mock.module("@/lib/radar/field-catalog", () => ({
  isValidRadarFieldKey: () => true,
}))

const { EmailTeamVariablesUseCase } = await import(
  "@/app/api/useCases/email/EmailTeamVariablesUseCase"
)

const ctx = {
  teamId: "team-1",
  profileId: "profile-1",
  teamMember: { role: "MASTER", functions: [] },
} as unknown as TeamContext

describe("EmailTeamVariablesUseCase radar enqueue", () => {
  beforeEach(() => {
    enqueueRadarProfileSync.mockReset()
    enqueueRadarProfileSync.mockResolvedValue(undefined)
    createMock.mockResolvedValue({
      id: "var-1",
      key: "foo",
      type: "string",
      defaultValue: null,
      description: null,
      isActive: true,
      valueSource: "RADAR",
      radarFieldKey: "name",
    })
  })

  it("create com origem RADAR enfileira email_settings e não chama after()", async () => {
    const useCase = new EmailTeamVariablesUseCase()
    const result = await useCase.create(
      { key: "foo", valueSource: "RADAR", radarFieldKey: "name" },
      ctx
    )
    expect(result.isValid).toBe(true)
    expect(enqueueRadarProfileSync).toHaveBeenCalledTimes(1)
    const firstCall = enqueueRadarProfileSync.mock.calls[0] as unknown as [
      { source: string; teamId: string },
    ]
    expect(firstCall[0].source).toBe("email_settings")
    expect(firstCall[0].teamId).toBe("team-1")
  })
})
