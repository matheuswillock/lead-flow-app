import type { LeadStatus } from "@prisma/client";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";
import type { BackofficeLeadStatusTransitionRule } from "../services/IBackofficeLeadStatusTransitionRulesService";

export interface BackofficeLeadStatusTransitionRulesState {
  rules: BackofficeLeadStatusTransitionRule[];
  availableFieldKeys: LeadTransitionFieldKey[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

export interface BackofficeLeadStatusTransitionRulesActions {
  refresh: () => Promise<void>;
  saveForTargetStatus: (targetStatus: LeadStatus, fieldKeys: LeadTransitionFieldKey[]) => Promise<boolean>;
}

export type BackofficeLeadStatusTransitionRulesContextValue =
  BackofficeLeadStatusTransitionRulesState & BackofficeLeadStatusTransitionRulesActions;
