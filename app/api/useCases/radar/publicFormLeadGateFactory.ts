import { radarLeadGateUnitOfWork } from "@/app/api/infra/data/repositories/radar/RadarLeadGateUnitOfWork"
import { CreateCrmLeadFromRadarFormGateUseCase } from "./CreateCrmLeadFromRadarFormGateUseCase"
import { EvaluateRadarProfileLeadEligibilityUseCase } from "./EvaluateRadarProfileLeadEligibilityUseCase"

export const evaluateRadarProfileLeadEligibilityUseCase =
  new EvaluateRadarProfileLeadEligibilityUseCase(radarLeadGateUnitOfWork)

export const createCrmLeadFromRadarFormGateUseCase = new CreateCrmLeadFromRadarFormGateUseCase(
  radarLeadGateUnitOfWork,
  evaluateRadarProfileLeadEligibilityUseCase,
)
