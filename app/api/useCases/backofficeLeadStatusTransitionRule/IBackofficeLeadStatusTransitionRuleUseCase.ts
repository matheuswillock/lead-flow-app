import type { LeadStatus } from "@prisma/client";
import { Output } from "@/lib/output";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";

export interface BackofficeLeadStatusTransitionRuleInput {
  targetStatus: LeadStatus;
  fieldKeys: LeadTransitionFieldKey[];
}

export interface IBackofficeLeadStatusTransitionRuleUseCase {
  list(): Promise<Output>;
  replaceAll(rules: BackofficeLeadStatusTransitionRuleInput[], updatedByProfileId: string): Promise<Output>;
  replaceForTargetStatus(
    targetStatus: LeadStatus,
    fieldKeys: LeadTransitionFieldKey[],
    updatedByProfileId: string
  ): Promise<Output>;
}
