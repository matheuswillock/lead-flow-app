import { describe, expect, it } from "bun:test";
import type { ITeamMeetingSlotReservationRepository } from "@/app/api/infra/data/repositories/teamMeetingSlotReservation/ITeamMeetingSlotReservationRepository";
import { MeetingSlotReservationService } from "./MeetingSlotReservationService";

describe("MeetingSlotReservationService", () => {
  it("calcula a duração do time e não aceita duração vinda do chamador", async () => {
    const startsAt = new Date(Date.now() + 60 * 60 * 1_000);
    const reservations: ITeamMeetingSlotReservationRepository = {
      isCloserEligibleForTeam: async () => true,
      reserve: async (input) => {
        expect(input.durationMinutes).toBe(45);
        expect(input.endsAt.toISOString()).toBe(
          new Date(startsAt.getTime() + 45 * 60 * 1_000).toISOString(),
        );
        return { available: true, reservationId: "reservation" };
      },
      consume: async () => {},
      validate: async () => true,
      release: async () => {},
      attachToPublicFormSubmission: async () => {},
      attachToLead: async () => {},
      markExternalEvent: async () => {},
      findRecoverable: async () => [],
      markRecoveryFailure: async () => {},
      releaseConsumedForLead: async () => {},
      findValid: async () => null,
    };
    const service = new MeetingSlotReservationService(reservations, {
      findMeetingDuration: async () => 45,
      updateMeetingDuration: async () => null,
    });

    const result = await service.reserve({
      teamId: "team",
      closerId: "closer",
      startsAt,
      source: "internal",
    });

    expect(result).toEqual({
      available: true,
      reservationId: "reservation",
      durationMinutes: 45,
      endsAt: new Date(startsAt.getTime() + 45 * 60 * 1_000),
    });
  });

  it("não reserva para closer fora do time ou para data fora da janela", async () => {
    let repositoryCalled = false;
    const reservations: ITeamMeetingSlotReservationRepository = {
      isCloserEligibleForTeam: async () => false,
      reserve: async () => {
        repositoryCalled = true;
        return { available: true, reservationId: "unexpected" };
      },
      consume: async () => {},
      validate: async () => true,
      release: async () => {},
      attachToPublicFormSubmission: async () => {},
      attachToLead: async () => {},
      markExternalEvent: async () => {},
      findRecoverable: async () => [],
      markRecoveryFailure: async () => {},
      releaseConsumedForLead: async () => {},
      findValid: async () => null,
    };
    const service = new MeetingSlotReservationService(reservations, {
      findMeetingDuration: async () => 30,
      updateMeetingDuration: async () => null,
    });

    const result = await service.reserve({
      teamId: "team",
      closerId: "closer",
      startsAt: new Date("2026-10-20T12:00:00.000Z"),
      source: "internal",
    });

    expect(result).toEqual({ available: false });
    expect(repositoryCalled).toBe(false);
  });
});
