import { describe, expect, it } from "bun:test"
import type {
  ILeadAdministratorInterviewRepository,
  LeadAdministratorInterviewRecord,
} from "@/app/api/infra/data/repositories/leadAdministratorInterview/ILeadAdministratorInterviewRepository"
import { fakeReminderRepository, recordingPorts } from "@/app/api/useCases/leadFollowUp/testDoubles"
import { INTERVIEW_NOT_FOUND, LEAD_NOT_FOUND, LeadAdministratorInterviewUseCase } from "./LeadAdministratorInterviewUseCase"

const NOW = new Date("2026-11-10T12:00:00.000Z")

function fakeInterviews() {
  const rows = new Map<string, LeadAdministratorInterviewRecord>()
  const repository: ILeadAdministratorInterviewRepository = {
    findLead: async (leadId) => (leadId === "lead-1" ? { teamId: "team-1", name: "Maria" } : null),
    findByLeadId: async (leadId) => rows.get(leadId) ?? null,
    save: async (input) => {
      const record = {
        leadId: input.leadId,
        scheduledAt: input.scheduledAt.toISOString(),
        scheduledLocal: input.scheduledLocal,
        administratorName: input.administratorName,
        notes: input.notes,
        clientNotifiedAt: null,
        updatedAt: NOW.toISOString(),
      }
      rows.set(input.leadId, record)
      return record
    },
    markClientNotified: async (leadId, at) => {
      const record = { ...rows.get(leadId)!, clientNotifiedAt: at.toISOString() }
      rows.set(leadId, record)
      return record
    },
    deleteByLeadId: async (leadId) => {
      rows.delete(leadId)
    },
  }
  return { repository, rows }
}

function setup() {
  const interviews = fakeInterviews()
  const reminders = fakeReminderRepository()
  const ports = recordingPorts()
  const useCase = new LeadAdministratorInterviewUseCase(
    interviews.repository,
    reminders.repository,
    ports.createTask,
    ports.appendActivity,
    () => NOW,
  )
  return { useCase, interviews, reminders, ports }
}

const scope = { leadId: "lead-1", teamId: "team-1", profileId: "closer-1" }
const save = {
  ...scope,
  scheduledAt: "2026-11-13T17:30:00.000Z",
  scheduledLocal: "2026-11-13T14:30",
  administratorName: " Qualicorp ",
}

describe("LeadAdministratorInterviewUseCase", () => {
  it("salva, agenda os lembretes escolhidos e registra no feed", async () => {
    const { useCase, reminders, ports } = setup()
    const output = await useCase.save({ ...save, reminderOffsets: ["2d", "1h", "invalido"] })

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ reminderOffsets: ["2d", "1h"] })
    expect(reminders.stored.map((item) => [item.offsetKey, item.ownerProfileId, item.eventLabel])).toEqual([
      ["2d", "closer-1", "sexta-feira, 13/11, às 14:30"],
      ["1h", "closer-1", "sexta-feira, 13/11, às 14:30"],
    ])
    expect(ports.activities[0].body).toContain("sexta-feira, 13/11, às 14:30")
  })

  it("remarcar troca os lembretes pendentes", async () => {
    const { useCase, reminders } = setup()
    await useCase.save({ ...save, reminderOffsets: ["2d", "1d"] })
    await useCase.save({ ...save, reminderOffsets: ["1h"] })
    expect(reminders.stored.map((item) => item.offsetKey)).toEqual(["1h"])
  })

  it("avisar agora registra o envio no feed do lead", async () => {
    const { useCase, ports, interviews } = setup()
    await useCase.save(save)
    const output = await useCase.markClientNotified(scope)
    expect(output.isValid).toBe(true)
    expect(interviews.rows.get("lead-1")?.clientNotifiedAt).toBe(NOW.toISOString())
    expect(ports.activities.at(-1)).toMatchObject({ type: "whatsapp", actorProfileId: "closer-1" })
  })

  it("não avisar agora gera tarefa pendente para o usuário", async () => {
    const { useCase, ports } = setup()
    await useCase.save(save)
    const output = await useCase.postponeClientNotice(scope)
    expect(output.isValid).toBe(true)
    expect(ports.tasks[0]).toMatchObject({
      ownerProfileId: "closer-1",
      title: "Avisar Maria sobre a entrevista da administradora",
    })
  })

  it("avisar sem entrevista registrada é recusado", async () => {
    const { useCase } = setup()
    expect((await useCase.markClientNotified(scope)).errorMessages).toEqual([INTERVIEW_NOT_FOUND])
  })

  it("outro time não acessa e data inválida não grava", async () => {
    const { useCase, interviews } = setup()
    expect((await useCase.get("lead-1", "team-2")).errorMessages).toEqual([LEAD_NOT_FOUND])
    expect((await useCase.save({ ...save, scheduledLocal: "amanhã" })).isValid).toBe(false)
    expect(interviews.rows.size).toBe(0)
  })

  it("remover apaga a entrevista e os lembretes pendentes", async () => {
    const { useCase, reminders, interviews } = setup()
    await useCase.save({ ...save, reminderOffsets: ["1d"] })
    await useCase.remove(scope)
    expect(interviews.rows.size).toBe(0)
    expect(reminders.stored).toHaveLength(0)
  })
})
