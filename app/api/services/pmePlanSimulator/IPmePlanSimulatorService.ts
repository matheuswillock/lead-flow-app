export type PmeHospitalId = "nenhum" | "sirio" | "einstein" | "rededor";

export interface PmeAgeRange {
  label: string;
  min: number;
  max: number;
}

export interface PmeHospitalOption {
  id: PmeHospitalId;
  label: string;
  sub: string;
}

export interface PmePlanCatalogItem {
  id: string;
  name: string;
  operator: string;
  hospitalId: PmeHospitalId;
  prices: number[];
}

export interface PmePlanBreakdownItem {
  ageRangeLabel: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface PmePlanSimulationResult {
  planId: string;
  planName: string;
  operator: string;
  hospitalId: PmeHospitalId;
  total: number;
  perCapita: number;
  isBest: boolean;
  breakdown: PmePlanBreakdownItem[];
}

export interface PmeSimulatorCatalog {
  hospitals: PmeHospitalOption[];
  ageRanges: PmeAgeRange[];
  plans: Array<{
    id: string;
    name: string;
    operator: string;
    hospitalId: PmeHospitalId;
  }>;
}

export interface PmeSimulationInput {
  ages: number[];
  hospitalId: PmeHospitalId;
}

export interface PmeSimulationOutput {
  lives: number;
  hospitalId: PmeHospitalId;
  hospitalLabel: string;
  results: PmePlanSimulationResult[];
}

export interface IPmePlanSimulatorService {
  getCatalog(): PmeSimulatorCatalog;
  simulate(input: PmeSimulationInput): PmeSimulationOutput;
}

