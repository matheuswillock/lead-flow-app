import type { LeadStatus } from "@prisma/client";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";
import type { ILeadStatusTransitionFieldRequirementService } from "./ILeadStatusTransitionFieldRequirementService";
import { backofficeLeadStatusTransitionRuleRepository } from "@/app/api/infra/data/repositories/backofficeLeadStatusTransitionRule/BackofficeLeadStatusTransitionRuleRepository";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";

async function listRequiredFieldsCached(): Promise<
  Array<{ targetStatus: LeadStatus; fieldKey: LeadTransitionFieldKey }>
> {
  "use cache";
  cacheTag(cacheTags.leadStatusTransitionFieldRules());
  cacheLife("minutes");

  return backofficeLeadStatusTransitionRuleRepository.listEnabled();
}

export class LeadStatusTransitionFieldRequirementService
  implements ILeadStatusTransitionFieldRequirementService
{
  async getRequiredFieldsByTargetStatus(targetStatus: LeadStatus): Promise<LeadTransitionFieldKey[]> {
    const rows = await listRequiredFieldsCached();
    return rows
      .filter((row) => row.targetStatus === targetStatus)
      .map((row) => row.fieldKey);
  }
}

export const leadStatusTransitionFieldRequirementService =
  new LeadStatusTransitionFieldRequirementService();
