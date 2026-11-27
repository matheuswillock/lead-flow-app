import type { BethaniaTransportEvent, BethaniaTransportEventType } from "@/lib/bethania/signed-sender-client";
import type { BethaniaAgendaPlan, BethaniaAgendaProfile, BethaniaAppointment } from "@/lib/bethania/agenda-planner";

export type BethaniaOutboxItem = Pick<BethaniaTransportEvent, "eventType" | "phone" | "message"> & { id: string };
export type BethaniaOutboxRepository = {
  enqueue(input: { idempotencyKey: string; profileId: string; eventType: BethaniaTransportEvent["eventType"]; message: string }): Promise<{ id: string; status: "pending" | "suppressed" | "sending" | "sent" | "failed" }>;
  claimDue(limit: number): Promise<{ items: BethaniaOutboxItem[]; suppressed: number }>;
  recordOutcome(id: string, outcome: { status: "sent" | "failed"; errorCode: string | null; clearPayload: true }): Promise<void>;
};
export type BethaniaOutboxSender = (event: BethaniaTransportEvent) => Promise<{ accepted: true }>;
export type AgendaWindow = { from: Date; to: Date };
export type BethaniaAgendaRepository = {
  findVerifiedProfiles(): Promise<BethaniaAgendaProfile[]>;
  findAppointments(profileId: string, window: AgendaWindow): Promise<BethaniaAppointment[]>;
  enqueue(input: BethaniaOutboxEnqueueInput): Promise<{ id: string; status: "pending" | "suppressed" | "sending" | "sent" | "failed" }>;
};
export type BethaniaOutboxEnqueueInput = {
  idempotencyKey: string;
  profileId: string;
  eventType: BethaniaTransportEventType;
  message: string;
  suppressedReason?: string;
};
