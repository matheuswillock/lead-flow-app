import { describe, expect, it } from "bun:test";
import { ReconcileMeetingSlotReservationsUseCase } from "./ReconcileMeetingSlotReservationsUseCase";

describe("ReconcileMeetingSlotReservationsUseCase", () => {
  it("consome somente a reserva cujo evento externo já foi persistido", async () => {
    const consumed: string[] = [];
    const failures: string[] = [];
    const useCase = new ReconcileMeetingSlotReservationsUseCase(
      {
        findRecoverable: async () => [
          { id: "ok", leadId: "lead-ok", closerId: "closer-ok", googleEventId: "event", googleCalendarId: "calendar" },
          { id: "pending", leadId: "lead-pending", closerId: "closer-pending", googleEventId: "event-2", googleCalendarId: "calendar" },
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

  it("cancela o evento com o closer da reserva antes de liberá-la", async () => {
    const calls: string[] = [];
    const useCase = new ReconcileMeetingSlotReservationsUseCase(
      {
        findRecoverable: async () => [
          {
            id: "stale",
            leadId: "lead-stale",
            closerId: "requested-closer",
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
        findUniqueByLeadId: async () => ({ googleEventId: "other-event", googleCalendarId: "calendar" }),
      },
      100,
      {
        cancel: async (input) => {
          expect(input).toEqual({
            closerId: "requested-closer",
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
    const failures: string[] = [];
    const useCase = new ReconcileMeetingSlotReservationsUseCase(
      {
        findRecoverable: async () => [
          {
            id: "stale",
            leadId: "lead-stale",
            closerId: "requested-closer",
            googleEventId: "event-stale",
            googleCalendarId: "calendar",
            recoveryAttempts: 19,
          },
        ],
        consume: async () => {},
        markRecoveryFailure: async (reservationId) => {
          failures.push(reservationId);
        },
        releaseAfterRecoveryTimeout: async () => {
          releaseCalled = true;
        },
      },
      {
        findUniqueByLeadId: async () => ({ googleEventId: "other-event", googleCalendarId: "calendar" }),
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
