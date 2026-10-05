import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { Output } from "@/lib/output"
import { isManagerLikeRole } from "@/lib/roles"
import { STORAGE_BUCKETS, SupabaseStorageService } from "@/lib/supabase/storage"

export class LandingPageAssetUseCase {
  async upload(access: TeamAccess, file: File) {
    if (!access.isMaster && !isManagerLikeRole(access.teamMember.role)) return new Output(false, [], ["Acesso negado às landing pages"], null)
    const result = await SupabaseStorageService.uploadFile(file, STORAGE_BUCKETS.LANDING_PAGE_ASSETS, access.profileId, file.name, `team-${access.teamId}`)
    return result.success
      ? new Output(true, ["Asset enviado"], [], { fileId: result.fileId, publicUrl: result.publicUrl })
      : new Output(false, [], [result.error ?? "Não foi possível enviar o asset"], null)
  }
}

export const landingPageAssetUseCase = new LandingPageAssetUseCase()
