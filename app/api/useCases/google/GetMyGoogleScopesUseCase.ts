import { Output } from "@/lib/output"
import { backofficeMememberGoogleScopesService } from "@/app/api/services/Backoffice/memberGoogleScopes/BackofficeMemberGoogleScopesService"
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository"

const LOG_PREFIX = "[GetMyGoogleScopesUseCase]"

export async function getMyGoogleScopesUseCase(supabaseId: string): Promise<Output> {
  const profile = await profileRepository.findBySupabaseId(supabaseId)
  if (!profile) {
    return new Output(false, [], ["Perfil nao encontrado"], null)
  }

  try {
    const result = await backofficeMememberGoogleScopesService.getScopesForMember(profile.id)
    return new Output(true, [], [], result)
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed for supabaseId ${supabaseId}`, err)
    const message = err instanceof Error ? err.message : "Erro ao buscar escopos Google"
    return new Output(false, [], [message], null)
  }
}
