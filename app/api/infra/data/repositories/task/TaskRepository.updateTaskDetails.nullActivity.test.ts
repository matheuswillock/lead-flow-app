import { beforeEach, describe, expect, it, mock } from "bun:test"
import { prismaModuleMock, registerPrismaModuleMock } from "@/test/support/prisma-module-mock"

/**
 * `Task.activityId` é `String? @db.Uuid` com `onDelete: SetNull`
 * (`prisma/schema.prisma`, model `Task`) — ou seja, uma Task sem
 * `LeadActivity` vinculada é possível por construção, e passa a existir
 * sozinha se a atividade for apagada.
 *
 * `updateTaskDetails` sincronizava o payload da atividade com
 * `where: { id: taskWithRelations.activityId ?? "" }`. Com `activityId` nulo,
 * a string vazia ia para uma coluna `uuid` e o Postgres devolvia P2023
 * ("Error creating UUID, invalid length: expected length 32 ... found 0").
 * O erro subia até `PATCH /api/v1/tasks/[taskId]`, que respondia 500 em vez
 * de atualizar a tarefa.
 *
 * O mock do `leadActivity.updateMany` abaixo reproduz a recusa do Postgres:
 * qualquer `where.id` que não seja UUID rejeita a promise, do mesmo jeito que
 * o banco real. Sem o guard, o primeiro teste falha.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ACTIVITY_ID = "6f9619ff-8b86-d011-b42d-00cf4fc964ff"
const TASK_ID = "11111111-2222-3333-4444-555555555555"
const ASSIGNEE_PROFILE_ID = "99999999-8888-7777-6666-555555555555"

const leadActivityUpdateManyMock = mock(async ({ where }: { where: { id: string } }) => {
  if (!UUID_PATTERN.test(where.id)) {
    throw new Error(
      "Inconsistent column data: Error creating UUID, invalid length: " +
        `expected length 32 for simple format, found ${where.id.length}`
    )
  }
  return { count: 1 }
})

let currentActivityId: string | null = null

const taskUpdateMock = mock(async ({ data }: { data: Record<string, unknown> }) => ({
  id: TASK_ID,
  leadId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  activityId: currentActivityId,
  title: data.title,
  taskType: data.taskType,
  body: data.body,
  isUrgent: data.isUrgent,
  startAt: data.startAt,
  endAt: data.endAt,
  createdBy: ASSIGNEE_PROFILE_ID,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  lead: { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", name: "Lead Teste", leadCode: "LD-1" },
  creator: {
    id: ASSIGNEE_PROFILE_ID,
    fullName: "Maria Silva",
    email: "maria@example.com",
    profileIconUrl: null,
  },
  assignees: [
    {
      id: "77777777-6666-5555-4444-333333333333",
      taskId: TASK_ID,
      profileId: ASSIGNEE_PROFILE_ID,
      status: "PENDING",
      googleEventId: null,
      googleCalendarId: null,
      googleSynced: false,
      assignedAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      profile: {
        id: ASSIGNEE_PROFILE_ID,
        fullName: "Maria Silva",
        email: "maria@example.com",
        profileIconUrl: null,
      },
    },
  ],
}))

registerPrismaModuleMock()
Object.assign(prismaModuleMock, {
  task: { update: taskUpdateMock },
  leadActivity: { updateMany: leadActivityUpdateManyMock },
})

const { taskRepository } = await import("@/app/api/infra/data/repositories/task/TaskRepository")

const UPDATE_INPUT = {
  taskId: TASK_ID,
  title: "Ligar para o cliente",
  taskType: "call" as const,
  body: "Retomar a proposta enviada ontem.",
  isUrgent: true,
  startAt: new Date("2026-02-01T13:00:00.000Z"),
  endAt: new Date("2026-02-01T14:00:00.000Z"),
  assigneeProfileIds: [ASSIGNEE_PROFILE_ID],
}

describe("TaskRepository.updateTaskDetails — Task sem LeadActivity vinculada", () => {
  beforeEach(() => {
    taskUpdateMock.mockClear()
    leadActivityUpdateManyMock.mockClear()
  })

  it("atualiza a task e NÃO toca em leadActivity quando activityId é nulo", async () => {
    currentActivityId = null

    const updated = await taskRepository.updateTaskDetails(UPDATE_INPUT)

    expect(updated.id).toBe(TASK_ID)
    expect(updated.title).toBe("Ligar para o cliente")
    expect(taskUpdateMock).toHaveBeenCalledTimes(1)
    expect(leadActivityUpdateManyMock).not.toHaveBeenCalled()
  })

  it("sincroniza o payload da atividade quando activityId existe", async () => {
    currentActivityId = ACTIVITY_ID

    await taskRepository.updateTaskDetails(UPDATE_INPUT)

    expect(leadActivityUpdateManyMock).toHaveBeenCalledTimes(1)
    const [call] = leadActivityUpdateManyMock.mock.calls as unknown as [
      [{ where: { id: string }; data: { body: string; payload: Record<string, unknown> } }],
    ]
    expect(call[0].where.id).toBe(ACTIVITY_ID)
    expect(call[0].data.body).toBe("Retomar a proposta enviada ontem.")
    expect(call[0].data.payload.title).toBe("Ligar para o cliente")
    expect(call[0].data.payload.assigneeProfileIds).toEqual([ASSIGNEE_PROFILE_ID])
  })
})
