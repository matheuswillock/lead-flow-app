import { asaasCustomerGateway } from "@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway"
import { asaasMigrationGateway } from "@/app/api/infra/gateways/asaasMigration/AsaasMigrationGateway"
import { asaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/AsaasAccountMigrationRepository"
import { subscriptionPointerRepository } from "@/app/api/infra/data/repositories/subscriptions/SubscriptionPointerRepository"
import { MigrateAsaasAccountUseCase } from "./MigrateAsaasAccountUseCase"
import { AsaasDueDateCutoverUseCase } from "./AsaasDueDateCutoverUseCase"
import { requestCardReauthorizationUseCase } from "./asaasCardReauthorizationFactory"
import { AsaasCardReauthorizationReminderUseCase } from "./AsaasCardReauthorizationReminderUseCase"
import { asaasMigrationReadinessRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/AsaasMigrationReadinessRepository"
import { MigrationReadinessService } from "./MigrationReadinessService"

export const migrateAsaasAccountUseCase = new MigrateAsaasAccountUseCase({
  ledgerRepository: asaasAccountMigrationRepository,
  customerGateway: asaasCustomerGateway,
  migrationGateway: asaasMigrationGateway,
  pointerRepository: subscriptionPointerRepository,
  readinessService: new MigrationReadinessService(asaasMigrationReadinessRepository),
})

export const asaasDueDateCutoverUseCase = new AsaasDueDateCutoverUseCase({
  ledgerRepository: asaasAccountMigrationRepository,
  migrationUseCase: migrateAsaasAccountUseCase,
  requestReauthorizationUseCase: requestCardReauthorizationUseCase,
})

export const asaasCardReauthorizationReminderUseCase =
  new AsaasCardReauthorizationReminderUseCase({
    ledgerRepository: asaasAccountMigrationRepository,
    migrationUseCase: migrateAsaasAccountUseCase,
    requestUseCase: requestCardReauthorizationUseCase,
  })
