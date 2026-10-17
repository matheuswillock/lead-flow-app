import { beforeEach, describe, expect, it, mock } from "bun:test";

type FindManyArgs = {
  where?: {
    state?: unknown;
    googleEventId?: unknown;
    googleCalendarId?: unknown;
    recoveryAttempts?: { lt?: number };
  };
  select?: unknown;
  take?: number;
  orderBy?: unknown;
};

const findManyMock = mock(async (_args: FindManyArgs) => [] as Array<Record<string, unknown>>);
const updateManyMock = mock(async (_args: unknown) => ({ count: 0 }));
const findFirstMock = mock(async (_args: unknown) => null as { id: string } | null);

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    teamMeetingSlotReservation: {
      findMany: findManyMock,
      findFirst: findFirstMock,
      updateMany: updateManyMock,
    },
  },
}));

const { MAX_RECOVERY_ATTEMPTS, ReservationConflictError, TeamMeetingSlotReservationRepository } = await import(
  "./TeamMeetingSlotReservationRepository"
);

describe("TeamMeetingSlotReservationRepository.findRecoverable", () => {
  beforeEach(() => {
    findManyMock.mockClear();
    updateManyMock.mockReset();
    findFirstMock.mockReset();
  });

  it("exclui reservas que estouraram o teto de tentativas de recuperação", async () => {
    await new TeamMeetingSlotReservationRepository().findRecoverable(100);

    const args = findManyMock.mock.calls[0]?.[0] as FindManyArgs | undefined;
    expect(args?.where?.recoveryAttempts).toEqual({ lt: MAX_RECOVERY_ATTEMPTS });
  });

  it("mantém o teto em 20 tentativas", async () => {
    expect(MAX_RECOVERY_ATTEMPTS).toBe(20);
  });

  it("respeita o limite do lote", async () => {
    await new TeamMeetingSlotReservationRepository().findRecoverable(7);

    const args = findManyMock.mock.calls[0]?.[0] as FindManyArgs | undefined;
    expect(args?.take).toBe(7);
  });

  it("não consome uma reserva liberada ou já consumida", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });

    await expect(new TeamMeetingSlotReservationRepository().consume({ reservationId: "reservation" }))
      .rejects.toBeInstanceOf(ReservationConflictError);
    expect(updateManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "reservation", state: "reserved" },
    });
  });

  it("valida estado, closer, horário e duração imutável antes de aceitar uma reserva", async () => {
    findFirstMock.mockResolvedValue({ id: "reservation" });

    const valid = await new TeamMeetingSlotReservationRepository().validate({
      reservationId: "reservation",
      teamId: "team",
      closerId: "closer",
      startsAt: new Date("2026-10-20T12:00:00.000Z"),
      durationMinutes: 45,
    });

    expect(valid).toBe(true);
    expect(findFirstMock.mock.calls[0]?.[0]).toMatchObject({
      where: expect.objectContaining({
        state: "reserved",
        teamId: "team",
        closerId: "closer",
        durationMinutes: 45,
      }),
    });
  });
});
