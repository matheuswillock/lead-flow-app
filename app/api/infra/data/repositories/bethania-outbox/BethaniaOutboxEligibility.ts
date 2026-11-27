import type { BethaniaTransportEventType } from "@/lib/bethania/signed-sender-client";

const EVENT_TYPES: ReadonlySet<string> = new Set([
  "schedule.created_or_rescheduled",
  "agenda.daily_0700",
  "meeting.follow_up_1h",
  "agenda.overdue_1500",
  "account.whatsapp_verification",
]);

export function canDispatchBethaniaOutboxItem(input: {
  phone: string | null | undefined;
  verifiedAt: Date | null | undefined;
  outboxPhone: string | null | undefined;
  globalPaused: boolean | null | undefined;
  eventPaused: boolean | null | undefined;
  eventType: string;
  message: string | null | undefined;
}): input is typeof input & { phone: string; outboxPhone: string; message: string; eventType: BethaniaTransportEventType } {
  return Boolean(
    input.phone
    && input.verifiedAt
    && input.phone === input.outboxPhone
    && input.globalPaused !== true
    && input.eventPaused !== true
    && EVENT_TYPES.has(input.eventType)
    && input.message?.trim(),
  );
}
