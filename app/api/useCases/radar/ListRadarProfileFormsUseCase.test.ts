import { beforeEach, describe, expect, it, mock } from "bun:test"
import { ListRadarProfileFormsUseCase } from "./ListRadarProfileFormsUseCase"
import { RADAR_PROFILE_FORM_COMPLETION } from "@/lib/radar/profile-forms"

const profileExistsInScope = mock(async () => true)
const listProfileFormEventMarkers = mock(async () => [] as Array<{
  eventType: string
  occurredAt: Date
  metadata: unknown
}>)
const findFormsByIdsForTeam = mock(async () => [] as Array<{
  id: string
  name: string
  publicId: string
}>)

describe("ListRadarProfileFormsUseCase", () => {
  const useCase = new ListRadarProfileFormsUseCase({
    profileExistsInScope,
    listProfileFormEventMarkers,
    findFormsByIdsForTeam,
  })

  const input = {
    teamId: "team-1",
    profileId: "profile-1",
    ctx: {
      profileId: "operator-1",
      teamMember: { role: "manager", functions: [] },
    },
  }

  beforeEach(() => {
    profileExistsInScope.mockReset()
    listProfileFormEventMarkers.mockReset()
    findFormsByIdsForTeam.mockReset()
    profileExistsInScope.mockResolvedValue(true)
    listProfileFormEventMarkers.mockResolvedValue([])
    findFormsByIdsForTeam.mockResolvedValue([])
  })

  it("retorna 404 lógico quando o perfil não existe no time", async () => {
    profileExistsInScope.mockResolvedValue(false)
    const output = await useCase.execute(input)
    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toMatch(/não encontrado/i)
    expect(listProfileFormEventMarkers).not.toHaveBeenCalled()
  })

  it("agrupa formulários do perfil com status de conclusão", async () => {
    listProfileFormEventMarkers.mockResolvedValue([
      {
        eventType: "form.started",
        occurredAt: new Date("2026-08-20T12:00:00.000Z"),
        metadata: { formId: "form-1" },
      },
      {
        eventType: "form.completed",
        occurredAt: new Date("2026-08-20T12:05:00.000Z"),
        metadata: { formId: "form-1" },
      },
    ])
    findFormsByIdsForTeam.mockResolvedValue([
      { id: "form-1", name: "Qualificação PME", publicId: "pub-1" },
    ])

    const output = await useCase.execute(input)
    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({
      items: [
        expect.objectContaining({
          formId: "form-1",
          name: "Qualificação PME",
          publicId: "pub-1",
          completionStatus: RADAR_PROFILE_FORM_COMPLETION.complete,
        }),
      ],
    })
  })
})
