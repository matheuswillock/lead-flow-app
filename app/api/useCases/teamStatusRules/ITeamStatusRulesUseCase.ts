import { LeadStatus, TeamLeadTimeUnit } from "@prisma/client";
import { Output } from "@/lib/output";

export type TeamStatusRuleSet = {
  disabledStatuses: LeadStatus[];
  leadTimeRules: Array<{
    status: LeadStatus;
    leadTimeValue: number;
    leadTimeUnit: TeamLeadTimeUnit;
  }>;
  combinedRules: Array<{
    id?: string;
    targetStatus: LeadStatus;
    requiredStatus: LeadStatus;
    requireConfirmation: boolean;
    confirmationMessage: string | null;
    isEnabled: boolean;
  }>;
};

export interface ITeamStatusRulesUseCase {
  getRules(teamId: string): Promise<Output>;
  replaceRules(teamId: string, createdBy: string, input: TeamStatusRuleSet): Promise<Output>;
}
