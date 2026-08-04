import type { BackofficeLeadStatus } from "@prisma/client";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";
import type { Output } from "@/lib/output";
import type {
  BackofficeCrmTransitionRulesResult,
} from "../context/BackofficeCrmTransitionRulesTypes";
import type { IBackofficeCrmTransitionRulesService } from "./IBackofficeCrmTransitionRulesService";
import { API_CLIENT_BASE } from "@/lib/route-map";

export class BackofficeCrmTransitionRulesService implements IBackofficeCrmTransitionRulesService {
  async list(): Promise<BackofficeCrmTransitionRulesResult> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/crm-lead-status-transition-rules`, {
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
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/crm-lead-status-transition-rules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatus, fieldKeys }),
    });
    return response.json();
  }
}

export const backofficeCrmTransitionRulesService = new BackofficeCrmTransitionRulesService();
