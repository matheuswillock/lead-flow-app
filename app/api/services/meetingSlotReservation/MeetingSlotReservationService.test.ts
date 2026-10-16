import { describe, expect, it } from "bun:test";
import type { ITeamMeetingSlotReservationRepository } from "@/app/api/infra/data/repositories/teamMeetingSlotReservation/ITeamMeetingSlotReservationRepository";
import { MeetingSlotReservationService } from "./MeetingSlotReservationService";

describe("MeetingSlotReservationService", () => {
  it("calcula a duração do time e não aceita duração vinda do chamador", async () => {
    const reservations: ITeamMeetingSlotReservationRepository = {
      reserve: async (input) => {
        expect(input.durationMinutes).toBe(45);
        expect(input.endsAt.toISOString()).toBe("2026-10-20T12:45:00.000Z");
        return { available: true, reservationId: "reservation" };
      },
      consume: async () => {},
      release: async () => {},
      attachToPublicFormSubmission: async () => {},
      attachToLead: async () => {},
      markExternalEvent: async () => {},
      findRecoverable: async () => [],
      markRecoveryFailure: async () => {},
    };
    const service = new MeetingSlotReservationService(reservations, {
      findMeetingDuration: async () => 45,
      updateMeetingDuration: async () => null,
    });

    const result = await service.reserve({
      teamId: "team",
      closerId: "closer",
      startsAt: new Date("2026-10-20T12:00:00.000Z"),
      source: "internal",
    });

    expect(result).toEqual({
      available: true,
      reservationId: "reservation",
      durationMinutes: 45,
      endsAt: new Date("2026-10-20T12:45:00.000Z"),
    });
  });
});
