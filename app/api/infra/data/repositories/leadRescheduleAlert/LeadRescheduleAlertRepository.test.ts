import { beforeEach, describe, expect, it, mock } from "bun:test";

type Args = Record<string, unknown>;

const findFirstMock = mock(async (_args: Args) => null as { id: string } | null);
const createMock = mock(async (_args: Args) => ({ id: "alert-1" }));
const leadUpdateMock = mock(async (_args: Args) => ({}));

const tx = {
  leadRescheduleAlert: { findFirst: findFirstMock, create: createMock },
  lead: { update: leadUpdateMock },
};

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) },
}));

const { LeadRescheduleAlertRepository } = await import("./LeadRescheduleAlertRepository");

const input = {
  teamId: "team-1",
  leadId: "lead-1",
  reasonCode: "schedule_conflict",
  requestedStartsAt: new Date("2026-11-03T14:00:00.000Z"),
  requestedCloserId: "closer-1",
  conflictingLeadId: "lead-9",
  suggestedSlots: [{ startsAt: "2026-11-03T14:30:00.000Z", endsAt: "2026-11-03T15:00:00.000Z" }],
  sourceEventId: "event-1",
};

describe("LeadRescheduleAlertRepository.open", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    findFirstMock.mockResolvedValue(null);
    createMock.mockClear();
    leadUpdateMock.mockClear();
  });

  it("cria o alerta e sinaliza o lead na mesma transação", async () => {
    const result = await new LeadRescheduleAlertRepository().open(input);

    expect(result).toEqual({ id: "alert-1", created: true });
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      data: {
        teamId: "team-1",
        leadId: "lead-1",
        reasonCode: "schedule_conflict",
        requestedCloserId: "closer-1",
        conflictingLeadId: "lead-9",
        sourceEventId: "event-1",
      },
    });
    expect(leadUpdateMock.mock.calls[0]?.[0]).toEqual({ where: { id: "lead-1" }, data: { needsReschedule: true } });
  });

  it("é idempotente por evento: o retry do mesmo evento não duplica o alerta", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "alert-existing" });

    const result = await new LeadRescheduleAlertRepository().open(input);

    expect(result).toEqual({ id: "alert-existing", created: false });
    expect(createMock).not.toHaveBeenCalled();
    expect(findFirstMock.mock.calls[0]?.[0]).toMatchObject({
      where: { leadId: "lead-1", sourceEventId: "event-1", resolvedAt: null },
    });
  });

  it("sem evento de origem não há como deduplicar: sempre cria", async () => {
    await new LeadRescheduleAlertRepository().open({ ...input, sourceEventId: null });
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
