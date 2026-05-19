import { Output } from "@/lib/output"
import { backofficeMememberGoogleScopesService } from "@/app/api/services/Backoffice/memberGoogleScopes/BackofficeMemberGoogleScopesService"

const LOG_PREFIX = "[GetMemberGoogleScopesUseCase]"

export async function getMemberGoogleScopesUseCase(memberId: string): Promise<Output> {
  try {
    const result = await backofficeMememberGoogleScopesService.getScopesForMember(memberId)
    return new Output(true, [], [], result)
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed for member ${memberId}`, err)
    const message = err instanceof Error ? err.message : "Erro ao buscar escopos Google"
    return new Output(false, [], [message], null)
  }
}
