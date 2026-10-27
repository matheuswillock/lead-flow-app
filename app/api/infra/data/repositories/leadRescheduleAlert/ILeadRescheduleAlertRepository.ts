import type { Prisma } from "@prisma/client";

export type OpenLeadRescheduleAlertInput = {
  teamId: string;
  leadId: string;
  /** `schedule_conflict`, `closer_not_in_team`, `online_without_email`, `closer_without_google`, ... */
  reasonCode: string;
  requestedStartsAt?: Date | null;
  requestedCloserId?: string | null;
  conflictingLeadId?: string | null;
  /** Até 5 próximos horários livres do closer pedido: `[{ startsAt, endsAt }]` em ISO com offset. */
  suggestedSlots: Prisma.InputJsonValue;
  /** `TeamWebhookInboundEvent.id` de origem. */
  sourceEventId?: string | null;
};

export interface ILeadRescheduleAlertRepository {
  /**
   * Abre o alerta e sinaliza o lead (`needsReschedule = true`) na mesma transação. Idempotente por
   * evento: se já existe alerta aberto do mesmo `sourceEventId` para o lead, devolve o existente.
   */
  open(input: OpenLeadRescheduleAlertInput): Promise<{ id: string; created: boolean }>;
}
