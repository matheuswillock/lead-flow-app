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

  async sendAccessEmail(profileId: string, mode: BackofficeMemberAccessMode): Promise<Output> {
    try {
      const profile = await this.repository.findProfileAccessRecord(profileId)
      if (!profile) {
        return new Output(false, [], ["Membro não encontrado"], null)
      }

      const result = await sendBackofficeMemberAccessEmail({ profile, mode })
      return new Output(
        true,
        [
          mode === "invite"
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
  async generateInviteLink(profileId: string): Promise<Output> {
    try {
      const profile = await this.repository.findProfileAccessRecord(profileId)
      if (!profile) {
        return new Output(false, [], ["Membro não encontrado"], null)
      }

      const result = await generateBackofficeInviteAccessLink(profile)
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
