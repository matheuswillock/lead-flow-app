import { describe, expect, it, mock } from "bun:test";
import { BethaniaAgendaDispatchService, type BethaniaAgendaRepository } from "./BethaniaAgendaDispatchService";

const PROFILE = { id: "broker-1", supabaseId: "11111111-1111-4111-8111-111111111111", timezone: "America/Sao_Paulo" };
const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 10, 23, hour, minute));
const schedule = {
  id: "schedule-1",
  leadId: "lead-1",
  leadCode: "LEAD-1",
  leadName: "Ana",
  date: at(13),
  durationMinutes: 30,
  meetingHeald: null as "yes" | "no" | null,
  status: "scheduled",
};
function setup(appointments = [schedule]) {
  const enqueued: unknown[] = [];
  const repository: BethaniaAgendaRepository = {
    findVerifiedProfiles: mock(async () => [PROFILE]),
    findAppointments: mock(async () => appointments),
    enqueue: mock(async (input) => { enqueued.push(input); return { id: `outbox-${enqueued.length}`, status: "pending" as const }; }),
  };
  return { service: new BethaniaAgendaDispatchService(repository, "http://localhost:3000"), repository, enqueued };
}

describe("BethaniaAgendaDispatchService", () => {
  it("selects and enqueues the local 07:00 agenda", async () => {
    const { service, repository, enqueued } = setup();
    const result = await service.scheduleDueEvents(at(10));
    expect(result.enqueued).toBe(1);
    expect(repository.findAppointments).toHaveBeenCalledTimes(1);
    expect(enqueued).toMatchObject([{ profileId: PROFILE.id, eventType: "agenda.daily_0700" }]);
  });

  it("selects the one-hour follow-up on frequent worker runs outside agenda times", async () => {
    const { service, enqueued } = setup();
    const result = await service.scheduleDueEvents(at(14, 31));
    expect(result.enqueued).toBe(1);
    expect(enqueued).toMatchObject([{ eventType: "meeting.follow_up_1h" }]);
  });

  it("selects the 15:00 overdue digest using the broker's local date", async () => {
    const { service, enqueued } = setup([{ ...schedule, date: at(17, 15) }]);
    const result = await service.scheduleDueEvents(at(18));
    expect(result.enqueued).toBe(1);
    expect(enqueued).toMatchObject([{ eventType: "agenda.overdue_1500" }]);
  });
});
