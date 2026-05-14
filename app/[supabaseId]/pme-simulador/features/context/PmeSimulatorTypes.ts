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
}

export interface PmeSimulatorCatalog {
  hospitals: PmeHospitalOption[];
  ageRanges: PmeAgeRange[];
  plans: PmePlanCatalogItem[];
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

export interface PmeSimulationOutput {
  lives: number;
  hospitalId: PmeHospitalId;
  hospitalLabel: string;
  results: PmePlanSimulationResult[];
}

export interface PmeSimulatorContextValue {
  isCatalogLoading: boolean;
  isSimulationLoading: boolean;
  isAllowed: boolean;
  error: string | null;
  catalogs: PmeSimulatorCatalog | null;
  ages: number[];
  ageInput: string;
  selectedHospitalId: PmeHospitalId;
  simulation: PmeSimulationOutput | null;
  expandedPlanIds: string[];
  setAgeInput: (value: string) => void;
  addAgesFromInput: () => void;
  removeAgeByIndex: (index: number) => void;
  clearAges: () => void;
  selectHospital: (hospitalId: PmeHospitalId) => void;
  runSimulation: () => Promise<void>;
  togglePlan: (planId: string) => void;
}

