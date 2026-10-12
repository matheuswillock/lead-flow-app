import { asaasCardReauthorizationRepository } from "@/app/api/infra/data/repositories/asaasCardReauthorization/AsaasCardReauthorizationRepository"
import { CreateAuthenticatedCardReauthorizationLinkUseCase } from "./CreateAuthenticatedCardReauthorizationLinkUseCase"

export const createAuthenticatedCardReauthorizationLinkUseCase = new CreateAuthenticatedCardReauthorizationLinkUseCase({
  recoveryRepository: asaasCardReauthorizationRepository,
  tokenRepository: asaasCardReauthorizationRepository,
})

