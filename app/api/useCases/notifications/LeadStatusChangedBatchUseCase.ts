import { Output } from "@/lib/output";
import { leadStatusLabels } from "@/lib/lead-status";
import type { LeadStatus } from "@prisma/client";
import {
  leadStatusChangedBatchRepository,
  type LeadStatusChangedBatchCursor,
} from "@/app/api/infra/data/repositories/leadStatusChangedBatch/LeadStatusChangedBatchRepository";
import { studioBotOutboxService } from "@/app/api/services/backofficeBot/StudioBotOutboxService";

const BATCH_MS = 15 * 60 * 1000;
const PAGE_SIZE = 200;
const DEADLINE_MS = 45_000;

export class LeadStatusChangedBatchUseCase {
  async processBatch(now: Date = new Date()): Promise<Output> {
    try {
      const batchEndMs = Math.floor(now.getTime() / BATCH_MS) * BATCH_MS;
      const batchStartMs = batchEndMs - BATCH_MS;
      const batchBucket = Math.floor(batchStartMs / BATCH_MS);

      const batchStart = new Date(batchStartMs);
      const batchEnd = new Date(batchEndMs);
      const startedAt = Date.now();

      let enqueuedCount = 0;
      let leadsProcessed = 0;
      let truncated = false;
      let cursor: LeadStatusChangedBatchCursor | undefined;

      for (;;) {
        const page = await leadStatusChangedBatchRepository.findLeadsWithStatusChangedBetween(
          batchStart,
          batchEnd,
          { take: PAGE_SIZE, cursor },
        );

        if (page.length === 0) break;

        for (const lead of page) {
          enqueuedCount += await this.enqueueLeadStatusChanged(lead, batchBucket);
        }

        leadsProcessed += page.length;
        const last = page[page.length - 1];
        if (!last.statusEnteredAt) break;
        cursor = { id: last.id, statusEnteredAt: last.statusEnteredAt };

        if (page.length < PAGE_SIZE) break;
        if (Date.now() - startedAt >= DEADLINE_MS) {
          truncated = true;
          break;
        }
      }

      return new Output(true, [], [], {
        batchBucket,
        batchStart: batchStart.toISOString(),
        batchEnd: batchEnd.toISOString(),
        enqueuedCount,
        leadsProcessed,
        truncated,
      });
    } catch (error) {
      console.error("[LeadStatusChangedBatchUseCase][processBatch] Erro:", error);
      return new Output(false, [], ["Erro ao processar batch de status alterado"], null);
    }
  }

  private async enqueueLeadStatusChanged(
    lead: {
      id: string;
      leadCode: string | null;
      name: string | null;
      status: LeadStatus | null;
      teamId: string | null;
      assignedTo: string | null;
      closerId: string | null;
      managerId: string | null;
    },
    batchBucket: number,
  ): Promise<number> {
    if (!lead.status || !lead.teamId) return 0;

    const statusLabel = leadStatusLabels[lead.status] ?? lead.status;
    const candidateRecipientIds = [lead.assignedTo, lead.closerId, lead.managerId].filter(
      (profileId): profileId is string => !!profileId,
    );

    const uniqueRecipients = Array.from(new Set(candidateRecipientIds));
    if (uniqueRecipients.length === 0) return 0;

    const recipientProfileIds = await leadStatusChangedBatchRepository.findTeamMemberProfileIds(
      lead.teamId,
      uniqueRecipients,
    );

    let enqueued = 0;
    for (const profileId of recipientProfileIds) {
      await studioBotOutboxService.enqueueLeadStatusChanged({
        profileId,
        leadId: lead.id,
        leadCode: lead.leadCode,
        leadName: lead.name ?? "",
        statusLabel,
        batchBucket,
      });
      enqueued += 1;
    }
    return enqueued;
  }
}

export const leadStatusChangedBatchUseCase = new LeadStatusChangedBatchUseCase();
