import { Output } from "@/lib/output";
import { backofficeRadarEngagementRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeRadarEngagement/BackofficeRadarEngagementRepository";
import type { UpsertBackofficeRadarEngagementConfigInput } from "@/app/api/infra/data/repositories/backoffice/backofficeRadarEngagement/IBackofficeRadarEngagementRepository";

export class BackofficeRadarEngagementConfigUseCase {
  async get(): Promise<Output> {
    try {
      const config = await backofficeRadarEngagementRepository.getActiveConfig();
      return new Output(true, [], [], { config });
    } catch (error) {
      console.error("[BackofficeRadarEngagementConfigUseCase][get]", error);
      return new Output(false, [], ["Erro ao carregar configuração de engajamento"], null);
    }
  }

  async upsert(input: UpsertBackofficeRadarEngagementConfigInput): Promise<Output> {
    try {
      const validationError = this.validate(input);
      if (validationError) {
        return new Output(false, [], [validationError], null);
      }

      const config = await backofficeRadarEngagementRepository.upsertActiveConfig(input);
      return new Output(true, ["Configuração de engajamento salva com sucesso"], [], { config });
    } catch (error) {
      console.error("[BackofficeRadarEngagementConfigUseCase][upsert]", error);
      return new Output(false, [], ["Erro ao salvar configuração de engajamento"], null);
    }
  }

  private validate(input: UpsertBackofficeRadarEngagementConfigInput): string | null {
    const {
      windowRecentDays,
      windowMidDays,
      windowOldDays,
      recentMultiplier,
      oldMultiplier,
      hotThreshold,
      warmThreshold,
      lukewarmThreshold,
    } = input;

    if (
      !Number.isInteger(windowRecentDays) ||
      !Number.isInteger(windowMidDays) ||
      !Number.isInteger(windowOldDays) ||
      windowRecentDays < 1 ||
      windowMidDays < 1 ||
      windowOldDays < 1
    ) {
      return "Janelas de dias devem ser inteiros positivos";
    }

    if (!(windowRecentDays < windowMidDays && windowMidDays < windowOldDays)) {
      return "Janelas devem seguir: recente < intermediária < antiga";
    }

    if (
      !Number.isFinite(recentMultiplier) ||
      !Number.isFinite(oldMultiplier) ||
      recentMultiplier <= 0 ||
      oldMultiplier < 0
    ) {
      return "Multiplicadores inválidos";
    }

    if (
      !Number.isInteger(hotThreshold) ||
      !Number.isInteger(warmThreshold) ||
      !Number.isInteger(lukewarmThreshold)
    ) {
      return "Limiares devem ser inteiros";
    }

    if (!(hotThreshold > warmThreshold && warmThreshold > lukewarmThreshold && lukewarmThreshold >= 0)) {
      return "Limiares devem seguir: quente > morno > morno-frio ≥ 0";
    }

    return null;
  }
}

export const backofficeRadarEngagementConfigUseCase =
  new BackofficeRadarEngagementConfigUseCase();
