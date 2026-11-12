import { describe, expect, it } from "bun:test"
import { ProcessFollowUpRemindersUseCase } from "./ProcessFollowUpRemindersUseCase"
import { ScheduleAutomaticFollowUpsUseCase } from "./ScheduleAutomaticFollowUpsUseCase"
import { fakeReminderRepository, recordingPorts } from "./testDoubles"

const NOW = new Date("2026-11-10T12:00:00.000Z")

describe("ProcessFollowUpRemindersUseCase", () => {
  const due = {
    id: "r-1",
    leadId: "lead-1",
    leadName: "Maria",
    teamId: "team-1",
    kind: "plan_renewal" as const,
    offsetKey: "90d" as const,
    anchorAt: new Date("2027-02-08T00:00:00.000Z"),
    eventLabel: "em 08/02/2027",
    ownerProfileId: "closer-1",
    notifyProfileIds: ["master-1", "manager-1"],
  }

  it("cria a tarefa para o dono, alerta todos e marca como processado", async () => {
    const { repository, processed } = fakeReminderRepository({ due: [due] })
    const ports = recordingPorts()
    const output = await new ProcessFollowUpRemindersUseCase(repository, ports.createTask, ports.notify, () => NOW).run()

    expect(output.result).toMatchObject({ due: 1, tasks: 1, failures: 0 })
    expect(ports.tasks[0]).toMatchObject({ ownerProfileId: "closer-1", title: "Reestruturar o plano de Maria" })
    expect(ports.alerts.map((alert) => alert.recipientProfileId)).toEqual(["closer-1", "master-1", "manager-1"])
    expect(processed).toEqual([{ id: "r-1", taskId: "task-1" }])
  })

  it("sem tarefa, ainda alerta e não repete o lembrete", async () => {
    const { repository, processed } = fakeReminderRepository({ due: [due] })
    const ports = recordingPorts({ taskFails: true })
    const output = await new ProcessFollowUpRemindersUseCase(repository, ports.createTask, ports.notify, () => NOW).run()

    expect(output.result).toMatchObject({ tasks: 0, failures: 1 })
    expect(ports.alerts).toHaveLength(3)
    expect(processed).toEqual([{ id: "r-1", taskId: null }])
  })
})

describe("ScheduleAutomaticFollowUpsUseCase", () => {
  it("cadência do SDR: só os lembretes que ainda cabem antes da reunião, sem duplicar", async () => {
    const { repository, stored } = fakeReminderRepository({
      meetings: [
        {
          leadId: "lead-1",
          teamId: "team-1",
          meetingDate: new Date("2026-11-11T17:00:00.000Z"),
          sdrProfileId: "sdr-1",
          timezone: "America/Sao_Paulo",
        },
      ],
    })
    const useCase = new ScheduleAutomaticFollowUpsUseCase(repository, () => NOW)

    await useCase.scheduleMeetingNurture()
    const again = await useCase.scheduleMeetingNurture()

    expect(stored.map((item) => item.offsetKey)).toEqual(["1d", "1h"])
    expect(stored[0]).toMatchObject({ ownerProfileId: "sdr-1", kind: "meeting_nurture" })
    expect(stored[0].eventLabel).toBe("quarta-feira, 11/11, às 14:00")
    expect(again.result).toMatchObject({ created: 0 })
  })

  it("vigência: avisa closer como dono e master/manager no alerta", async () => {
    const { repository, stored } = fakeReminderRepository({
      plans: [
        {
          leadId: "lead-2",
          teamId: "team-1",
          endsAt: new Date("2026-12-10T00:00:00.000Z"),
          closerProfileId: "closer-1",
          masterProfileId: "master-1",
          managerProfileIds: ["manager-1"],
        },
      ],
    })
    await new ScheduleAutomaticFollowUpsUseCase(repository, () => NOW).schedulePlanRenewals()

    expect(stored.map((item) => item.offsetKey)).toEqual(["30d"])
    expect(stored[0]).toMatchObject({
      ownerProfileId: "closer-1",
      notifyProfileIds: ["master-1", "manager-1"],
      eventLabel: "em 10/12/2026",
    })
  })

  it("vigência sem closer: o master fica com a tarefa", async () => {
    const { repository, stored } = fakeReminderRepository({
      plans: [
        {
          leadId: "lead-3",
          teamId: "team-1",
          endsAt: new Date("2027-02-10T00:00:00.000Z"),
          closerProfileId: null,
          masterProfileId: "master-1",
          managerProfileIds: [],
        },
      ],
    })
    await new ScheduleAutomaticFollowUpsUseCase(repository, () => NOW).schedulePlanRenewals()
    expect(stored.map((item) => [item.offsetKey, item.ownerProfileId])).toEqual([
      ["90d", "master-1"],
      ["60d", "master-1"],
      ["30d", "master-1"],
    ])
  })
})
