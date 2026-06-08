import { Output } from "@/lib/output"
import { BackofficeAllUsersRepository } from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/BackofficeAllUsersRepository"
import type { IBackofficeAllUsersRepository } from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/IBackofficeAllUsersRepository"

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_ACCESS_DAYS = 1
const MAX_ACCESS_DAYS = 365
const MIN_ACCESS_TOLERANCE_MS = 60 * 1000

export interface BackofficeProfileUserTypeInput {
  userType: "common" | "member_pro"
  accessExpiresAt?: string
}

export class BackofficeProfileUserTypeUseCase {
  constructor(private readonly repository: IBackofficeAllUsersRepository) {}

  async convert(profileId: string, assignedByProfileId: string, input: BackofficeProfileUserTypeInput): Promise<Output> {
    try {
      const isMaster = await this.repository.findIsMaster(profileId)

      if (isMaster === null) {
        return new Output(false, [], ["Usuário não encontrado"], null)
      }

      if (!isMaster) {
        return new Output(false, [], ["Tipo de usuário só pode ser definido para o usuário master da conta"], null)
      }

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
      return new Output(false, [], ["Erro ao atualizar tipo de usuário"], null)
    }
  }
}

export const backofficeProfileUserTypeUseCase = new BackofficeProfileUserTypeUseCase(
  new BackofficeAllUsersRepository()
)
