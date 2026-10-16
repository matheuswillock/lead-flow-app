import { describe, expect, test } from "bun:test";
import {
  DEFAULT_MEETING_DURATION_MINUTES,
  MEETING_DURATION_OPTIONS,
  isMeetingDurationMinutes,
} from "./meetingDuration";

describe("meeting duration catalog", () => {
  test("accepts only five-minute durations between five and sixty", () => {
    expect(MEETING_DURATION_OPTIONS).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
    expect(DEFAULT_MEETING_DURATION_MINUTES).toBe(30);
    expect(isMeetingDurationMinutes(5)).toBe(true);
    expect(isMeetingDurationMinutes(45)).toBe(true);
    expect(isMeetingDurationMinutes(60)).toBe(true);
    expect(isMeetingDurationMinutes(0)).toBe(false);
    expect(isMeetingDurationMinutes(12)).toBe(false);
    expect(isMeetingDurationMinutes(65)).toBe(false);
  });
});
