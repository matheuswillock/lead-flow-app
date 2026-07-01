import { Output } from "@/lib/output";
import { leadStatusLabels } from "@/lib/lead-status";
import type { LeadStatus } from "@prisma/client";
import { leadStatusChangedBatchRepository } from "@/app/api/infra/data/repositories/leadStatusChangedBatch/LeadStatusChangedBatchRepository";
import { studioBotOutboxService } from "@/app/api/services/backofficeBot/StudioBotOutboxService";

const BATCH_MS = 15 * 60 * 1000;

export class LeadStatusChangedBatchUseCase {
  async processBatch(now: Date = new Date()): Promise<Output> {
    try {
      const batchEndMs = Math.floor(now.getTime() / BATCH_MS) * BATCH_MS;
      const batchStartMs = batchEndMs - BATCH_MS;
      const batchBucket = Math.floor(batchStartMs / BATCH_MS);

      const batchStart = new Date(batchStartMs);
      const batchEnd = new Date(batchEndMs);

      const leads = await leadStatusChangedBatchRepository.findLeadsWithStatusChangedBetween(
        batchStart,
        batchEnd,
      );

      let enqueuedCount = 0;

      for (const lead of leads) {
        if (!lead.status || !lead.teamId) continue;

        const statusLabel = leadStatusLabels[lead.status as LeadStatus] ?? lead.status;
        const candidateRecipientIds = [lead.assignedTo, lead.closerId, lead.managerId].filter(
          (profileId): profileId is string => !!profileId,
        );

        const uniqueRecipients = Array.from(new Set(candidateRecipientIds));
        if (uniqueRecipients.length === 0) continue;

        const recipientProfileIds = await leadStatusChangedBatchRepository.findTeamMemberProfileIds(
          lead.teamId,
          uniqueRecipients,
        );

        for (const profileId of recipientProfileIds) {
          await studioBotOutboxService.enqueueLeadStatusChanged({
            profileId,
            leadId: lead.id,
            leadCode: lead.leadCode,
            leadName: lead.name,
            statusLabel,
            batchBucket,
          });
          enqueuedCount += 1;
        }
      }

      return new Output(true, [], [], {
        batchBucket,
        batchStart: batchStart.toISOString(),
        batchEnd: batchEnd.toISOString(),
        enqueuedCount,
        leadsProcessed: leads.length,
      });
    } catch (error) {
      console.error("[LeadStatusChangedBatchUseCase][processBatch] Erro:", error);
      return new Output(false, [], ["Erro ao processar batch de status alterado"], null);
    }
  }
}

export const leadStatusChangedBatchUseCase = new LeadStatusChangedBatchUseCase();
