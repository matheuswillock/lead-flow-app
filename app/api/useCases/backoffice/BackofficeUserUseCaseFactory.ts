import { auditLogWriter } from "@/app/api/useCases/audit/AuditLogWriter"
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository"
import { BackofficeOperatorLinksRepository } from "@/app/api/infra/data/repositories/backoffice/OperatorLinksRepository/BackofficeOperatorLinksRepository"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/BackofficeUserRepository"
import { noopMailboxProvisioningService } from "@/app/api/services/mailbox/NoopMailboxProvisioningService"
import { BackofficeOperatorLinksUseCase } from "./BackofficeOperatorLinksUseCase"
import { BackofficeUserUseCase } from "./BackofficeUserUseCase"

/** Monta os casos de uso de usuários do backoffice com as dependências reais. */
export function createBackofficeOperatorLinksUseCase() {
  return new BackofficeOperatorLinksUseCase(
    new BackofficeUserRepository(),
    new BackofficeOperatorLinksRepository(),
    auditLogWriter
  )
}

export function createBackofficeUserUseCase() {
  return new BackofficeUserUseCase(
    new BackofficeUserRepository(),
    profileRepository,
    noopMailboxProvisioningService,
    createBackofficeOperatorLinksUseCase()
  )
}
