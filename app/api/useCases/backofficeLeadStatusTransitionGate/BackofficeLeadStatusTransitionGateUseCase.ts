import type { LeadStatus } from "@prisma/client";
import { Output } from "@/lib/output";
import {
  backofficeLeadStatusTransitionGateRepository,
  type UpdateLeadStatusTransitionGateInput,
} from "@/app/api/infra/data/repositories/backofficeLeadStatusTransitionGate/BackofficeLeadStatusTransitionGateRepository";
import { GATE_TYPE_LABELS } from "@/lib/leadStatusTransitionGates";
import { invalidateLeadStatusTransitionGatesCache } from "@/lib/cache/invalidation";

export class BackofficeLeadStatusTransitionGateUseCase {
  async list(): Promise<Output> {
    try {
      const gates = await backofficeLeadStatusTransitionGateRepository.listAll();
      return new Output(true, [], [], {
        gates,
        gateTypeLabels: GATE_TYPE_LABELS,
      });
    } catch (error) {
      console.error("[BackofficeLeadStatusTransitionGateUseCase][list]", error);
      return new Output(false, [], ["Erro ao listar gates de transição"], null);
    }
  }

  async updateGate(
    id: string,
    data: UpdateLeadStatusTransitionGateInput,
    updatedByProfileId: string
  ): Promise<Output> {
    try {
      const saved = await backofficeLeadStatusTransitionGateRepository.updateGate(
        id,
        data,
        updatedByProfileId
      );
      invalidateLeadStatusTransitionGatesCache();
      return new Output(true, ["Gate de transição salvo com sucesso"], [], { gate: saved });
    } catch (error) {
      console.error("[BackofficeLeadStatusTransitionGateUseCase][updateGate]", error);
      return new Output(false, [], ["Erro ao salvar gate de transição"], null);
    }
  }
}

export const backofficeLeadStatusTransitionGateUseCase =
  new BackofficeLeadStatusTransitionGateUseCase();

export type { LeadStatus };
