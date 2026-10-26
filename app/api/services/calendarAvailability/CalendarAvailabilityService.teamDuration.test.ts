import { describe, expect, test } from "bun:test";
import { CalendarAvailabilityService } from "./CalendarAvailabilityService";
import type { ICalendarAvailabilityRepository } from "@/app/api/infra/data/repositories/calendarAvailability/ICalendarAvailabilityRepository";

function createRepository(): ICalendarAvailabilityRepository {
  return {
    async findConflictingLeadId() {
      return null;
    },
    async findMeetingDuration() {
      return 45;
    },
    async findTeamMemberProfileIds(_teamId, closerIds) {
      return closerIds;
    },
    async findCloserProfiles() {
      return [
        {
          id: "closer-1",
          email: "closer@example.com",
          timezone: "America/Sao_Paulo",
          googleCalendarConnected: false,
          googleRefreshToken: null,
          googleAccessToken: null,
          googleTokenExpiresAt: null,
          googleConnection: null,
          supabaseId: null,
        },
      ];
    },
    async findExcludedLead() {
      return null;
    },
    async findScheduledLeadsForDay() {
      return [
        {
          closerId: "closer-1",
          meetingDate: new Date("2030-01-10T03:00:00.000Z"),
          meetingDurationMinutes: 60,
        },
      ];
    },
    async findActiveReservations() {
      return [];
    },
  };
}

describe("CalendarAvailabilityService com duração do time", () => {
  test("gera slots de 45 minutos e bloqueia a duração persistida da reunião existente", async () => {
    const service = new CalendarAvailabilityService(createRepository());

    const result = await service.getAvailability({
      teamId: "team-1",
      requestedCloserIds: ["closer-1"],
      date: "2030-01-10",
      userTimezone: "America/Sao_Paulo",
    });

    expect(result.durationMinutes).toBe(45);
    expect(result.availableTimes).not.toContain("00:00");
    expect(result.availableTimes).not.toContain("00:45");
    expect(result.availableTimes).toContain("01:30");
    expect(result.availableTimes).not.toContain("23:45");
  });
});
