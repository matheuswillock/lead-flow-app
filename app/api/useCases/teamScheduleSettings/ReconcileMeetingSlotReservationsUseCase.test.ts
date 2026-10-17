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

  it("cancela o evento externo antes de liberar uma reserva esgotada", async () => {
    const calls: string[] = [];
    const useCase = new ReconcileMeetingSlotReservationsUseCase(
      {
        findRecoverable: async () => [
          {
            id: "stale",
            leadId: "lead-stale",
            googleEventId: "event-stale",
            googleCalendarId: "calendar",
            recoveryAttempts: 19,
          },
        ],
        consume: async () => {},
        markRecoveryFailure: async () => {},
        releaseAfterRecoveryTimeout: async () => {
          calls.push("release");
        },
      },
      {
        findUniqueByLeadId: async () => ({
          googleEventId: "other-event",
          googleCalendarId: "calendar",
        }),
      },
      100,
      {
        cancel: async (input) => {
          expect(input).toEqual({
            leadId: "lead-stale",
            googleEventId: "event-stale",
            googleCalendarId: "calendar",
          });
          calls.push("cancel");
        },
      },
    );

    await useCase.execute();

    expect(calls).toEqual(["cancel", "release"]);
  });

  it("não libera a reserva quando o cancelamento externo falha", async () => {
    let releaseCalled = false;
    const release = async () => {
      releaseCalled = true;
    };
    const failures: string[] = [];
    const useCase = new ReconcileMeetingSlotReservationsUseCase(
      {
        findRecoverable: async () => [
          {
            id: "stale",
            leadId: "lead-stale",
            googleEventId: "event-stale",
            googleCalendarId: "calendar",
            recoveryAttempts: 19,
          },
        ],
        consume: async () => {},
        markRecoveryFailure: async (reservationId) => {
          failures.push(reservationId);
        },
        releaseAfterRecoveryTimeout: release,
      },
      {
        findUniqueByLeadId: async () => ({
          googleEventId: "other-event",
          googleCalendarId: "calendar",
        }),
      },
      100,
      { cancel: async () => { throw new Error("Google indisponível"); } },
    );

    const output = await useCase.execute();

    expect(output.result).toMatchObject({ recovered: 0, pending: 1 });
    expect(failures).toEqual(["stale"]);
    expect(releaseCalled).toBe(false);
  });
});
