import { Output } from "@/lib/output"
import type { IBackofficeAccountIconUseCase } from "./IBackofficeAccountIconUseCase"
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository"
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository"
import type { IProfileIconService } from "@/app/api/services/profile/IProfileIconService"
import { profileIconService } from "@/app/api/services/profile/ProfileIconService"

export class BackofficeAccountIconUseCase implements IBackofficeAccountIconUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly icons: IProfileIconService
  ) {}

  async uploadIcon(params: { profileId: string; supabaseId: string; file: File }): Promise<Output> {
    const uploadResult = await this.icons.uploadProfileIcon(params.file, params.supabaseId)
    if (!uploadResult.success || !uploadResult.iconId || !uploadResult.publicUrl) {
      return new Output(
        false,
        [],
        [uploadResult.error || "Erro ao fazer upload da imagem"],
        null
      )
    }

    const profile = await this.profiles.updateProfileIcon(
      params.supabaseId,
      uploadResult.iconId,
      uploadResult.publicUrl
    )

    if (!profile) {
      await this.icons.deleteProfileIcon(uploadResult.iconId).catch((error) =>
        console.error("[BackofficeAccountIconUseCase][uploadIcon][rollback]", error)
      )
      return new Output(false, [], ["Erro ao atualizar ícone"], null)
    }

    return new Output(true, ["Ícone atualizado com sucesso"], [], {
      iconId: uploadResult.iconId,
      publicUrl: uploadResult.publicUrl,
    })
  }

  async removeIcon(params: { profileId: string; supabaseId: string }): Promise<Output> {
    const profile = await this.profiles.findById(params.profileId)
    if (!profile) {
      return new Output(false, [], ["Perfil não encontrado"], null)
    }

    if (profile.profileIconId) {
      const deleted = await this.icons.deleteProfileIcon(profile.profileIconId)
      if (!deleted.success) {
        return new Output(false, [], [deleted.error || "Erro ao remover ícone"], null)
      }
    }

    await this.profiles.updateProfileIcon(params.supabaseId, null, null)
    return new Output(true, ["Ícone removido com sucesso"], [], null)
  }
}

export const backofficeAccountIconUseCase = new BackofficeAccountIconUseCase(
  profileRepository,
  profileIconService
)

