import { prisma } from "@/app/api/infra/data/prisma";
import type { BethaniaOutboxRepository, BethaniaOutboxItem } from "@/app/api/useCases/bethania-outbox/BethaniaOutboxPorts";
import type { BethaniaTransportEvent } from "@/lib/bethania/signed-sender-client";
import { enqueueBethaniaOutboxInTransaction } from "./EnqueueBethaniaOutboxTransaction";
import { canDispatchBethaniaOutboxItem } from "./BethaniaOutboxEligibility";

export class PrismaBethaniaOutboxRepository implements BethaniaOutboxRepository {
  enqueue(input: Parameters<BethaniaOutboxRepository["enqueue"]>[0]) {
    return prisma.$transaction((tx) => enqueueBethaniaOutboxInTransaction(tx, input));
  }

  async claimDue(limit: number): Promise<{ items: BethaniaOutboxItem[]; suppressed: number }> {
    const safeLimit = Math.max(0, Math.min(100, Math.floor(limit)));
    if (!safeLimit) return { items: [], suppressed: 0 };
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);
      const stale = await tx.bethaniaOutbox.findMany({
        where: { status: "sending", lockedAt: { lt: staleBefore } },
        select: { id: true, profileId: true, eventType: true },
      });
      for (const item of stale) {
        const changed = await tx.bethaniaOutbox.updateMany({
          where: { id: item.id, status: "sending", lockedAt: { lt: staleBefore } },
          data: { status: "failed", phone: null, message: null, lockedAt: null, lastErrorCode: "delivery_outcome_unknown" },
        });
        if (changed.count) {
          await tx.bethaniaDeliveryLog.create({ data: { outboxId: item.id, recipientProfileId: item.profileId, eventType: item.eventType, status: "failed", errorCode: "delivery_outcome_unknown" } });
        }
      }
      const pending = await tx.bethaniaOutbox.findMany({ where: { status: "pending", nextAttemptAt: { lte: now } }, orderBy: { nextAttemptAt: "asc" }, take: safeLimit, select: { id: true, profileId: true, eventType: true, phone: true, message: true } });
      const items: BethaniaOutboxItem[] = [];
      let suppressed = 0;
      for (const item of pending) {
        const [profile, global, event] = await Promise.all([
          tx.profile.findUnique({ where: { id: item.profileId }, select: { whatsappPhone: true, whatsappPhoneVerifiedAt: true } }),
          tx.bethaniaGlobalControl.findUnique({ where: { id: "global" }, select: { paused: true } }),
          tx.bethaniaEventControl.findUnique({ where: { eventType: item.eventType }, select: { paused: true } }),
        ]);
        const eligible = canDispatchBethaniaOutboxItem({
          phone: profile?.whatsappPhone,
          verifiedAt: profile?.whatsappPhoneVerifiedAt,
          outboxPhone: item.phone,
          globalPaused: global?.paused,
          eventPaused: event?.paused,
          eventType: item.eventType,
          message: item.message,
        });
        if (!eligible) {
          const changed = await tx.bethaniaOutbox.updateMany({ where: { id: item.id, status: "pending" }, data: { status: "suppressed", phone: null, message: null, lastErrorCode: "eligibility_blocked" } });
          if (changed.count) {
            await tx.bethaniaDeliveryLog.create({ data: { outboxId: item.id, recipientProfileId: item.profileId, eventType: item.eventType, status: "suppressed", errorCode: "eligibility_blocked" } });
            suppressed += 1;
          }
          continue;
        }
        const claimed = await tx.bethaniaOutbox.updateMany({ where: { id: item.id, status: "pending" }, data: { status: "sending", lockedAt: new Date(), attempts: { increment: 1 } } });
        if (claimed.count) items.push({ id: item.id, eventType: item.eventType as BethaniaTransportEvent["eventType"], phone: item.phone!, message: item.message! });
      }
      return { items, suppressed };
    });
  }

  async recordOutcome(id: string, outcome: { status: "sent" | "failed"; errorCode: string | null; clearPayload: true }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const row = await tx.bethaniaOutbox.update({ where: { id }, data: { status: outcome.status, phone: null, message: null, lockedAt: null, lastErrorCode: outcome.errorCode, deliveredAt: outcome.status === "sent" ? new Date() : null }, select: { profileId: true, eventType: true } });
      await tx.bethaniaDeliveryLog.create({ data: { outboxId: id, recipientProfileId: row.profileId, eventType: row.eventType, status: outcome.status, errorCode: outcome.errorCode } });
    });
  }
}

export const bethaniaOutboxRepository = new PrismaBethaniaOutboxRepository();
