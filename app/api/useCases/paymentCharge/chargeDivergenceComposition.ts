import { createChargeDivergenceService } from "@/app/api/services/paymentCharge/paymentChargeComposition"
import { ChargeDivergenceUseCase } from "./ChargeDivergenceUseCase"

export function getChargeDivergenceUseCase(): ChargeDivergenceUseCase {
  return new ChargeDivergenceUseCase(createChargeDivergenceService())
}
