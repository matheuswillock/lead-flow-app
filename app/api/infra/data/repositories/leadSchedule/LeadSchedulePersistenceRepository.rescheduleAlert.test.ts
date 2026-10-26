import { beforeEach, describe, expect, it, mock } from "bun:test";

type Args = Record<string, unknown>;

const scheduleUpsertMock = mock(async (_args: Args) => ({ id: "schedule-1" }));
const leadUpdateMock = mock(async (_args: Args) => ({ id: "lead-1" }));
const activityCreateMock = mock(async (_args: Args) => ({}));
const alertUpdateManyMock = mock(async (_args: Args) => ({ count: 1 }));

const tx = {
  leadsSchedule: { upsert: scheduleUpsertMock },
  lead: { update: leadUpdateMock },
  leadActivity: { create: activityCreateMock },
  leadRescheduleAlert: { updateMany: alertUpdateManyMock },
};

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) },
}));

const { LeadSchedulePersistenceRepository } = await import("./LeadSchedulePersistenceRepository");

const input = {
  scheduleId: "schedule-1",
  leadId: "lead-1",
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
} as never;

/**
 * SPEC 11 (DA9) / T-11.20: o alerta "remarcar urgente" se resolve sozinho quando o lead é
 * agendado (pelo CRM ou por qualquer caminho que grave a reunião).
 */
describe("LeadSchedulePersistenceRepository.persist — resolve o alerta de remarcação", () => {
  beforeEach(() => {
    scheduleUpsertMock.mockClear();
    leadUpdateMock.mockClear();
    alertUpdateManyMock.mockClear();
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
});
