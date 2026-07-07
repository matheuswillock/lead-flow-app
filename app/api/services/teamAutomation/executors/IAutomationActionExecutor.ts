import type { LeadStatus } from "@prisma/client";
import type { TeamAutomationRuleSelect } from "@/app/api/infra/data/repositories/teamAutomation/TeamAutomationRuleRepository";
import type { ActionConfigBase, TriggerConfigBase } from "@/lib/team-automation/types";

export type AutomationLeadContext = {
  id: string;
  teamId: string;
  name: string;
  status: LeadStatus | null;
  leadCode: string | null;
  email: string | null;
  phone: string | null;
  assignedTo: string | null;
};

export type AutomationExecutionContext = {
  rule: TeamAutomationRuleSelect;
  lead: AutomationLeadContext;
  triggerConfig: TriggerConfigBase;
  actionConfig: ActionConfigBase;
};

export type AutomationExecutionResult = {
  status: "success" | "failed" | "skipped";
  errorMessage?: string;
  payload?: Record<string, unknown>;
};

export interface IAutomationActionExecutor {
  readonly actionType: TeamAutomationRuleSelect["actionType"];
  execute(ctx: AutomationExecutionContext): Promise<AutomationExecutionResult>;
}
