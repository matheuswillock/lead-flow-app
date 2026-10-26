import { beforeEach, describe, expect, it, mock } from "bun:test";

type Where = Record<string, unknown>;

const executeRawMock = mock(async (..._args: unknown[]) => 1);
const memberFindFirstMock = mock(async (_args: unknown) => ({ id: "member" }) as { id: string } | null);
const reservationFindFirstMock = mock(async (_args: { where: Where }) => null as { id: string } | null);
const leadFindManyMock = mock(
  async (_args: { where: Where }) =>
    [] as Array<{ id: string; meetingDate: Date | null; meetingDurationMinutes: number | null }>
);
const reservationCreateMock = mock(async (_args: unknown) => ({ id: "reservation-1" }));

const transaction = {
  teamMember: { findFirst: memberFindFirstMock },
  $executeRaw: executeRawMock,
  teamMeetingSlotReservation: {
    findFirst: reservationFindFirstMock,
    create: reservationCreateMock,
  },
  lead: { findMany: leadFindManyMock },
};

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
  },
}));

const { TeamMeetingSlotReservationRepository } = await import("./TeamMeetingSlotReservationRepository");

const STARTS_AT = new Date("2026-11-03T14:00:00.000Z");
const ENDS_AT = new Date("2026-11-03T14:30:00.000Z");

const input = {
  teamId: "team-a",
  closerId: "closer-1",
  startsAt: STARTS_AT,
  endsAt: ENDS_AT,
  durationMinutes: 30,
  source: "webhook",
} as never;

describe("TeamMeetingSlotReservationRepository.reserve — trava por closer em qualquer time", () => {
  beforeEach(() => {
    executeRawMock.mockClear();
    memberFindFirstMock.mockClear();
    reservationFindFirstMock.mockReset();
    reservationFindFirstMock.mockResolvedValue(null);
    leadFindManyMock.mockReset();
    leadFindManyMock.mockResolvedValue([]);
    reservationCreateMock.mockClear();
  });

  it("serializa por closer, sem incluir o time na chave da trava", async () => {
    await new TeamMeetingSlotReservationRepository().reserve(input);

    const lockCall = executeRawMock.mock.calls[0];
    // `$executeRaw(Prisma.sql\`...hashtext(${lockKey})\`)` — o valor da chave vai em `values`.
    const sql = lockCall?.[0] as { values?: unknown[] };
    expect(sql.values).toEqual(["closer:closer-1"]);
  });

  it("não filtra reservas conflitantes por time: reserva de outro time do mesmo closer bloqueia", async () => {
    reservationFindFirstMock.mockResolvedValue({ id: "reservation-other-team" });

    const result = await new TeamMeetingSlotReservationRepository().reserve(input);

    expect(result).toEqual({ available: false });
    const where = reservationFindFirstMock.mock.calls[0]?.[0].where as Where;
    expect(where).not.toHaveProperty("teamId");
    expect(where).toMatchObject({ closerId: "closer-1" });
    expect(reservationCreateMock).not.toHaveBeenCalled();
  });

  it("não filtra reuniões de leads por time: reunião do mesmo closer em outro time bloqueia", async () => {
    leadFindManyMock.mockResolvedValue([
      { id: "lead-other-team", meetingDate: STARTS_AT, meetingDurationMinutes: 30 },
    ]);

    const result = await new TeamMeetingSlotReservationRepository().reserve(input);

    expect(result).toEqual({ available: false });
    const where = leadFindManyMock.mock.calls[0]?.[0].where as Where;
    expect(where).not.toHaveProperty("teamId");
    expect(where).toMatchObject({ closerId: "closer-1" });
  });

  it("closers diferentes no mesmo horário não se bloqueiam", async () => {
    const result = await new TeamMeetingSlotReservationRepository().reserve({
      ...(input as object),
      closerId: "closer-2",
    } as never);

    expect(result).toEqual({ available: true, reservationId: "reservation-1" });
    const where = reservationFindFirstMock.mock.calls[0]?.[0].where as Where;
    expect(where).toMatchObject({ closerId: "closer-2" });
  });
});
