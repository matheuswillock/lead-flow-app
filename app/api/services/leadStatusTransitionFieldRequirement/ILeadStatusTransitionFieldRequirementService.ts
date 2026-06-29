import type { LeadStatus } from "@prisma/client";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";

export interface ILeadStatusTransitionFieldRequirementService {
  getRequiredFieldsByTargetStatus(targetStatus: LeadStatus): Promise<LeadTransitionFieldKey[]>;
}
