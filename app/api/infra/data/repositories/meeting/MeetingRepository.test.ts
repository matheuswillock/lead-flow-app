import { describe, expect, mock, test } from "bun:test"
import { LeadStatus } from "@prisma/client"
import { MeetingRepository } from "./MeetingRepository"
import type { ILeadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/ILeadScheduleRepository"
import type { UpsertMeetingWithLeadTransitionInput } from "./IMeetingRepository"

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E2.
 *
 * T-13.5 — a gravação roda dentro da transação RECEBIDA (`tx`) e não abre
 * transação própria. `MeetingRepository` não importa `prisma` (só o tipo
 * `Prisma.TransactionClient` e a interface `ILeadScheduleRepository`), então
 * estruturalmente não tem como chamar `prisma.$transaction` por conta própria
 * — o teste confirma isso na prática: a mesma referência de `tx` passada pelo
 * chamador é a que chega em `tx.lead.update`, `tx.leadActivity.create` e em
 * `leadScheduleRepo.upsertByLeadIdWithTx`.
 */

function buildFakeTx() {
  const leadUpdateMock = mock(async ({ data }: any) => ({ id: "lead-1", status: "new_opportunity", ...data }))
  const leadActivityCreateMock = mock(async () => ({}))
  const tx = {
    lead: { update: leadUpdateMock },
    leadActivity: { create: leadActivityCreateMock },
    // Marcador só para o teste identificar que é a MESMA referência de tx.
    __isFakeTx: true,
  }
  return { tx, leadUpdateMock, leadActivityCreateMock }
}

function buildBaseInput(
  overrides: Partial<UpsertMeetingWithLeadTransitionInput> = {}
): UpsertMeetingWithLeadTransitionInput {
  return {
    scheduleId: "schedule-1",
    leadId: "lead-1",
    meetingDate: new Date("2026-10-01T14:00:00Z"),
    meetingTitle: "Reunião de teste",
    meetingLink: "https://meet.google.com/abc-defg-hij",
    meetingType: "online",
    closerId: "closer-1",
    inviteDispatchStatus: "sent_google",
    inviteDispatchFallbackUsed: false,
    inviteDispatchLastAttemptAt: new Date("2026-10-01T13:00:00Z"),
    inviteDispatchLastError: null,
    inviteDispatchLastPayload: null,
    existingSchedule: null,
    transitionStatusToScheduled: true,
    statusChangeActivity: null,
    ...overrides,
  }
}

describe("MeetingRepository.upsertMeetingWithLeadTransition — T-13.5", () => {
  test("usa a MESMA referência de tx recebida em toda escrita, não abre transação própria", async () => {
    const { tx, leadUpdateMock, leadActivityCreateMock } = buildFakeTx()

    let receivedTxInSchedule: unknown = null
    const scheduleRepoStub: Partial<ILeadScheduleRepository> = {
      upsertByLeadIdWithTx: mock(async (receivedTx: any) => {
        receivedTxInSchedule = receivedTx
        return { id: "schedule-1" } as any
      }),
    }

    const repo = new MeetingRepository(scheduleRepoStub as ILeadScheduleRepository)
    await repo.upsertMeetingWithLeadTransition(tx as any, buildBaseInput({ statusChangeActivity: { type: "note", body: "x" } as any }))

    // A mesma referência de objeto, não uma cópia nem uma transação nova.
    expect(receivedTxInSchedule).toBe(tx)
    expect(leadUpdateMock).toHaveBeenCalledTimes(1)
    expect(leadActivityCreateMock).toHaveBeenCalledTimes(1)
    // As três escritas usaram exatamente o `tx` passado — nenhuma delas
    // poderia ter vindo de uma transação própria, porque `MeetingRepository`
    // não importa `prisma` (só o tipo `Prisma.TransactionClient`).
  })

  test("grava status: scheduled no lead quando transitionStatusToScheduled é true", async () => {
    const { tx, leadUpdateMock } = buildFakeTx()
    const scheduleRepoStub: Partial<ILeadScheduleRepository> = {
      upsertByLeadIdWithTx: mock(async () => ({ id: "schedule-1" }) as any),
    }
    const repo = new MeetingRepository(scheduleRepoStub as ILeadScheduleRepository)

    await repo.upsertMeetingWithLeadTransition(tx as any, buildBaseInput())

    const call = leadUpdateMock.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    expect(call[0].data.status).toBe(LeadStatus.scheduled)
  })

  test("não grava status quando transitionStatusToScheduled é false", async () => {
    const { tx, leadUpdateMock } = buildFakeTx()
    const scheduleRepoStub: Partial<ILeadScheduleRepository> = {
      upsertByLeadIdWithTx: mock(async () => ({ id: "schedule-1" }) as any),
    }
    const repo = new MeetingRepository(scheduleRepoStub as ILeadScheduleRepository)

    await repo.upsertMeetingWithLeadTransition(
      tx as any,
      buildBaseInput({ transitionStatusToScheduled: false })
    )

    const call = leadUpdateMock.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    expect(call[0].data.status).toBeUndefined()
  })

  test("não insere atividade quando statusChangeActivity é null", async () => {
    const { tx, leadActivityCreateMock } = buildFakeTx()
    const scheduleRepoStub: Partial<ILeadScheduleRepository> = {
      upsertByLeadIdWithTx: mock(async () => ({ id: "schedule-1" }) as any),
    }
    const repo = new MeetingRepository(scheduleRepoStub as ILeadScheduleRepository)

    await repo.upsertMeetingWithLeadTransition(tx as any, buildBaseInput({ statusChangeActivity: null }))

    expect(leadActivityCreateMock).not.toHaveBeenCalled()
  })

  test("reseta reminder30MinSentAt para null quando a data da reunião muda", async () => {
    const { tx } = buildFakeTx()
    let capturedData: any = null
    const scheduleRepoStub: Partial<ILeadScheduleRepository> = {
      upsertByLeadIdWithTx: mock(async (_tx, _leadId, data) => {
        capturedData = data
        return { id: "schedule-1" } as any
      }),
    }
    const repo = new MeetingRepository(scheduleRepoStub as ILeadScheduleRepository)

    await repo.upsertMeetingWithLeadTransition(
      tx as any,
      buildBaseInput({
        meetingDate: new Date("2026-10-02T10:00:00Z"),
        existingSchedule: {
          date: new Date("2026-10-01T14:00:00Z"),
          extraGuests: [],
          googleEventId: null,
          googleCalendarId: null,
          reminder30MinSentAt: new Date("2026-10-01T13:30:00Z"),
        },
      })
    )

    expect(capturedData.reminder30MinSentAt).toBeNull()
  })

  test("preserva reminder30MinSentAt existente quando a data da reunião não muda", async () => {
    const { tx } = buildFakeTx()
    let capturedData: any = null
    const scheduleRepoStub: Partial<ILeadScheduleRepository> = {
      upsertByLeadIdWithTx: mock(async (_tx, _leadId, data) => {
        capturedData = data
        return { id: "schedule-1" } as any
      }),
    }
    const repo = new MeetingRepository(scheduleRepoStub as ILeadScheduleRepository)

    const sameDate = new Date("2026-10-01T14:00:00Z")
    const previousReminder = new Date("2026-10-01T13:30:00Z")

    await repo.upsertMeetingWithLeadTransition(
      tx as any,
      buildBaseInput({
        meetingDate: sameDate,
        existingSchedule: {
          date: sameDate,
          extraGuests: [],
          googleEventId: null,
          googleCalendarId: null,
          reminder30MinSentAt: previousReminder,
        },
      })
    )

    expect(capturedData.reminder30MinSentAt).toEqual(previousReminder)
  })
})
