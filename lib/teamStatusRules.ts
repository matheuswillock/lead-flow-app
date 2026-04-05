import type { LeadStatus, TeamLeadTimeUnit } from "@prisma/client";

export type TeamStatusLeadTimeRule = {
  status: LeadStatus;
  leadTimeValue: number;
  leadTimeUnit: TeamLeadTimeUnit;
};

export type TeamStatusCombinedRule = {
  id: string;
  targetStatus: LeadStatus;
  requiredStatus: LeadStatus;
  requireConfirmation: boolean;
  confirmationMessage: string | null;
  isEnabled: boolean;
};

export type TeamStatusRulesResponse = {
  disabledStatuses: LeadStatus[];
  leadTimeRules: TeamStatusLeadTimeRule[];
  combinedRules: TeamStatusCombinedRule[];
};

export const EMPTY_TEAM_STATUS_RULES: TeamStatusRulesResponse = {
  disabledStatuses: [],
  leadTimeRules: [],
  combinedRules: [],
};

const leadTimeUnitToMilliseconds = (value: number, unit: TeamLeadTimeUnit) => {
  if (unit === "days") {
    return value * 24 * 60 * 60 * 1000;
  }
  return value * 60 * 60 * 1000;
};

export const resolveLeadTimeState = (
  status: LeadStatus,
  statusEnteredAt: string | null | undefined,
  leadTimeRules: TeamStatusLeadTimeRule[],
  now = new Date()
) => {
  const rule = leadTimeRules.find((item) => item.status === status && item.leadTimeValue > 0);
  if (!rule) {
    return { isBreached: false, dueAt: null as string | null };
  }
  if (!statusEnteredAt) {
    return { isBreached: false, dueAt: null as string | null };
  }

  const enteredAt = new Date(statusEnteredAt);
  if (Number.isNaN(enteredAt.getTime())) {
    return { isBreached: false, dueAt: null as string | null };
  }

  const dueAt = new Date(
    enteredAt.getTime() + leadTimeUnitToMilliseconds(rule.leadTimeValue, rule.leadTimeUnit)
  );

  return {
    isBreached: now.getTime() >= dueAt.getTime(),
    dueAt: dueAt.toISOString(),
  };
};

