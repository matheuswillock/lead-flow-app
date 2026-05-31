import { AGE_RANGES as SHARED_AGE_RANGES } from "@/lib/ageRanges";
import type {
  IPmePlanSimulatorService,
  PmeAgeRange,
  PmeHospitalOption,
  PmePlanCatalogItem,
  PmePlanSimulationResult,
  PmeSimulationFromRangeCountsInput,
  PmeSimulationInput,
  PmeSimulationOutput,
} from "./IPmePlanSimulatorService";

const AGE_RANGES: PmeAgeRange[] = SHARED_AGE_RANGES.map((range) => ({
  label: range.label,
  min: range.min,
  max: range.max,
}));

const HOSPITALS: PmeHospitalOption[] = [
  { id: "nenhum", label: "Sem Hospital", sub: "Rede padrão da operadora" },
  { id: "sirio", label: "Sirio-Libanes", sub: "Hospital de referência premium" },
  { id: "einstein", label: "Albert Einstein", sub: "Hospital de referência premium" },
  { id: "rededor", label: "Rede D'Or", sub: "Rede D'Or / São Luiz" },
];

// TODO: mover tabela de planos para persistencia em banco e manter catalogo por vigencia de preco.
const PLANS: PmePlanCatalogItem[] = [
  { id: "bronze_sp", name: "Plano Bronze SP", operator: "Amil", hospitalId: "nenhum", prices: [111.15, 150.94, 177.19, 177.19, 177.19, 197.92, 273.33, 326.36, 469.31, 665.48] },
  { id: "p200_sp", name: "Plano 200 SP Capital", operator: "Hapvida", hospitalId: "nenhum", prices: [84.62, 114.22, 134.98, 134.98, 134.98, 160.32, 208.41, 270.94, 352.22, 507.65] },
  { id: "equilibrio", name: "Plano Equilibrio", operator: "Alice", hospitalId: "nenhum", prices: [319.97, 409.79, 460.47, 520.29, 597.22, 667.11, 772.28, 994.63, 1212.73, 1861.64] },
  { id: "efetivo", name: "Plano Efetivo", operator: "Bradesco", hospitalId: "nenhum", prices: [310.96, 366.93, 443.98, 532.78, 607.36, 625.58, 761.68, 895.89, 1066.11, 1865.59] },
  { id: "p220", name: "Plano P220", operator: "Porto", hospitalId: "nenhum", prices: [204.17, 247.61, 298.7, 341.96, 370.51, 382.64, 457.08, 492.06, 607.98, 1021.96] },
  { id: "prata_pro", name: "Plano Prata Pro E", operator: "Porto", hospitalId: "nenhum", prices: [195.63, 237.25, 286.2, 327.65, 355.01, 366.63, 437.95, 471.47, 582.54, 979.2] },
  { id: "essencial3", name: "Novo Essencial PME SP III", operator: "Amil", hospitalId: "nenhum", prices: [288.19, 352.74, 441.67, 488.07, 519.86, 603.03, 720.87, 864.56, 1026.43, 1729.11] },
  { id: "direto_nac", name: "Plano Direto Nacional", operator: "SulAmerica", hospitalId: "nenhum", prices: [197.81, 247.25, 306.6, 340.33, 364.15, 422.41, 504.96, 591.82, 704.56, 1186.84] },
  { id: "super_conforto", name: "Plano Super Conforto", operator: "Alice", hospitalId: "sirio", prices: [488.31, 625.39, 702.74, 794.02, 911.43, 1018.08, 1178.59, 1517.92, 1850.77, 2841.08] },
  { id: "platinum_r1", name: "Plano Platinum R1", operator: "Amil", hospitalId: "sirio", prices: [406.65, 475.78, 580.45, 696.54, 731.37, 804.51, 1005.64, 1106.2, 1382.75, 2419.81] },
  { id: "nac_plus4_b", name: "Nacional Plus 4", operator: "Bradesco", hospitalId: "sirio", prices: [1031.83, 1217.56, 1473.24, 1767.9, 2015.39, 2075.85, 2527.47, 2972.81, 3537.64, 6190.52] },
  { id: "p470", name: "Plano P470", operator: "Porto", hospitalId: "sirio", prices: [388.37, 470.99, 568.17, 650.45, 704.77, 727.85, 869.43, 935.98, 1156.47, 1943.94] },
  { id: "senior", name: "Plano Senior", operator: "Unimed", hospitalId: "sirio", prices: [1086.89, 1330.35, 1665.76, 1840.75, 1960.63, 2274.31, 2718.73, 3260.66, 3871.16, 6521.31] },
  { id: "infinity_h", name: "Plano Infinity", operator: "Hapvida", hospitalId: "sirio", prices: [742.73, 868.99, 1060.16, 1272.21, 1335.83, 1469.4, 1836.76, 2220.77, 2777.82, 4419.54] },
  { id: "executivo_r1", name: "Plano Executivo R1", operator: "SulAmerica", hospitalId: "sirio", prices: [747.43, 934.28, 1158.51, 1285.94, 1375.95, 1596.1, 1907.98, 2236.16, 2662.13, 4484.38] },
  { id: "exclusivo", name: "Plano Exclusivo", operator: "Alice", hospitalId: "einstein", prices: [521.57, 667.98, 750.59, 848.09, 973.5, 1087.42, 1258.85, 1621.29, 1976.81, 3034.56] },
  { id: "black_r1", name: "Plano Black I R1", operator: "Amil", hospitalId: "einstein", prices: [661.34, 773.77, 944, 1132.8, 1189.44, 1308.38, 1635.48, 1799.03, 2248.79, 3935.38] },
  { id: "p520", name: "Plano P520", operator: "Porto", hospitalId: "einstein", prices: [806.83, 978.45, 1180.34, 1351.29, 1464.14, 1512.07, 1806.21, 1944.46, 2402.52, 4038.45] },
  { id: "nac_plus4_e", name: "Nacional Plus 4", operator: "Bradesco", hospitalId: "einstein", prices: [1031.83, 1217.56, 1473.24, 1767.9, 2015.39, 2075.85, 2527.47, 2972.81, 3537.64, 6190.52] },
  { id: "s750_r1", name: "Plano S750 R1", operator: "Amil", hospitalId: "rededor", prices: [378.62, 442.99, 540.45, 648.54, 680.97, 749.07, 936.34, 1029.97, 1287.46, 2253.06] },
  { id: "nac3_b", name: "Plano Nacional III", operator: "Bradesco", hospitalId: "rededor", prices: [457.22, 539.52, 652.81, 783.38, 893.05, 919.84, 1119.96, 1317.3, 1567.59, 2743.13] },
  { id: "ouro_mais", name: "Plano Ouro Mais I", operator: "Porto", hospitalId: "rededor", prices: [443.32, 537.62, 648.55, 742.48, 804.48, 830.82, 992.44, 1068.4, 1320.09, 2218.96] },
  { id: "p900", name: "Plano 900", operator: "Hapvida", hospitalId: "rededor", prices: [413.88, 484.24, 590.77, 708.92, 744.37, 818.81, 1023.52, 1237.54, 1547.91, 2462.72] },
  { id: "esp_vital", name: "Plano Especial Vital", operator: "SulAmerica", hospitalId: "rededor", prices: [261.91, 327.39, 405.96, 450.62, 482.15, 559.31, 668.6, 783.59, 932.87, 1571.4] },
  { id: "superior", name: "Plano Superior", operator: "Unimed", hospitalId: "rededor", prices: [384.97, 471.21, 590.01, 651.99, 694.45, 805.56, 962.97, 1154.92, 1371.16, 2309.84] },
];

function getAgeRangeIndex(age: number): number {
  return AGE_RANGES.findIndex((range) => age >= range.min && age <= range.max);
}

function isEligibleOperator(operator: string, lives: number): boolean {
  if (lives === 1) {
    return ["Alice", "Hapvida"].includes(operator);
  }
  if (lives === 2) {
    return ["Alice", "Hapvida", "Amil"].includes(operator);
  }
  return true;
}

export class PmePlanSimulatorService implements IPmePlanSimulatorService {
  getCatalog() {
    return {
      hospitals: HOSPITALS,
      ageRanges: AGE_RANGES,
      plans: PLANS.map((plan) => ({
        id: plan.id,
        name: plan.name,
        operator: plan.operator,
        hospitalId: plan.hospitalId,
      })),
    };
  }

  simulate(input: PmeSimulationInput): PmeSimulationOutput {
    const ages = [...input.ages].filter((value) => Number.isInteger(value) && value >= 0 && value <= 99);
    const lives = ages.length;
    const hospital = HOSPITALS.find((item) => item.id === input.hospitalId) ?? HOSPITALS[0];

    if (lives === 0) {
      return {
        lives: 0,
        hospitalId: hospital.id,
        hospitalLabel: hospital.label,
        results: [],
      };
    }

    const quantityByRange = new Array(AGE_RANGES.length).fill(0) as number[];
    for (const age of ages) {
      const index = getAgeRangeIndex(age);
      if (index >= 0) {
        quantityByRange[index] += 1;
      }
    }

    return this.computeSimulation(quantityByRange, lives, hospital);
  }

  simulateFromRangeCounts(input: PmeSimulationFromRangeCountsInput): PmeSimulationOutput {
    const hospital = HOSPITALS.find((item) => item.id === input.hospitalId) ?? HOSPITALS[0];

    const quantityByRange = new Array(AGE_RANGES.length).fill(0) as number[];
    let lives = 0;

    for (const entry of input.ageRangeCounts) {
      if (entry.count <= 0) continue;
      const rangeIndex = SHARED_AGE_RANGES.findIndex((r) => r.rangeKey === entry.rangeKey);
      if (rangeIndex >= 0) {
        quantityByRange[rangeIndex] += entry.count;
        lives += entry.count;
      }
    }

    if (lives === 0) {
      return {
        lives: 0,
        hospitalId: hospital.id,
        hospitalLabel: hospital.label,
        results: [],
      };
    }

    return this.computeSimulation(quantityByRange, lives, hospital);
  }

  private computeSimulation(
    quantityByRange: number[],
    lives: number,
    hospital: PmeHospitalOption,
  ): PmeSimulationOutput {
    const computed = PLANS
      .filter((plan) => plan.hospitalId === hospital.id && isEligibleOperator(plan.operator, lives))
      .map((plan) => {
        let total = 0;
        const breakdown = AGE_RANGES.map((range, index) => {
          const quantity = quantityByRange[index];
          const unitPrice = plan.prices[index];
          const subtotal = quantity * unitPrice;
          total += subtotal;
          return {
            ageRangeLabel: range.label,
            quantity,
            unitPrice,
            subtotal,
          };
        }).filter((item) => item.quantity > 0);

        const result: PmePlanSimulationResult = {
          planId: plan.id,
          planName: plan.name,
          operator: plan.operator,
          hospitalId: plan.hospitalId,
          total,
          perCapita: total / lives,
          isBest: false,
          breakdown,
        };

        return result;
      })
      .sort((a, b) => a.total - b.total)
      .map((plan, index) => ({
        ...plan,
        isBest: index === 0,
      }));

    return {
      lives,
      hospitalId: hospital.id,
      hospitalLabel: hospital.label,
      results: computed,
    };
  }
}

export const pmePlanSimulatorService = new PmePlanSimulatorService();

