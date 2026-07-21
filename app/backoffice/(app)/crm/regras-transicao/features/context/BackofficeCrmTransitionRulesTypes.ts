import type { BackofficeLeadStatus } from "@prisma/client";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";
import type { Output } from "@/lib/output";

export type BackofficeCrmTransitionRuleGroup = {
  targetStatus: BackofficeLeadStatus;
  fieldKeys: LeadTransitionFieldKey[];
};

export type BackofficeCrmTransitionRulesResult = {
  rules: BackofficeCrmTransitionRuleGroup[];
  availableFieldKeys: LeadTransitionFieldKey[];
};

export type BackofficeCrmTransitionRulesContextValue = {
  rules: BackofficeCrmTransitionRuleGroup[];
  availableFieldKeys: LeadTransitionFieldKey[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveForTargetStatus: (
    targetStatus: BackofficeLeadStatus,
    fieldKeys: LeadTransitionFieldKey[]
  ) => Promise<Output>;
};
