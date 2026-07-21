import { Output } from "@/lib/output";
import {
  backofficeCrmLeadStatusTransitionGateRepository,
  type UpdateCrmLeadStatusTransitionGateInput,
} from "@/app/api/infra/data/repositories/backoffice/backofficeCrmLeadStatusTransitionGate/BackofficeCrmLeadStatusTransitionGateRepository";
import { CRM_GATE_TYPE_LABELS } from "@/lib/backoffice-crm-lead-status-transition-gates";

export class BackofficeCrmLeadStatusTransitionGateUseCase {
  async list(): Promise<Output> {
    try {
      const gates = await backofficeCrmLeadStatusTransitionGateRepository.listAll();
      return new Output(true, [], [], {
        gates,
        gateTypeLabels: CRM_GATE_TYPE_LABELS,
      });
    } catch (error) {
      console.error("[BackofficeCrmLeadStatusTransitionGateUseCase][list]", error);
      return new Output(false, [], ["Erro ao listar gates de transição do CRM"], null);
    }
  }

  async updateGate(
    id: string,
    data: UpdateCrmLeadStatusTransitionGateInput,
    updatedByProfileId: string
  ): Promise<Output> {
    try {
      const saved = await backofficeCrmLeadStatusTransitionGateRepository.updateGate(
        id,
        data,
        updatedByProfileId
      );
      return new Output(true, ["Gate de transição salvo com sucesso"], [], { gate: saved });
    } catch (error) {
      console.error("[BackofficeCrmLeadStatusTransitionGateUseCase][updateGate]", error);
      return new Output(false, [], ["Erro ao salvar gate de transição"], null);
    }
  }
}

export const backofficeCrmLeadStatusTransitionGateUseCase =
  new BackofficeCrmLeadStatusTransitionGateUseCase();
