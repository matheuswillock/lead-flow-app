import {
  LeadStatus,
  TeamLeadTimeUnit,
  TeamStatusRule,
} from "@prisma/client";

export type TeamStatusLeadTimeRuleInput = {
  status: LeadStatus;
  leadTimeValue: number;
  leadTimeUnit: TeamLeadTimeUnit;
};

export type TeamStatusCombinedRuleInput = {
  targetStatus: LeadStatus;
  requiredStatus: LeadStatus;
  requireConfirmation?: boolean;
  confirmationMessage?: string | null;
  isEnabled?: boolean;
};

export type ReplaceTeamStatusRulesInput = {
  disabledStatuses: LeadStatus[];
  leadTimeRules: TeamStatusLeadTimeRuleInput[];
  combinedRules: TeamStatusCombinedRuleInput[];
};

export interface ITeamStatusRuleService {
  listByTeam(teamId: string): Promise<TeamStatusRule[]>;
  replaceByTeam(teamId: string, createdBy: string, input: ReplaceTeamStatusRulesInput): Promise<TeamStatusRule[]>;
  findActiveByTargetStatus(teamId: string, targetStatus: LeadStatus): Promise<TeamStatusRule[]>;
}

