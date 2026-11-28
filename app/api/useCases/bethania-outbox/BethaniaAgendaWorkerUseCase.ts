import { Output } from "@/lib/output";
import type { BethaniaAgendaDispatchService } from "@/app/api/services/bethania-outbox/BethaniaAgendaDispatchService";
import type { BethaniaOutboxService } from "@/app/api/services/bethania-outbox/BethaniaOutboxService";

export type BethaniaAgendaWorkerResult = {
  scheduled: { profiles: number; planned: number; enqueued: number };
  delivery: { accepted: number; failed: number; suppressed: number };
  senderConfigured: boolean;
};

export class BethaniaAgendaWorkerUseCase {
  constructor(
    private readonly agenda: BethaniaAgendaDispatchService,
    private readonly outbox: BethaniaOutboxService,
    private readonly senderConfigured: boolean,
  ) {}

  async run(now: Date): Promise<Output> {
    const scheduled = await this.agenda.scheduleDueEvents(now);
    const delivery = this.senderConfigured
      ? await this.outbox.dispatchDue(50)
      : { accepted: 0, failed: 0, suppressed: 0 };
    const result: BethaniaAgendaWorkerResult = { scheduled, delivery, senderConfigured: this.senderConfigured };
    return new Output(true, ["Bethania agenda worker completed"], [], result);
  }
}
