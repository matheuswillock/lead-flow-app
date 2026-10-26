import { prisma } from "@/app/api/infra/data/prisma";
import { invalidateNotificationsCache } from "@/lib/cache/invalidation";

/** Motivo do alerta em linguagem clara, para a mensagem da notificação. */
export const RESCHEDULE_REASON_LABELS: Record<string, string> = {
  schedule_conflict: "o closer já tem reunião nesse horário",
  closer_not_in_team: "o closer informado não pertence ao time",
  online_without_email: "a reunião online exige o e-mail do lead",
  closer_without_google: "o closer não tem Google conectado e o webhook não tem link de Meet padrão",
  schedule_failed: "não foi possível criar a reunião",
  schedule_in_past: "o horário pedido já passou ou está muito próximo",
  schedule_out_of_range: "o horário pedido está além do limite de 180 dias",
};

export type LeadRescheduleNotificationInput = {
  teamId: string;
  leadId: string;
  leadCode: string | null;
  leadName: string;
  reasonCode: string;
  recipientProfileIds: Array<string | null | undefined>;
};

export type LeadRescheduleNotificationRow = {
  recipientProfileId: string;
  teamId: string;
  type: "LEAD_NEEDS_RESCHEDULE";
  message: string;
  metadata: Record<string, string | null>;
};

export interface ILeadRescheduleNotificationStore {
  createMany(rows: LeadRescheduleNotificationRow[]): Promise<{ count: number }>;
}

const prismaStore: ILeadRescheduleNotificationStore = {
  createMany: (rows) =>
    prisma.notification.createMany({
      data: rows.map((row) => ({ ...row })),
      skipDuplicates: false,
    }),
};

export class LeadRescheduleNotifier {
  constructor(
    private readonly store: ILeadRescheduleNotificationStore = prismaStore,
    private readonly invalidate: (input: { recipientProfileIds: string[] }) => void = invalidateNotificationsCache,
  ) {}

  /** Avisa SDR responsável, closer pedido e manager (sem repetir pessoa) que o lead precisa de remarcação. */
  async notify(input: LeadRescheduleNotificationInput): Promise<{ createdCount: number }> {
    const recipients = Array.from(
      new Set(input.recipientProfileIds.filter((id): id is string => typeof id === "string" && id.length > 0)),
    );
    if (recipients.length === 0) return { createdCount: 0 };

    const reason = RESCHEDULE_REASON_LABELS[input.reasonCode] ?? "o horário pedido não pôde ser agendado";
    const message = `O lead ${input.leadName} chegou pelo webhook e precisa ser remarcado: ${reason}.`;

    const result = await this.store.createMany(
      recipients.map((recipientProfileId) => ({
        recipientProfileId,
        teamId: input.teamId,
        type: "LEAD_NEEDS_RESCHEDULE" as const,
        message,
        metadata: {
          leadId: input.leadId,
          leadCode: input.leadCode,
          leadName: input.leadName,
          reasonCode: input.reasonCode,
        },
      })),
    );

    this.invalidate({ recipientProfileIds: recipients });
    return { createdCount: result.count };
  }
}

export const leadRescheduleNotifier = new LeadRescheduleNotifier();
