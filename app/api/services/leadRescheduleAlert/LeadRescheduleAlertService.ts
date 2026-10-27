import type { Prisma } from "@prisma/client";
import { leadRescheduleAlertRepository } from "@/app/api/infra/data/repositories/leadRescheduleAlert/LeadRescheduleAlertRepository";
import type { ILeadRescheduleAlertRepository } from "@/app/api/infra/data/repositories/leadRescheduleAlert/ILeadRescheduleAlertRepository";
import { leadRescheduleNotifier, type LeadRescheduleNotifier } from "./LeadRescheduleNotifier";

export type FlagLeadForRescheduleInput = {
  teamId: string;
  leadId: string;
  leadCode: string | null;
  leadName: string;
  reasonCode: string;
  requestedStartsAt?: Date | null;
  requestedCloserId?: string | null;
  conflictingLeadId?: string | null;
  suggestedSlots: Prisma.InputJsonValue;
  sourceEventId?: string | null;
  /** SDR responsável, closer pedido e manager do time. */
  recipientProfileIds: Array<string | null | undefined>;
};

/**
 * SPEC 11 (DA9): lead criado pelo webhook v2 cujo horário não pôde ser agendado fica sinalizado
 * (`needsReschedule`) com os detalhes do alerta, e o time é avisado in-app. Notificar nunca desfaz o
 * alerta: se a notificação falhar, o lead continua sinalizado e visível no CRM.
 */
export class LeadRescheduleAlertService {
  constructor(
    private readonly alerts: ILeadRescheduleAlertRepository = leadRescheduleAlertRepository,
    private readonly notifier: Pick<LeadRescheduleNotifier, "notify"> = leadRescheduleNotifier,
  ) {}

  async flag(input: FlagLeadForRescheduleInput): Promise<{ alertId: string; created: boolean; notified: boolean }> {
    const opened = await this.alerts.open({
      teamId: input.teamId,
      leadId: input.leadId,
      reasonCode: input.reasonCode,
      requestedStartsAt: input.requestedStartsAt,
      requestedCloserId: input.requestedCloserId,
      conflictingLeadId: input.conflictingLeadId,
      suggestedSlots: input.suggestedSlots,
      sourceEventId: input.sourceEventId,
    });

    // Retry do mesmo evento: o alerta já existia e as pessoas já foram avisadas.
    if (!opened.created) return { alertId: opened.id, created: false, notified: false };

    try {
      await this.notifier.notify({
        teamId: input.teamId,
        leadId: input.leadId,
        leadCode: input.leadCode,
        leadName: input.leadName,
        reasonCode: input.reasonCode,
        recipientProfileIds: input.recipientProfileIds,
      });
      return { alertId: opened.id, created: true, notified: true };
    } catch (error) {
      console.error("[LeadRescheduleAlertService] Falha ao notificar o alerta de remarcação:", error);
      return { alertId: opened.id, created: true, notified: false };
    }
  }
}

export const leadRescheduleAlertService = new LeadRescheduleAlertService();
