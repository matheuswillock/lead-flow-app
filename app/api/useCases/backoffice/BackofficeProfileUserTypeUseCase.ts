import { Output } from "@/lib/output"
import { BackofficeAllUsersRepository } from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/BackofficeAllUsersRepository"
import type { IBackofficeAllUsersRepository } from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/IBackofficeAllUsersRepository"
import {
  profileAsaasCustomerSyncUseCase,
  ProfileAsaasCustomerSyncUseCase,
} from "@/app/api/useCases/profileAsaasCustomer/ProfileAsaasCustomerSyncUseCase"

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_ACCESS_DAYS = 1
const MAX_ACCESS_DAYS = 365
const MIN_ACCESS_TOLERANCE_MS = 60 * 1000

export interface BackofficeProfileUserTypeInput {
  userType: "common" | "member_pro" | "associate" | "guest"
  accessExpiresAt?: string
  sponsorMasterId?: string
}

export class BackofficeProfileUserTypeUseCase {
  constructor(
    private readonly repository: IBackofficeAllUsersRepository,
    private readonly asaasSync: ProfileAsaasCustomerSyncUseCase = profileAsaasCustomerSyncUseCase
  ) {}

  async listSponsorOptions(): Promise<Output> {
    try {
      const options = await this.repository.findSponsorMasterOptions()
      return new Output(true, ["Patrocinadores listados"], [], { options })
    } catch (error) {
      console.error("[BackofficeProfileUserTypeUseCase][listSponsorOptions]", error)
      return new Output(false, [], ["Erro ao listar patrocinadores"], null)
    }
  }

  async convert(profileId: string, assignedByProfileId: string, input: BackofficeProfileUserTypeInput): Promise<Output> {
    try {
      const isMaster = await this.repository.findIsMaster(profileId)

      if (isMaster === null) {
        return new Output(false, [], ["Usuário não encontrado"], null)
      }

      if (!isMaster) {
        return new Output(false, [], ["Tipo de usuário só pode ser definido para o usuário master da conta"], null)
      }

      if (input.userType === "associate") {
        if (!input.sponsorMasterId) {
          return new Output(false, [], ["Informe o patrocinador da conta Associado"], null)
        }

        if (input.sponsorMasterId === profileId) {
          return new Output(false, [], ["A conta não pode ser patrocinada por ela mesma"], null)
        }

        const sponsorIsMaster = await this.repository.findIsMaster(input.sponsorMasterId)
        if (!sponsorIsMaster) {
          return new Output(false, [], ["Patrocinador inválido"], null)
        }

        const asaasOutput = await this.asaasSync.ensureProfileAsaasCustomer(profileId)
        if (!asaasOutput.isValid) {
          return asaasOutput
        }
        const asaasResult = asaasOutput.result as { asaasCustomerId: string }

        const userType = await this.repository.upsertUserTypeAssignment(profileId, {
          userType: "associate",
          accessExpiresAt: null,
          assignedByProfileId,
        })

        await this.repository.updateSponsorMasterId(profileId, input.sponsorMasterId)

        return new Output(
          true,
          ["Tipo de usuário atualizado para Associado"],
          [],
          { userType, asaasCustomerId: asaasResult.asaasCustomerId }
        )
      }

      if (input.userType === "guest") {
        if (!input.sponsorMasterId) {
          return new Output(false, [], ["Informe o patrocinador da conta Convidado"], null)
        }

        if (input.sponsorMasterId === profileId) {
          return new Output(false, [], ["A conta não pode ser patrocinada por ela mesma"], null)
        }

        const sponsorIsMaster = await this.repository.findIsMaster(input.sponsorMasterId)
        if (!sponsorIsMaster) {
          return new Output(false, [], ["Patrocinador inválido"], null)
        }

        const userType = await this.repository.upsertUserTypeAssignment(profileId, {
          userType: "guest",
          accessExpiresAt: null,
          assignedByProfileId,
        })

        await this.repository.updateSponsorMasterId(profileId, input.sponsorMasterId)
        await this.repository.setHasPermanentSubscription(profileId, true)

        return new Output(
          true,
          ["Tipo de usuário atualizado para Convidado"],
          [],
          { userType }
        )
      }

      const hasOpenReviews = await this.repository.hasOpenProposalReviewsForAssociate(profileId)
      if (hasOpenReviews) {
        return new Output(
          false,
          [],
          ["Não é possível alterar o tipo enquanto houver propostas abertas na fila Associados"],
          null
        )
      }

      await this.repository.updateSponsorMasterId(profileId, null)

      if (input.userType === "common") {
        const userType = await this.repository.upsertUserTypeAssignment(profileId, {
          userType: "common",
          accessExpiresAt: null,
          assignedByProfileId,
        })

        return new Output(true, ["Tipo de usuário atualizado para Comum"], [], { userType })
      }

      if (!input.accessExpiresAt) {
        return new Output(false, [], ["Informe a data de expiração do acesso Member PRO"], null)
      }

      const accessExpiresAt = new Date(input.accessExpiresAt)
      if (Number.isNaN(accessExpiresAt.getTime())) {
        return new Output(false, [], ["Data de expiração do acesso Member PRO inválida"], null)
      }

      const now = Date.now()
      if (accessExpiresAt.getTime() + MIN_ACCESS_TOLERANCE_MS < now + MIN_ACCESS_DAYS * DAY_MS) {
        return new Output(false, [], ["O acesso Member PRO deve ter validade de no mínimo 1 dia"], null)
      }
      if (accessExpiresAt.getTime() > now + MAX_ACCESS_DAYS * DAY_MS) {
        return new Output(false, [], ["O acesso Member PRO deve ter validade de no máximo 1 ano"], null)
      }

      const userType = await this.repository.upsertUserTypeAssignment(profileId, {
        userType: "member_pro",
        accessExpiresAt,
        assignedByProfileId,
      })

      return new Output(true, ["Tipo de usuário atualizado para Member PRO"], [], { userType })
    } catch (error) {
      console.error("[BackofficeProfileUserTypeUseCase][convert]", error)
      const message = error instanceof Error ? error.message : "Erro ao atualizar tipo de usuário"
      return new Output(false, [], [message], null)
    }
  }
}

export const backofficeProfileUserTypeUseCase = new BackofficeProfileUserTypeUseCase(
  new BackofficeAllUsersRepository()
)
