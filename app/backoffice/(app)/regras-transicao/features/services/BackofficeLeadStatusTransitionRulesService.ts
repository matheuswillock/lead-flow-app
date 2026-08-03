import type { LeadStatus } from "@prisma/client";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";
import type {
  BackofficeLeadStatusTransitionRulesResult,
  IBackofficeLeadStatusTransitionRulesService,
} from "./IBackofficeLeadStatusTransitionRulesService";
import type { Output } from "@/lib/output";
import { API_CLIENT_BASE } from "@/lib/route-map";

export class BackofficeLeadStatusTransitionRulesService
  implements IBackofficeLeadStatusTransitionRulesService
{
  async list(): Promise<BackofficeLeadStatusTransitionRulesResult> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/lead-status-transition-rules`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar regras de transição");
    }
    return data.result as BackofficeLeadStatusTransitionRulesResult;
  }

  async saveForTargetStatus(
    targetStatus: LeadStatus,
    fieldKeys: LeadTransitionFieldKey[]
  ): Promise<Output> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/lead-status-transition-rules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatus, fieldKeys }),
    });
    return response.json();
  }
}

export const backofficeLeadStatusTransitionRulesService =
  new BackofficeLeadStatusTransitionRulesService();
