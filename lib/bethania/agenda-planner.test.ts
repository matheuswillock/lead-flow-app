import { describe, expect, it } from "bun:test";
import { buildScheduleChangePlan, planBrokerAgendaEvents } from "./agenda-planner";

const PROFILE = {
  id: "broker-1",
  supabaseId: "11111111-1111-4111-8111-111111111111",
  timezone: "America/Sao_Paulo",
};
const DAY = "2026-11-23";
const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 10, 23, hour, minute));
const appointment = (overrides: Partial<{
  id: string;
  leadId: string;
  leadCode: string;
  leadName: string;
  date: Date;
  durationMinutes: number | null;
  meetingHeald: "yes" | "no" | null;
  status: string;
}> = {}) => ({
  id: "schedule-1",
  leadId: "lead-1",
  leadCode: "LEAD-1",
  leadName: "Ana",
  date: at(13),
  durationMinutes: 30,
  meetingHeald: null as "yes" | "no" | null,
  status: "scheduled",
  ...overrides,
});

describe("buildScheduleChangePlan", () => {
  it("plans one idempotent notification for another broker's new schedule", () => {
    expect(buildScheduleChangePlan({
      scheduleId: "schedule-1",
      profile: PROFILE,
      actorProfileId: "operator-1",
      previousDate: null,
      nextDate: at(13),
      updatedAt: at(10),
      leadName: "Ana",
    })).toMatchObject({
      eventType: "schedule.created_or_rescheduled",
      idempotencyKey: "schedule:schedule-1:2026-11-23T10:00:00.000Z",
      message: expect.stringContaining("Ana"),
    });
  });

  it("suppresses a self-created or unchanged schedule", () => {
    expect(buildScheduleChangePlan({
      scheduleId: "schedule-1", profile: PROFILE, actorProfileId: PROFILE.id,
      previousDate: null, nextDate: at(13), updatedAt: at(10), leadName: "Ana",
    })).toBeNull();
    expect(buildScheduleChangePlan({
      scheduleId: "schedule-1", profile: PROFILE, actorProfileId: "operator-1",
      previousDate: at(13), nextDate: at(13), updatedAt: at(10), leadName: "Ana",
    })).toBeNull();
  });
});

describe("planBrokerAgendaEvents", () => {
  it("plans the local 07:00 agenda only when there are active appointments", () => {
    const plans = planBrokerAgendaEvents({
      profile: PROFILE,
      appointments: [appointment()],
      now: at(10),
      appBaseUrl: "https://app.example.test",
    });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      eventType: "agenda.daily_0700",
      idempotencyKey: `agenda.daily_0700:${PROFILE.id}:${DAY}`,
      message: expect.stringContaining("Agenda de hoje"),
    });
    expect(planBrokerAgendaEvents({ profile: PROFILE, appointments: [], now: at(10), appBaseUrl: "https://app.example.test" })).toEqual([]);
  });

  it("does not include prior-day appointments in the 07:00 agenda", () => {
    const plans = planBrokerAgendaEvents({
      profile: { id: "broker-1", supabaseId: "profile-route", timezone: "America/Sao_Paulo" },
      appointments: [appointment({ id: "yesterday", date: new Date("2026-11-22T13:00:00.000Z") })],
      now: new Date("2026-11-23T10:00:00.000Z"),
      appBaseUrl: "https://app.example.test",
    });
    expect(plans.map(({ eventType }) => eventType)).not.toContain("agenda.daily_0700");
  });

  it("plans the one-hour follow-up after persisted duration and excludes completed meetings", () => {
    const plans = planBrokerAgendaEvents({
      profile: PROFILE,
      appointments: [
        appointment({ date: at(13), durationMinutes: 30 }),
        appointment({ id: "done", leadId: "lead-2", date: at(13), meetingHeald: "yes" }),
        appointment({ id: "not-due", leadId: "lead-3", date: at(14) }),
      ],
      now: at(14, 31),
      appBaseUrl: "https://app.example.test",
    });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ eventType: "meeting.follow_up_1h", idempotencyKey: "meeting.follow_up_1h:schedule-1:2026-11-23T13:00:00.000Z" });
    expect(plans[0].message).toContain("https://app.example.test/11111111-1111-4111-8111-111111111111/crm?leadCode=LEAD-1");
  });

  it("plans the local 15:00 overdue digest for today's expired, uncompleted meetings", () => {
    const plans = planBrokerAgendaEvents({
      profile: PROFILE,
      appointments: [
        appointment({ date: at(17, 15) }),
        appointment({ id: "future", leadId: "lead-2", date: at(19) }),
        appointment({ id: "done", leadId: "lead-3", date: at(13), meetingHeald: "yes" }),
        appointment({ id: "other-day", leadId: "lead-4", date: new Date("2026-11-24T12:00:00.000Z") }),
      ],
      now: at(18),
      appBaseUrl: "https://app.example.test",
    });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ eventType: "agenda.overdue_1500", idempotencyKey: `agenda.overdue_1500:${PROFILE.id}:${DAY}` });
    expect(plans[0].message).toContain("Ana");
    expect(plans[0].message).not.toContain("lead-3");
  });
});
