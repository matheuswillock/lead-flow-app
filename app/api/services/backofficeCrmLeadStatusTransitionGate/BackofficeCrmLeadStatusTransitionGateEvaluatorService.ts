import type { BackofficeLeadStatus } from "@prisma/client";
import { backofficeCrmLeadStatusTransitionGateRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCrmLeadStatusTransitionGate/BackofficeCrmLeadStatusTransitionGateRepository";
import {
  crmGateMatchesTransition,
  parseCrmAllowedTargetStatusesConfig,
  parseCrmRequireCloserConfig,
  type CrmLeadStatusTransitionGateRow,
} from "@/lib/backoffice-crm-lead-status-transition-gates";

export type CrmLeadForGateEvaluation = {
  status: BackofficeLeadStatus;
  closerBackofficeUserId: string | null;
  meetingDate: Date | null;
};

export type CrmTransitionGateEvaluationResult =
  | { ok: true }
  | { ok: false; errorMessages: string[]; blockerType: string };

export class BackofficeCrmLeadStatusTransitionGateEvaluatorService {
  async listEnabledGates(): Promise<CrmLeadStatusTransitionGateRow[]> {
    return backofficeCrmLeadStatusTransitionGateRepository.listEnabled();
  }

  async evaluate(params: {
    lead: CrmLeadForGateEvaluation;
    targetStatus: BackofficeLeadStatus;
  }): Promise<CrmTransitionGateEvaluationResult> {
    const gates = await this.listEnabledGates();
    const sourceStatus = params.lead.status;

    for (const gate of gates) {
      if (!crmGateMatchesTransition(gate, sourceStatus, params.targetStatus)) {
        continue;
      }

      const block = this.evaluateGate(gate, params.lead, params.targetStatus);
      if (block) {
        return block;
      }
    }

    return { ok: true };
  }

  private evaluateGate(
    gate: CrmLeadStatusTransitionGateRow,
    lead: CrmLeadForGateEvaluation,
    targetStatus: BackofficeLeadStatus
  ): CrmTransitionGateEvaluationResult | null {
    const message =
      gate.errorMessage?.trim() || "Não foi possível concluir a mudança de status.";

    switch (gate.gateType) {
      case "allowed_target_statuses": {
        if (targetStatus === lead.status) return null;
        const { allowedTargetStatuses } = parseCrmAllowedTargetStatusesConfig(gate.config);
        if (allowedTargetStatuses.includes(targetStatus)) return null;
        return {
          ok: false,
          errorMessages: [message],
          blockerType: gate.blockerType,
        };
      }

      case "require_closer": {
        const config = parseCrmRequireCloserConfig(gate.config);
        if (!config.targetStatuses.includes(targetStatus)) return null;
        if (lead.closerBackofficeUserId) return null;
        return {
          ok: false,
          errorMessages: [message],
          blockerType: gate.blockerType || "closer_required",
        };
      }

      case "require_schedule_artifacts": {
        if (targetStatus !== "scheduled") return null;
        if (lead.meetingDate) return null;
        return {
          ok: false,
          errorMessages: [message],
          blockerType: gate.blockerType || "schedule_required",
        };
      }

      default:
        return null;
    }
  }
}

export const backofficeCrmLeadStatusTransitionGateEvaluatorService =
  new BackofficeCrmLeadStatusTransitionGateEvaluatorService();
