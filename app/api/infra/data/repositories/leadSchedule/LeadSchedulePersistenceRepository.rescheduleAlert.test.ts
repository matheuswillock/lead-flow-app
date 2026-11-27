import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { PersistLeadScheduleInput } from "./LeadSchedulePersistenceRepository";

type Args = Record<string, unknown>;

const scheduleUpsertMock = mock(async (_args: Args) => ({ id: "schedule-1", updatedAt: new Date("2026-11-03T14:00:00.000Z") }));
const leadUpdateMock = mock(async (_args: Args) => ({ id: "lead-1" }));
const activityCreateMock = mock(async (_args: Args) => ({}));
const alertUpdateManyMock = mock(async (_args: Args) => ({ count: 1 }));
const bethaniaOutboxCreateManyMock = mock(async (_args: Args) => ({ count: 1 }));
let outboxFindCalls = 0;
const bethaniaOutboxFindUniqueMock = mock(async () => {
  outboxFindCalls += 1;
  return outboxFindCalls === 1 ? null : { id: "outbox-1", status: "pending" };
});
const bethaniaDeliveryLogCreateMock = mock(async (_args: Args) => ({}));

const tx = {
  leadsSchedule: { upsert: scheduleUpsertMock },
  lead: { update: leadUpdateMock },
  leadActivity: { create: activityCreateMock },
  leadRescheduleAlert: { updateMany: alertUpdateManyMock },
  profile: { findUnique: mock(async () => ({ whatsappPhone: "+15551234567", whatsappPhoneVerifiedAt: new Date(0) })) },
  bethaniaGlobalControl: { findUnique: mock(async () => null) },
  bethaniaEventControl: { findUnique: mock(async () => null) },
  bethaniaOutbox: { createMany: bethaniaOutboxCreateManyMock, findUnique: bethaniaOutboxFindUniqueMock },
  bethaniaDeliveryLog: { create: bethaniaDeliveryLogCreateMock },
};

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) },
}));

const { LeadSchedulePersistenceRepository } = await import("./LeadSchedulePersistenceRepository");

const input = {
  scheduleId: "schedule-1",
  leadId: "lead-1",
  leadName: "Ana",
  recipientTimezone: "America/Sao_Paulo",
  closerId: "closer-1",
  meetingDate: new Date("2026-11-03T14:00:00.000Z"),
  durationMinutes: 30,
  resolvedMeetingTitle: "Reunião",
  resolvedMeetingLink: null,
  resolvedMeetingType: "call",
  calendarResult: null,
  inviteDispatchStatus: null,
  inviteDispatchFallbackUsed: false,
  inviteDispatchLastAttemptAt: new Date("2026-11-01T10:00:00.000Z"),
  inviteDispatchLastError: null,
  inviteDispatchLastPayload: null,
  existingSchedule: null,
  isReschedule: false,
  transitionStatusToScheduled: true,
  leadStatus: "new_opportunity",
  authorAsStudio: true,
  createdByProfileId: "profile-1",
} satisfies PersistLeadScheduleInput;

/**
 * SPEC 11 (DA9) / T-11.20: o alerta "remarcar urgente" se resolve sozinho quando o lead é
 * agendado (pelo CRM ou por qualquer caminho que grave a reunião).
 */
describe("LeadSchedulePersistenceRepository.persist — resolve o alerta de remarcação", () => {
  beforeEach(() => {
    outboxFindCalls = 0;
    scheduleUpsertMock.mockClear();
    leadUpdateMock.mockClear();
    alertUpdateManyMock.mockClear();
    bethaniaOutboxCreateManyMock.mockClear();
    bethaniaOutboxFindUniqueMock.mockClear();
    bethaniaDeliveryLogCreateMock.mockClear();
  });

  it("zera needsReschedule do lead na mesma gravação da reunião", async () => {
    await new LeadSchedulePersistenceRepository().persist(input);

    expect(leadUpdateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "lead-1" },
      data: { needsReschedule: false, closerId: "closer-1" },
    });
  });

  it("marca como resolvidos os alertas abertos do lead, na mesma transação", async () => {
    await new LeadSchedulePersistenceRepository().persist(input);

    expect(alertUpdateManyMock).toHaveBeenCalledTimes(1);
    const call = alertUpdateManyMock.mock.calls[0]?.[0] as { where: Args; data: { resolvedAt: unknown } };
    expect(call.where).toEqual({ leadId: "lead-1", resolvedAt: null });
    expect(call.data.resolvedAt).toBeInstanceOf(Date);
  });

  it("enfileira a criação na mesma transação com chave idempotente", async () => {
    await new LeadSchedulePersistenceRepository().persist(input);

    expect(bethaniaOutboxCreateManyMock).toHaveBeenCalledTimes(1);
    expect(bethaniaOutboxCreateManyMock.mock.calls[0]?.[0]).toMatchObject({
      data: [{
        idempotencyKey: "schedule:schedule-1:2026-11-03T14:00:00.000Z",
        profileId: "closer-1",
        eventType: "schedule.created_or_rescheduled",
        status: "pending",
      }],
      skipDuplicates: true,
    });
    expect(bethaniaDeliveryLogCreateMock).toHaveBeenCalledTimes(1);
  });

  it("enfileira a remarcação quando a data muda", async () => {
    const previousDate = new Date("2026-11-02T14:00:00.000Z");
    await new LeadSchedulePersistenceRepository().persist({
      ...input,
      existingSchedule: { date: previousDate } as PersistLeadScheduleInput["existingSchedule"],
      isReschedule: true,
    });

    expect(bethaniaOutboxCreateManyMock.mock.calls[0]?.[0]).toMatchObject({
      data: [{ eventType: "schedule.created_or_rescheduled", profileId: "closer-1" }],
    });
    const call = bethaniaOutboxCreateManyMock.mock.calls[0]?.[0] as { data: Array<{ message: string }> };
    expect(call.data[0]?.message).toContain("reagendado");
  });

  it("não enfileira quando a data do agendamento não mudou", async () => {
    await new LeadSchedulePersistenceRepository().persist({
      ...input,
      existingSchedule: { date: input.meetingDate } as PersistLeadScheduleInput["existingSchedule"],
    });

    expect(bethaniaOutboxCreateManyMock).not.toHaveBeenCalled();
  });

  it("não enfileira quando o closer destinatário criou o próprio agendamento", async () => {
    await new LeadSchedulePersistenceRepository().persist({ ...input, createdByProfileId: "closer-1" });

    expect(bethaniaOutboxCreateManyMock).not.toHaveBeenCalled();
  });
});
