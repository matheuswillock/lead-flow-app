import type {
  LeadStatus,
  TeamAutomationActionType,
  TeamAutomationTriggerType,
} from "@prisma/client";

export type TeamAutomationEventType =
  | "lead_created"
  | "status_changed"
  | "lead_idle_in_status"
  | "meeting_scheduled"
  | "meeting_no_show";

export type TeamAutomationEvent = {
  type: TeamAutomationEventType;
  teamId: string;
  leadId: string;
  data?: Record<string, unknown>;
};

export type TriggerConfigBase = {
  targetStatus?: LeadStatus;
  idleValue?: number;
  idleUnit?: "hours" | "days";
};

export type ActionConfigBase = {
  messageTemplate?: string;
  emailSubject?: string;
  emailBodyTemplate?: string;
  notifyProfileIds?: string[];
  assignStrategy?: "specific_operator" | "round_robin";
  operatorProfileId?: string;
};

export type AutomationRuleInput = {
  name: string;
  description?: string | null;
  triggerType: TeamAutomationTriggerType;
  triggerConfig: TriggerConfigBase;
  actionType: TeamAutomationActionType;
  actionConfig: ActionConfigBase;
  isEnabled?: boolean;
};

export type AutomationRuleUpdateInput = Partial<AutomationRuleInput>;

export const DAILY_MESSAGING_ACTION_LIMIT = 50;
export const TEMPLATE_MAX_LENGTH = 1000;
