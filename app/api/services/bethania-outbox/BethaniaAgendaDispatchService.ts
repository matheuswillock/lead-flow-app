import { addDaysInTz, endOfDayInTz, resolveTimezone, startOfDayInTz } from "@/lib/dates";
import { planBrokerAgendaEvents, type BethaniaAgendaPlan, type BethaniaAgendaProfile } from "@/lib/bethania/agenda-planner";
import type { AgendaWindow, BethaniaAgendaRepository, BethaniaOutboxEnqueueInput } from "@/app/api/useCases/bethania-outbox/BethaniaOutboxPorts";
export type { AgendaWindow, BethaniaAgendaRepository } from "@/app/api/useCases/bethania-outbox/BethaniaOutboxPorts";


export class BethaniaAgendaDispatchService {
  constructor(
    private readonly repository: BethaniaAgendaRepository,
    private readonly appBaseUrl: string,
  ) {}

  async scheduleDueEvents(now: Date): Promise<{ profiles: number; planned: number; enqueued: number }> {
    if (!Number.isFinite(now.getTime())) throw new TypeError("now must be a valid date");
    const profiles = await this.repository.findVerifiedProfiles();
    let planned = 0;
    let enqueued = 0;

    for (const profile of profiles) {
      const timezone = resolveTimezone(profile.timezone || "America/Sao_Paulo");
      const todayStart = startOfDayInTz(now, timezone);
      const window = {
        from: addDaysInTz(todayStart, -7, timezone),
        to: endOfDayInTz(now, timezone),
      };
      const appointments = await this.repository.findAppointments(profile.id, window);
      const plans = planBrokerAgendaEvents({
        profile: { ...profile, timezone },
        appointments,
        now,
        appBaseUrl: this.appBaseUrl,
      });
      planned += plans.length;
      for (const plan of plans) {
        await this.repository.enqueue(toOutboxInput(plan));
        enqueued += 1;
      }
    }
    return { profiles: profiles.length, planned, enqueued };
  }
}

function toOutboxInput(plan: BethaniaAgendaPlan): BethaniaOutboxEnqueueInput {
  return {
    idempotencyKey: plan.idempotencyKey,
    profileId: plan.profileId,
    eventType: plan.eventType,
    message: plan.message,
  };
}
