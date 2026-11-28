import type { BethaniaOutboxStatus, Prisma } from "@prisma/client";
import type { BethaniaOutboxEnqueueInput } from "@/app/api/useCases/bethania-outbox/BethaniaOutboxPorts";
export type { BethaniaOutboxEnqueueInput } from "@/app/api/useCases/bethania-outbox/BethaniaOutboxPorts";

export async function enqueueBethaniaOutboxInTransaction(
  tx: Prisma.TransactionClient,
  input: BethaniaOutboxEnqueueInput,
): Promise<{ id: string; status: BethaniaOutboxStatus }> {
  const existing = await tx.bethaniaOutbox.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, status: true },
  });
  if (existing) return existing;

  const [profile, globalControl, eventControl] = await Promise.all([
    tx.profile.findUnique({
      where: { id: input.profileId },
      select: { whatsappPhone: true, whatsappPhoneVerifiedAt: true },
    }),
    tx.bethaniaGlobalControl.findUnique({ where: { id: "global" }, select: { paused: true } }),
    tx.bethaniaEventControl.findUnique({ where: { eventType: input.eventType }, select: { paused: true } }),
  ]);
  const blockedBy = input.suppressedReason
    ?? (!profile?.whatsappPhone || !profile.whatsappPhoneVerifiedAt ? "whatsapp_unverified" : null)
    ?? (globalControl?.paused ? "global_pause" : null)
    ?? (eventControl?.paused ? "event_pause" : null);
  const status: BethaniaOutboxStatus = blockedBy ? "suppressed" : "pending";
  const created = await tx.bethaniaOutbox.createMany({
    data: [{
      idempotencyKey: input.idempotencyKey,
      profileId: input.profileId,
      eventType: input.eventType,
      phone: blockedBy ? null : profile!.whatsappPhone,
      message: blockedBy ? null : input.message,
      status,
      lastErrorCode: blockedBy,
    }],
    skipDuplicates: true,
  });
  const row = await tx.bethaniaOutbox.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, status: true },
  });
  if (!row) throw new Error("Bethânia outbox row was not persisted");

  if (created.count > 0) {
    await tx.bethaniaDeliveryLog.create({
      data: {
        outboxId: row.id,
        recipientProfileId: input.profileId,
        eventType: input.eventType,
        status,
        errorCode: blockedBy,
      },
    });
  }
  return row;
}
