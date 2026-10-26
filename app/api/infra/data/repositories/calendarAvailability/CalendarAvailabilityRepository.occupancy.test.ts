import { beforeEach, describe, expect, it, mock } from "bun:test";

type Args = { where: Record<string, unknown> };

const leadFindManyMock = mock(async (_args: Args) => [] as unknown[]);
const reservationFindManyMock = mock(async (_args: Args) => [] as unknown[]);

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    lead: { findMany: leadFindManyMock },
    teamMeetingSlotReservation: { findMany: reservationFindManyMock },
  },
}));

const { CalendarAvailabilityRepository } = await import("./CalendarAvailabilityRepository");

const range = {
  dayStart: new Date("2026-11-03T00:00:00.000Z"),
  dayEnd: new Date("2026-11-04T00:00:00.000Z"),
};

/**
 * SPEC 13/14 (DA3): ocupação por closer em QUALQUER time e por reunião em qualquer status que não seja
 * terminal. Closer que atende em dois times não pode aparecer livre num deles com reunião no outro.
 */
describe("CalendarAvailabilityRepository — ocupação do closer", () => {
  beforeEach(() => {
    leadFindManyMock.mockClear();
    reservationFindManyMock.mockClear();
  });

  it("reuniões de leads não filtram por time (T-14.8: reunião em outro time ocupa o horário)", async () => {
    await new CalendarAvailabilityRepository().findScheduledLeadsForDay({
      teamId: "team-a",
      requestedCloserIds: ["closer-1"],
      ...range,
    });

    const where = leadFindManyMock.mock.calls[0]?.[0].where;
    expect(where).not.toHaveProperty("teamId");
    expect(where).toMatchObject({ closerId: { in: ["closer-1"] } });
  });

  it("conta lead em qualquer status não terminal, não só `scheduled` (T-14.9: no_show ocupa o horário)", async () => {
    await new CalendarAvailabilityRepository().findScheduledLeadsForDay({
      teamId: "team-a",
      requestedCloserIds: ["closer-1"],
      ...range,
    });

    const where = leadFindManyMock.mock.calls[0]?.[0].where;
    expect(where).not.toHaveProperty("status", "scheduled");
    expect(where).toMatchObject({
      deletedAt: null,
      status: { notIn: ["contract_finalized", "opportunityLost", "disqualified", "operator_denied"] },
    });
  });

  it("reservas ativas não filtram por time", async () => {
    await new CalendarAvailabilityRepository().findActiveReservations({
      teamId: "team-a",
      requestedCloserIds: ["closer-1"],
      rangeStart: range.dayStart,
      rangeEnd: range.dayEnd,
    });

    const where = reservationFindManyMock.mock.calls[0]?.[0].where;
    expect(where).not.toHaveProperty("teamId");
    expect(where).toMatchObject({ closerId: { in: ["closer-1"] }, state: { in: ["reserved", "consumed"] } });
  });
});
