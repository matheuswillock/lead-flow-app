import { asaasCardReauthorizationRepository } from "@/app/api/infra/data/repositories/asaasCardReauthorization/AsaasCardReauthorizationRepository"
import { asaasMigrationGateway } from "@/app/api/infra/gateways/asaasMigration/AsaasMigrationGateway"
import { migrateAsaasAccountUseCase } from "./asaasAccountMigrationFactory"
import { CardReauthorizationUseCase } from "./CardReauthorizationUseCase"

export const cardReauthorizationUseCase = new CardReauthorizationUseCase({
  tokenRepository: asaasCardReauthorizationRepository,
  migrationUseCase: migrateAsaasAccountUseCase,
  migrationGateway: asaasMigrationGateway,
})
