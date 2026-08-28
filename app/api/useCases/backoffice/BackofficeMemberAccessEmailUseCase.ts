import { Output } from "@/lib/output"
import { BackofficeMemberAccessRepository } from "@/app/api/infra/data/repositories/backoffice/MemberAccessRepository/BackofficeMemberAccessRepository"
import type { IBackofficeMemberAccessRepository } from "@/app/api/infra/data/repositories/backoffice/MemberAccessRepository/IBackofficeMemberAccessRepository"
import {
  sendBackofficeMemberAccessEmail,
  generateBackofficeInviteAccessLink,
  type BackofficeMemberAccessMode,
} from "@/lib/backoffice-member-access"
import type { IBackofficeMemberAccessEmailUseCase } from "./IBackofficeMemberAccessEmailUseCase"

export class BackofficeMemberAccessEmailUseCase implements IBackofficeMemberAccessEmailUseCase {
  constructor(private readonly repository: IBackofficeMemberAccessRepository) {}

  async sendAccessEmail(input: {
    profileId: string
    accountMasterId: string
    mode: BackofficeMemberAccessMode
  }): Promise<Output> {
    try {
      const profile = await this.repository.findProfileAccessRecord(input)
      if (!profile) {
        return new Output(false, [], ["Membro não encontrado"], null)
      }

      // Achado de review (PR #1090): duas requisições concorrentes pro mesmo
      // profileId geram tokens Supabase distintos que se invalidam entre si —
      // o lock serializa, nunca gera um segundo token enquanto o primeiro
      // segue em voo (ver BackofficeMemberAccessRepository.runWithInviteLock).
      const lockOutcome = await this.repository.runWithInviteLock(input.profileId, () =>
        sendBackofficeMemberAccessEmail({ profile, mode: input.mode })
      )
      if (!lockOutcome.acquired) {
        return new Output(
          false,
          [],
          ["Já existe um envio em andamento para este membro. Aguarde alguns segundos e tente novamente."],
          null
        )
      }

      const result = lockOutcome.result
      return new Output(
        true,
        [
          input.mode === "invite"
            ? "Convite reenviado com sucesso."
            : "E-mail de reset de senha enviado com sucesso.",
        ],
        [],
        {
          email: result.email,
          access: result.access,
        }
      )
    } catch (error) {
      console.error("[BackofficeMemberAccessEmailUseCase][sendAccessEmail]", error)
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Erro ao enviar e-mail de acesso"],
        null
      )
    }
  }

  /** Entregável 3: gera link de convite novo sem disparar e-mail, para o dono copiar. */
  async generateInviteLink(input: { profileId: string; accountMasterId: string }): Promise<Output> {
    try {
      const profile = await this.repository.findProfileAccessRecord(input)
      if (!profile) {
        return new Output(false, [], ["Membro não encontrado"], null)
      }

      const lockOutcome = await this.repository.runWithInviteLock(input.profileId, () =>
        generateBackofficeInviteAccessLink(profile)
      )
      if (!lockOutcome.acquired) {
        return new Output(
          false,
          [],
          ["Já existe uma geração de link em andamento para este membro. Aguarde alguns segundos e tente novamente."],
          null
        )
      }

      const result = lockOutcome.result
      return new Output(true, ["Link de convite gerado."], [], {
        actionLink: result.actionLink,
        email: result.email,
      })
    } catch (error) {
      console.error("[BackofficeMemberAccessEmailUseCase][generateInviteLink]", error)
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Erro ao gerar link de convite"],
        null
      )
    }
  }
}

export const backofficeMemberAccessEmailUseCase = new BackofficeMemberAccessEmailUseCase(
  new BackofficeMemberAccessRepository()
)
