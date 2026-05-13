import { Output } from "@/lib/output";
import type { PmeHospitalId } from "@/app/api/services/pmePlanSimulator/IPmePlanSimulatorService";

export interface PmeSimulationUseCaseInput {
  ages: number[];
  hospitalId: PmeHospitalId;
}

export interface IPmePlanSimulatorUseCase {
  getCatalog(): Promise<Output>;
  simulate(input: PmeSimulationUseCaseInput): Promise<Output>;
}

