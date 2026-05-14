import type { PmeHospitalId, PmeSimulationOutput, PmeSimulatorCatalog } from "../context/PmeSimulatorTypes";

export interface IPmeSimulatorService {
  getCatalog(input: { supabaseId: string; teamId: string }): Promise<PmeSimulatorCatalog>;
  simulate(input: {
    supabaseId: string;
    teamId: string;
    ages: number[];
    hospitalId: PmeHospitalId;
  }): Promise<PmeSimulationOutput>;
}

