import type { BackofficeLeadStatus } from "@prisma/client";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";
import type { Output } from "@/lib/output";
import type {
  BackofficeCrmTransitionRulesResult,
} from "../context/BackofficeCrmTransitionRulesTypes";
import type { IBackofficeCrmTransitionRulesService } from "./IBackofficeCrmTransitionRulesService";

export class BackofficeCrmTransitionRulesService implements IBackofficeCrmTransitionRulesService {
  async list(): Promise<BackofficeCrmTransitionRulesResult> {
    const response = await fetch("/api/v1/backoffice/crm-lead-status-transition-rules", {
      cache: "no-store",
    });
    const data = await response.json();
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar regras de transição");
    }
    return data.result as BackofficeCrmTransitionRulesResult;
  }

  async saveForTargetStatus(
    targetStatus: BackofficeLeadStatus,
    fieldKeys: LeadTransitionFieldKey[]
  ): Promise<Output> {
    const response = await fetch("/api/v1/backoffice/crm-lead-status-transition-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatus, fieldKeys }),
    });
    return response.json();
  }
}

export const backofficeCrmTransitionRulesService = new BackofficeCrmTransitionRulesService();
