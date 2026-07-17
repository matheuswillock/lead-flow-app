import { describe, expect, it } from "bun:test";
import { resolveCloserCalendarTransfer } from "./resolveCloserCalendarTransfer";

describe("resolveCloserCalendarTransfer", () => {
  it("na troca de closer com googleEventId cancela no antigo e cria no novo com Meet preservado", () => {
    const plan = resolveCloserCalendarTransfer({
      closerId: "closer-novo",
      leadCurrentCloserId: "closer-antigo",
      existingGoogleEventId: "evt-123",
      existingMeetingLink: "https://meet.google.com/abc-defg-hij",
      leadMeetingLink: "https://meet.google.com/legacy",
      requestMeetingLink: null,
    });

    expect(plan.shouldTransferCalendarOwnership).toBe(true);
    expect(plan.previousCloserId).toBe("closer-antigo");
    expect(plan.previousEventId).toBe("evt-123");
    expect(plan.existingEventIdForUpsert).toBeNull();
    expect(plan.meetingLinkForUpsert).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("prioriza Meet enviado na request sobre o da schedule/lead", () => {
    const plan = resolveCloserCalendarTransfer({
      closerId: "closer-novo",
      leadCurrentCloserId: "closer-antigo",
      existingGoogleEventId: "evt-123",
      existingMeetingLink: "https://meet.google.com/from-schedule",
      leadMeetingLink: "https://meet.google.com/from-lead",
      requestMeetingLink: "https://meet.google.com/from-request",
    });

    expect(plan.meetingLinkForUpsert).toBe("https://meet.google.com/from-request");
    expect(plan.existingEventIdForUpsert).toBeNull();
  });

  it("sem Google no antigo ainda cria no novo com Meet preservado (só planeja transfer)", () => {
    const plan = resolveCloserCalendarTransfer({
      closerId: "closer-novo",
      leadCurrentCloserId: "closer-antigo",
      existingGoogleEventId: "evt-orphan",
      existingMeetingLink: null,
      leadMeetingLink: "https://meet.google.com/from-lead",
      requestMeetingLink: undefined,
    });

    expect(plan.shouldTransferCalendarOwnership).toBe(true);
    expect(plan.meetingLinkForUpsert).toBe("https://meet.google.com/from-lead");
    expect(plan.existingEventIdForUpsert).toBeNull();
  });

  it("sem troca de closer reutiliza existingEventId e não força Meet da schedule", () => {
    const plan = resolveCloserCalendarTransfer({
      closerId: "closer-mesmo",
      leadCurrentCloserId: "closer-mesmo",
      existingGoogleEventId: "evt-keep",
      existingMeetingLink: "https://meet.google.com/keep",
      leadMeetingLink: null,
      requestMeetingLink: null,
    });

    expect(plan.shouldTransferCalendarOwnership).toBe(false);
    expect(plan.existingEventIdForUpsert).toBe("evt-keep");
    expect(plan.meetingLinkForUpsert).toBeNull();
  });

  it("troca de closer sem evento existente não marca transfer, mas preserva Meet", () => {
    const plan = resolveCloserCalendarTransfer({
      closerId: "closer-novo",
      leadCurrentCloserId: "closer-antigo",
      existingGoogleEventId: null,
      existingMeetingLink: "https://meet.google.com/only-link",
      requestMeetingLink: null,
    });

    expect(plan.shouldTransferCalendarOwnership).toBe(false);
    expect(plan.existingEventIdForUpsert).toBeNull();
    expect(plan.meetingLinkForUpsert).toBe("https://meet.google.com/only-link");
  });
});
