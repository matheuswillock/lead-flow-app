import { describe, expect, test } from "bun:test";
import {
  isScheduleReschedule,
  resolveTransferScheduleInput,
} from "./resolveTransferSchedule";

describe("resolveTransferScheduleInput", () => {
  test("mescla extraGuests do pré-agendamento existente", () => {
    const result = resolveTransferScheduleInput(
      { date: "2026-06-20T15:00:00.000Z", meetingType: "online" },
      { email: "lead@example.com", meetingTitle: "Título lead" },
      { extraGuests: ["guest@example.com"], meetingType: "online", googleEventId: null }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.extraGuests).toEqual(["guest@example.com"]);
      expect(result.value.meetingType).toBe("online");
      expect(result.value.transitionStatusToScheduled).toBe(true);
    }
  });

  test("falha sem data de agendamento", () => {
    const result = resolveTransferScheduleInput(
      { meetingType: "online" },
      { email: "lead@example.com" },
      null
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Data do agendamento");
    }
  });

  test("falha sem e-mail do lead para reunião online", () => {
    const result = resolveTransferScheduleInput(
      { date: "2026-06-20T15:00:00.000Z", meetingType: "online" },
      { email: "" },
      null
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("e-mail");
    }
  });

  test("usa data do lead quando schedule.date ausente", () => {
    const result = resolveTransferScheduleInput(
      { meetingType: "online" },
      { email: "lead@example.com", meetingDate: "2026-06-20T14:30:00.000Z" },
      null
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.meetingDateIso).toBe("2026-06-20T14:30:00.000Z");
    }
  });

  test("default meetingType é online", () => {
    const result = resolveTransferScheduleInput(
      { date: "2026-06-20T15:00:00.000Z" },
      { email: "lead@example.com" },
      null
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.meetingType).toBe("online");
    }
  });
});

describe("isScheduleReschedule", () => {
  test("pré-agendamento sem googleEventId não é reagendamento", () => {
    expect(isScheduleReschedule({ googleEventId: null })).toBe(false);
    expect(isScheduleReschedule(null)).toBe(false);
  });

  test("agendamento com googleEventId é reagendamento", () => {
    expect(isScheduleReschedule({ googleEventId: "evt-123" })).toBe(true);
  });
});
