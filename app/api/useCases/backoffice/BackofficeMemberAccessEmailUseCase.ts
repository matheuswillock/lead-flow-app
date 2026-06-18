import { Output } from "@/lib/output"
import { BackofficeMemberAccessRepository } from "@/app/api/infra/data/repositories/backoffice/MemberAccessRepository/BackofficeMemberAccessRepository"
import type { IBackofficeMemberAccessRepository } from "@/app/api/infra/data/repositories/backoffice/MemberAccessRepository/IBackofficeMemberAccessRepository"
import {
  sendBackofficeMemberAccessEmail,
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
}

export const backofficeMemberAccessEmailUseCase = new BackofficeMemberAccessEmailUseCase(
  new BackofficeMemberAccessRepository()
)
