import { sendBethaniaTransportEvent } from "@/lib/bethania/signed-sender-client";
import type { BethaniaTransportEvent } from "@/lib/bethania/signed-sender-client";
import type { BethaniaOutboxRepository, BethaniaOutboxSender } from "@/app/api/useCases/bethania-outbox/BethaniaOutboxPorts";
export type { BethaniaOutboxItem, BethaniaOutboxRepository, BethaniaOutboxSender } from "@/app/api/useCases/bethania-outbox/BethaniaOutboxPorts";
import { bethaniaOutboxRepository } from "@/app/api/infra/data/repositories/bethania-outbox/BethaniaOutboxRepository";



export class BethaniaOutboxService {
  constructor(private readonly repository: BethaniaOutboxRepository, private readonly sender: BethaniaOutboxSender) {}

  enqueue(input: Parameters<BethaniaOutboxRepository["enqueue"]>[0]) {
    return this.repository.enqueue(input);
  }

  async dispatchDue(limit: number): Promise<{ accepted: number; failed: number; suppressed: number }> {
    const claim = await this.repository.claimDue(limit);
    let accepted = 0;
    let failed = 0;
    for (const item of claim.items) {
      try {
        await this.sender({ eventId: item.id, eventType: item.eventType, phone: item.phone, message: item.message });
        await this.repository.recordOutcome(item.id, { status: "sent", errorCode: null, clearPayload: true });
        accepted += 1;
      } catch {
        // A timeout or transport error may follow remote acceptance; never retry automatically.
        await this.repository.recordOutcome(item.id, { status: "failed", errorCode: "transport_outcome_unknown", clearPayload: true });
        failed += 1;
      }
    }
    return { accepted, failed, suppressed: claim.suppressed };
  }
}

export function createBethaniaOutboxService(senderOptions: { baseUrl: string; secret: string }) {
  return new BethaniaOutboxService(bethaniaOutboxRepository, (event) =>
    sendBethaniaTransportEvent(event, senderOptions),
  );
}
