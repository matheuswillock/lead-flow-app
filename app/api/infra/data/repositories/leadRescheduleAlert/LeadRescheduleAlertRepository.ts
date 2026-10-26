import { prisma } from "@/app/api/infra/data/prisma";
import type {
  ILeadRescheduleAlertRepository,
  OpenLeadRescheduleAlertInput,
} from "./ILeadRescheduleAlertRepository";

export class LeadRescheduleAlertRepository implements ILeadRescheduleAlertRepository {
  async open(input: OpenLeadRescheduleAlertInput): Promise<{ id: string; created: boolean }> {
    return prisma.$transaction(async (tx) => {
      if (input.sourceEventId) {
        const existing = await tx.leadRescheduleAlert.findFirst({
          where: { leadId: input.leadId, sourceEventId: input.sourceEventId, resolvedAt: null },
          select: { id: true },
        });
        if (existing) return { id: existing.id, created: false };
      }

      const alert = await tx.leadRescheduleAlert.create({
        data: {
          teamId: input.teamId,
          leadId: input.leadId,
          reasonCode: input.reasonCode,
          requestedStartsAt: input.requestedStartsAt ?? null,
          requestedCloserId: input.requestedCloserId ?? null,
          conflictingLeadId: input.conflictingLeadId ?? null,
          suggestedSlots: input.suggestedSlots,
          sourceEventId: input.sourceEventId ?? null,
        },
        select: { id: true },
      });

      await tx.lead.update({ where: { id: input.leadId }, data: { needsReschedule: true } });
      return { id: alert.id, created: true };
    });
  }
}

export const leadRescheduleAlertRepository = new LeadRescheduleAlertRepository();
