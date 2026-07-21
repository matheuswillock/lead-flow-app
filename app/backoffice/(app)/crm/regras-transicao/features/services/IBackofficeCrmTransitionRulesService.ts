import type { BackofficeLeadStatus } from "@prisma/client";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";
import type {
  BackofficeCrmTransitionRulesContextValue,
  BackofficeCrmTransitionRulesResult,
} from "../context/BackofficeCrmTransitionRulesTypes";
import type { Output } from "@/lib/output";

export interface IBackofficeCrmTransitionRulesService {
  list(): Promise<BackofficeCrmTransitionRulesResult>;
  saveForTargetStatus(
    targetStatus: BackofficeLeadStatus,
    fieldKeys: LeadTransitionFieldKey[]
  ): Promise<Output>;
}

export type UseBackofficeCrmTransitionRulesParams = {
  service: IBackofficeCrmTransitionRulesService;
};

export type { BackofficeCrmTransitionRulesContextValue };
