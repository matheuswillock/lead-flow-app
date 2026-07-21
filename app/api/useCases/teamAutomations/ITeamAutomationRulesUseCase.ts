import type { AutomationRuleInput, AutomationRuleUpdateInput } from "@/lib/team-automation/types";
import { Output } from "@/lib/output";

export interface ITeamAutomationRulesUseCase {
  list(teamId: string): Promise<Output>;
  create(teamId: string, profileId: string, input: AutomationRuleInput): Promise<Output>;
  update(
    teamId: string,
    ruleId: string,
    input: AutomationRuleUpdateInput
  ): Promise<Output>;
  remove(teamId: string, ruleId: string): Promise<Output>;
  toggle(teamId: string, ruleId: string, isEnabled: boolean): Promise<Output>;
  listRuns(teamId: string, ruleId: string, page: number, pageSize: number): Promise<Output>;
}
