import type { TeamAutomationRuleSelect } from "@/app/api/infra/data/repositories/teamAutomation/TeamAutomationRuleRepository";
import type { AutomationRuleInput, AutomationRuleUpdateInput } from "@/lib/team-automation/types";

export interface ITeamAutomationRuleService {
  listByTeam(teamId: string): Promise<TeamAutomationRuleSelect[]>;
  findById(teamId: string, ruleId: string): Promise<TeamAutomationRuleSelect | null>;
  create(teamId: string, createdBy: string, input: AutomationRuleInput): Promise<TeamAutomationRuleSelect>;
  update(
    teamId: string,
    ruleId: string,
    input: AutomationRuleUpdateInput
  ): Promise<TeamAutomationRuleSelect | null>;
  remove(teamId: string, ruleId: string): Promise<boolean>;
  toggle(teamId: string, ruleId: string, isEnabled: boolean): Promise<TeamAutomationRuleSelect | null>;
  listRuns(
    teamId: string,
    ruleId: string,
    page: number,
    pageSize: number
  ): Promise<{ items: Awaited<ReturnType<import("@/app/api/infra/data/repositories/teamAutomation/TeamAutomationRuleRepository").ITeamAutomationRuleRepository["listRuns"]>>["items"]; total: number }>;
  validateNotifyProfileIds(teamId: string, profileIds: string[]): Promise<boolean>;
}
