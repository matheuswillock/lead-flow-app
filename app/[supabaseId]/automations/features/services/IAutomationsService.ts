import type { AutomationRule, AutomationRuleFormInput, AutomationRunsPage } from "../context/AutomationsTypes";

export interface IAutomationsService {
  listRules(supabaseId: string, teamId: string): Promise<AutomationRule[]>;
  createRule(supabaseId: string, teamId: string, input: AutomationRuleFormInput): Promise<AutomationRule>;
  updateRule(
    supabaseId: string,
    teamId: string,
    ruleId: string,
    input: Partial<AutomationRuleFormInput>
  ): Promise<AutomationRule>;
  deleteRule(supabaseId: string, teamId: string, ruleId: string): Promise<void>;
  toggleRule(supabaseId: string, teamId: string, ruleId: string, isEnabled: boolean): Promise<AutomationRule>;
  listRuns(
    supabaseId: string,
    teamId: string,
    ruleId: string,
    page?: number
  ): Promise<AutomationRunsPage>;
}
