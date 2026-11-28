import { describe, expect, it } from "bun:test";
import {
  AGENDA_EVENT_TYPES,
  classifyScheduleChange,
  getMeetingEnd,
} from "./agenda-rules";

describe("Bethânia agenda event rules", () => {
  it("exposes the stable agenda event identifiers", () => {
    expect(AGENDA_EVENT_TYPES).toEqual([
      "schedule.created_or_rescheduled",
      "agenda.daily_0700",
      "meeting.follow_up_1h",
      "agenda.overdue_1500",
    ]);
  });

  it("classifies a newly created schedule for another broker", () => {
    expect(
      classifyScheduleChange({
        previousDate: null,
        nextDate: "2026-12-01T14:00:00.000Z",
        actorProfileId: "assistant-1",
        recipientProfileId: "broker-1",
      }),
    ).toEqual({ change: "created", shouldNotify: true });
  });

  it("classifies a changed date as a reschedule", () => {
    expect(
      classifyScheduleChange({
        previousDate: "2026-12-01T14:00:00.000Z",
        nextDate: "2026-12-02T14:00:00.000Z",
        actorProfileId: "assistant-1",
        recipientProfileId: "broker-1",
      }),
    ).toEqual({ change: "rescheduled", shouldNotify: true });
  });

  it("suppresses a no-op schedule edit", () => {
    expect(
      classifyScheduleChange({
        previousDate: "2026-12-01T14:00:00.000Z",
        nextDate: "2026-12-01T14:00:00.000Z",
        actorProfileId: "assistant-1",
        recipientProfileId: "broker-1",
      }),
    ).toEqual({ change: "unchanged", shouldNotify: false });
  });

  it("suppresses a schedule created by its recipient broker", () => {
    expect(
      classifyScheduleChange({
        previousDate: null,
        nextDate: "2026-12-01T14:00:00.000Z",
        actorProfileId: "broker-1",
        recipientProfileId: "broker-1",
      }),
    ).toEqual({ change: "created", shouldNotify: false });
  });

  it("calculates meeting end from stored duration", () => {
    expect(getMeetingEnd("2026-12-01T14:00:00.000Z", 45)).toBe(
      "2026-12-01T14:45:00.000Z",
    );
  });

  it("uses the canonical 30-minute duration when duration is absent", () => {
    expect(getMeetingEnd("2026-12-01T14:00:00.000Z", null)).toBe(
      "2026-12-01T14:30:00.000Z",
    );
  });

  it("rejects invalid schedule inputs", () => {
    expect(() =>
      classifyScheduleChange({
        previousDate: null,
        nextDate: "not-a-date",
        actorProfileId: "actor",
        recipientProfileId: "recipient",
      }),
    ).toThrow();
    expect(() =>
      classifyScheduleChange({
        previousDate: null,
        nextDate: "2026-12-01T14:00:00.000Z",
        actorProfileId: " ",
        recipientProfileId: "recipient",
      }),
    ).toThrow();
    expect(() => getMeetingEnd("2026-12-01T14:00:00.000Z", 0)).toThrow();
    expect(() => getMeetingEnd("not-a-date", null)).toThrow();
  });
});
