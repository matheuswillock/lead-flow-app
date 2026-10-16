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

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    teamMeetingSlotReservation: {
      findMany: findManyMock,
    },
  },
}));

const { MAX_RECOVERY_ATTEMPTS, TeamMeetingSlotReservationRepository } = await import(
  "./TeamMeetingSlotReservationRepository"
);

describe("TeamMeetingSlotReservationRepository.findRecoverable", () => {
  beforeEach(() => {
    findManyMock.mockClear();
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
});
