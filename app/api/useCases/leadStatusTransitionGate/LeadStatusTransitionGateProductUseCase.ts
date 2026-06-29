import { Output } from "@/lib/output";
import { leadStatusTransitionGateEvaluatorService } from "@/app/api/services/leadStatusTransitionGate/LeadStatusTransitionGateEvaluatorService";

export class LeadStatusTransitionGateProductUseCase {
  async listEnabled(): Promise<Output> {
    try {
      const gates = await leadStatusTransitionGateEvaluatorService.listEnabledGates();
      return new Output(true, [], [], {
        gates: gates.map((gate) => ({
          slug: gate.slug,
          gateType: gate.gateType,
          sourceStatus: gate.sourceStatus,
          targetStatus: gate.targetStatus,
          config: gate.config,
        })),
      });
    } catch (error) {
      console.error("[LeadStatusTransitionGateProductUseCase][listEnabled]", error);
      return new Output(false, [], ["Erro ao listar gates de transição"], null);
    }
  }
}

export const leadStatusTransitionGateProductUseCase = new LeadStatusTransitionGateProductUseCase();
