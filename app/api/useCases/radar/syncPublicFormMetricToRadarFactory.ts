import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { syncLeadToRadarUseCase } from "./SyncLeadToRadarUseCase"
import {
  createCrmLeadFromRadarFormGateUseCase,
  evaluateRadarProfileLeadEligibilityUseCase,
} from "./publicFormLeadGateFactory"
import { SyncPublicFormMetricToRadarUseCase } from "./SyncPublicFormMetricToRadarUseCase"

export const syncPublicFormMetricToRadarUseCase = new SyncPublicFormMetricToRadarUseCase(
  radarRepository,
  syncLeadToRadarUseCase,
  createCrmLeadFromRadarFormGateUseCase,
  evaluateRadarProfileLeadEligibilityUseCase,
)
