import { describe, expect, it } from "bun:test";
import { ReconcileMeetingSlotReservationsUseCase } from "./ReconcileMeetingSlotReservationsUseCase";

describe("ReconcileMeetingSlotReservationsUseCase", () => {
  it("consome somente a reserva cujo evento externo já foi persistido", async () => {
    const consumed: string[] = [];
    const failures: string[] = [];
    const useCase = new ReconcileMeetingSlotReservationsUseCase(
      {
        findRecoverable: async () => [
          { id: "ok", leadId: "lead-ok", googleEventId: "event", googleCalendarId: "calendar" },
          { id: "pending", leadId: "lead-pending", googleEventId: "event-2", googleCalendarId: "calendar" },
        ],
        consume: async ({ reservationId }) => { consumed.push(reservationId); },
        markRecoveryFailure: async (reservationId) => { failures.push(reservationId); },
      },
      {
        findUniqueByLeadId: async (leadId) => leadId === "lead-ok"
          ? { googleEventId: "event", googleCalendarId: "calendar" }
          : { googleEventId: "other", googleCalendarId: "calendar" },
      },
    );

    const output = await useCase.execute();

    expect(output.isValid).toBe(true);
    expect(consumed).toEqual(["ok"]);
    expect(failures).toEqual(["pending"]);
  });
});
