import { Output } from "@/lib/output";
import { backofficeRadarEngagementRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeRadarEngagement/BackofficeRadarEngagementRepository";
import type { UpsertBackofficeFormEngagementScoreRuleInput } from "@/app/api/infra/data/repositories/backoffice/backofficeRadarEngagement/IBackofficeRadarEngagementRepository";

function rangesOverlap(
  a: { minPercent: number; maxPercent: number },
  b: { minPercent: number; maxPercent: number }
): boolean {
  return a.minPercent <= b.maxPercent && b.minPercent <= a.maxPercent;
}

export class BackofficeFormEngagementScoreRuleUseCase {
  async list(): Promise<Output> {
    try {
      const rules = await backofficeRadarEngagementRepository.listFormScoreRules();
      return new Output(true, [], [], { rules });
    } catch (error) {
      console.error("[BackofficeFormEngagementScoreRuleUseCase][list]", error);
      return new Output(false, [], ["Erro ao listar regras de score de formulário"], null);
    }
  }

  async upsert(items: UpsertBackofficeFormEngagementScoreRuleInput[]): Promise<Output> {
    try {
      if (items.length === 0) {
        return new Output(false, [], ["Informe ao menos uma regra para salvar"], null);
      }

      for (const item of items) {
        if (!Number.isInteger(item.minPercent) || !Number.isInteger(item.maxPercent)) {
          return new Output(false, [], ["Faixas de score devem ser inteiros"], null);
        }
        if (item.minPercent < 0 || item.maxPercent > 100 || item.minPercent > item.maxPercent) {
          return new Output(false, [], ["Faixa de score inválida (0–100, min ≤ max)"], null);
        }
        if (!Number.isFinite(item.multiplier) || item.multiplier < 0) {
          return new Output(false, [], ["Multiplicador inválido"], null);
        }
        if (!item.label?.trim()) {
          return new Output(false, [], ["Label é obrigatório"], null);
        }
      }

      const activeItems = items.filter((item) => item.isActive !== false);
      for (let i = 0; i < activeItems.length; i++) {
        for (let j = i + 1; j < activeItems.length; j++) {
          const left = activeItems[i]!;
          const right = activeItems[j]!;
          if (rangesOverlap(left, right)) {
            return new Output(
              false,
              [],
              [
                `Faixas sobrepostas: ${left.minPercent}–${left.maxPercent}% e ${right.minPercent}–${right.maxPercent}%`,
              ],
              null
            );
          }
        }
      }

      const rules = await backofficeRadarEngagementRepository.upsertFormScoreRules(
        items.map((item) => ({
          id: item.id,
          minPercent: item.minPercent,
          maxPercent: item.maxPercent,
          multiplier: item.multiplier,
          label: item.label.trim(),
          isActive: item.isActive ?? true,
        }))
      );

      return new Output(true, ["Regras de score de formulário salvas com sucesso"], [], {
        rules,
      });
    } catch (error) {
      console.error("[BackofficeFormEngagementScoreRuleUseCase][upsert]", error);
      return new Output(false, [], ["Erro ao salvar regras de score de formulário"], null);
    }
  }

  async delete(id: string): Promise<Output> {
    try {
      if (!id.trim()) {
        return new Output(false, [], ["id é obrigatório"], null);
      }
      await backofficeRadarEngagementRepository.deleteFormScoreRule(id.trim());
      const rules = await backofficeRadarEngagementRepository.listFormScoreRules();
      return new Output(true, ["Regra removida com sucesso"], [], { rules });
    } catch (error) {
      console.error("[BackofficeFormEngagementScoreRuleUseCase][delete]", error);
      return new Output(false, [], ["Erro ao remover regra de score de formulário"], null);
    }
  }
}

export const backofficeFormEngagementScoreRuleUseCase =
  new BackofficeFormEngagementScoreRuleUseCase();
