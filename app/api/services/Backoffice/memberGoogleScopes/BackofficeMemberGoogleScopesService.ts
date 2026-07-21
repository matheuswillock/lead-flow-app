import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository"
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository"
import { googleOAuthConnectionRepository } from "@/app/api/infra/data/repositories/googleOAuthConnection/GoogleOAuthConnectionRepository"
import {
  getScopesForGoogleConnection,
  type GoogleConnectionScopesResult,
} from "@/lib/google/get-scopes-for-connection"

const LOG_PREFIX = "[BackofficeMemberGoogleScopesService]"

export type MemberGoogleScopesResult = GoogleConnectionScopesResult

class BackofficeMemberGoogleScopesService {
  constructor(private readonly profileRepo: IProfileRepository) {}

  async getScopesForMember(memberId: string): Promise<MemberGoogleScopesResult> {
    const profile = await this.profileRepo.findById(memberId)

    if (!profile) {
      throw new Error("Membro não encontrado")
    }

    if (!profile.googleConnectionId) {
      return { connected: false, scopes: [] }
    }

    const connection = await googleOAuthConnectionRepository.findById(profile.googleConnectionId)
    if (!connection || connection.revokedAt) {
      return { connected: false, scopes: [] }
    }

    try {
      return await getScopesForGoogleConnection(connection)
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed for member ${memberId}`, err)
      throw err
    }
  }
}

export const backofficeMememberGoogleScopesService = new BackofficeMemberGoogleScopesService(
  profileRepository
)
