import type { LeadStatus } from "@prisma/client";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";
import type { Output } from "@/lib/output";

export type BackofficeLeadStatusTransitionRule = {
  targetStatus: LeadStatus;
  fieldKeys: LeadTransitionFieldKey[];
};

export type BackofficeLeadStatusTransitionRulesResult = {
  rules: BackofficeLeadStatusTransitionRule[];
  availableFieldKeys: LeadTransitionFieldKey[];
};

export interface IBackofficeLeadStatusTransitionRulesService {
  list(): Promise<BackofficeLeadStatusTransitionRulesResult>;
  saveForTargetStatus(
    targetStatus: LeadStatus,
    fieldKeys: LeadTransitionFieldKey[]
  ): Promise<Output>;
}
