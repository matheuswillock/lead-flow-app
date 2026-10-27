import { prisma } from "@/app/api/infra/data/prisma";

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

/** Persistência das notificações in-app do alerta de remarcação (SPEC 11, DA9). */
export class LeadRescheduleNotificationRepository implements ILeadRescheduleNotificationStore {
  async createMany(rows: LeadRescheduleNotificationRow[]): Promise<{ count: number }> {
    if (rows.length === 0) return { count: 0 };
    return prisma.notification.createMany({
      data: rows.map((row) => ({ ...row })),
      skipDuplicates: false,
    });
  }
}

export const leadRescheduleNotificationRepository = new LeadRescheduleNotificationRepository();
