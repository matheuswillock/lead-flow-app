import { Output } from "@/lib/output";
import { AGE_RANGES } from "@/lib/ageRanges";
import { pmePlanSimulatorService } from "@/app/api/services/pmePlanSimulator/PmePlanSimulatorService";
import type { IPmePlanSimulatorUseCase, PmeSimulationFromRangeCountsUseCaseInput, PmeSimulationUseCaseInput } from "./IPmePlanSimulatorUseCase";

export const PME_SIMULATOR_ERROR_MESSAGES = {
  INVALID_AGES: "Informe ao menos uma idade valida entre 0 e 99.",
  INVALID_AGE_RANGE_COUNTS: "Informe ao menos uma faixa etaria com quantidade valida.",
  INVALID_HOSPITAL: "Hospital de referencia invalido.",
  INTERNAL_CATALOG_ERROR: "Erro ao carregar catalogo do simulador.",
  INTERNAL_SIMULATION_ERROR: "Erro ao executar simulacao.",
} as const;

const ALLOWED_HOSPITALS = new Set(["nenhum", "sirio", "einstein", "rededor"]);
const VALID_RANGE_KEYS = new Set(AGE_RANGES.map((r) => r.rangeKey));

export class PmePlanSimulatorUseCase implements IPmePlanSimulatorUseCase {
  async getCatalog(): Promise<Output> {
    try {
      const catalog = pmePlanSimulatorService.getCatalog();
      return new Output(true, [], [], catalog);
    } catch (error) {
      console.error("[PmePlanSimulatorUseCase][getCatalog] Erro:", error);
      return new Output(false, [], [PME_SIMULATOR_ERROR_MESSAGES.INTERNAL_CATALOG_ERROR], null);
    }
  }

  async simulate(input: PmeSimulationUseCaseInput): Promise<Output> {
    try {
      const normalizedAges = input.ages
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 99);

      if (normalizedAges.length === 0) {
        return new Output(false, [], [PME_SIMULATOR_ERROR_MESSAGES.INVALID_AGES], null);
      }

      if (!ALLOWED_HOSPITALS.has(input.hospitalId)) {
        return new Output(false, [], [PME_SIMULATOR_ERROR_MESSAGES.INVALID_HOSPITAL], null);
      }

      const result = pmePlanSimulatorService.simulate({
        ages: normalizedAges,
        hospitalId: input.hospitalId,
      });

      return new Output(true, [], [], result);
    } catch (error) {
      console.error("[PmePlanSimulatorUseCase][simulate] Erro:", error);
      return new Output(false, [], [PME_SIMULATOR_ERROR_MESSAGES.INTERNAL_SIMULATION_ERROR], null);
    }
  }

  async simulateFromRangeCounts(input: PmeSimulationFromRangeCountsUseCaseInput): Promise<Output> {
    try {
      const validCounts = input.ageRangeCounts.filter(
        (entry) => VALID_RANGE_KEYS.has(entry.rangeKey) && Number.isInteger(entry.count) && entry.count > 0,
      );

      if (validCounts.length === 0) {
        return new Output(false, [], [PME_SIMULATOR_ERROR_MESSAGES.INVALID_AGE_RANGE_COUNTS], null);
      }

      if (!ALLOWED_HOSPITALS.has(input.hospitalId)) {
        return new Output(false, [], [PME_SIMULATOR_ERROR_MESSAGES.INVALID_HOSPITAL], null);
      }

      const result = pmePlanSimulatorService.simulateFromRangeCounts({
        ageRangeCounts: validCounts,
        hospitalId: input.hospitalId,
      });

      return new Output(true, [], [], result);
    } catch (error) {
      console.error("[PmePlanSimulatorUseCase][simulateFromRangeCounts] Erro:", error);
      return new Output(false, [], [PME_SIMULATOR_ERROR_MESSAGES.INTERNAL_SIMULATION_ERROR], null);
    }
  }
}

export const pmePlanSimulatorUseCase = new PmePlanSimulatorUseCase();

