import { Output } from "@/lib/output";
import { backofficeRadarEngagementRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeRadarEngagement/BackofficeRadarEngagementRepository";
import type { UpsertBackofficeRadarEngagementWeightInput } from "@/app/api/infra/data/repositories/backoffice/backofficeRadarEngagement/IBackofficeRadarEngagementRepository";

export class BackofficeRadarEngagementWeightUseCase {
  async list(): Promise<Output> {
    try {
      const weights = await backofficeRadarEngagementRepository.listWeights();
      return new Output(true, [], [], { weights });
    } catch (error) {
      console.error("[BackofficeRadarEngagementWeightUseCase][list]", error);
      return new Output(false, [], ["Erro ao listar pesos de engajamento"], null);
    }
  }

  async upsert(items: UpsertBackofficeRadarEngagementWeightInput[]): Promise<Output> {
    try {
      if (items.length === 0) {
        return new Output(false, [], ["Informe ao menos um peso para salvar"], null);
      }

      for (const item of items) {
        const eventType = item.eventType?.trim();
        if (!eventType) {
          return new Output(false, [], ["eventType é obrigatório"], null);
        }
        if (!Number.isInteger(item.weight)) {
          return new Output(false, [], [`Peso inválido para ${eventType}`], null);
        }
      }

      const weights = await backofficeRadarEngagementRepository.upsertWeights(
        items.map((item) => ({
          eventType: item.eventType.trim(),
          weight: item.weight,
          description: item.description ?? null,
          isActive: item.isActive ?? true,
        }))
      );

      return new Output(true, ["Pesos de engajamento salvos com sucesso"], [], { weights });
    } catch (error) {
      console.error("[BackofficeRadarEngagementWeightUseCase][upsert]", error);
      return new Output(false, [], ["Erro ao salvar pesos de engajamento"], null);
    }
  }
}

export const backofficeRadarEngagementWeightUseCase =
  new BackofficeRadarEngagementWeightUseCase();
