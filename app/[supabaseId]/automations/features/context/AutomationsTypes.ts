import type {
  TeamAutomationActionType,
  TeamAutomationRunStatus,
  TeamAutomationTriggerType,
} from "@prisma/client";

export type AutomationRule = {
  id: string;
  teamId: string;
  createdBy: string;
  name: string;
  description: string | null;
  triggerType: TeamAutomationTriggerType;
  triggerConfig: Record<string, unknown>;
  actionType: TeamAutomationActionType;
  actionConfig: Record<string, unknown>;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRunLog = {
  id: string;
  ruleId: string;
  teamId: string;
  leadId: string | null;
  dedupeKey: string;
  status: TeamAutomationRunStatus;
  errorMessage: string | null;
  payload: Record<string, unknown> | null;
  executedAt: string;
};

export type AutomationRuleFormInput = {
  name: string;
  description?: string | null;
  triggerType: TeamAutomationTriggerType;
  triggerConfig: Record<string, unknown>;
  actionType: TeamAutomationActionType;
  actionConfig: Record<string, unknown>;
  isEnabled?: boolean;
};

export type AutomationRunsPage = {
  items: AutomationRunLog[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
